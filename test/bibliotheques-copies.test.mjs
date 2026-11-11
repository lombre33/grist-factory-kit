// La copie figée d'une fonction, rangée dans le dépôt de l'app (outils/bibliotheques/copies.mjs) : la déclaration, la page à deux cartes d'importation et son script de choix, la politique qui cite leurs empreintes,
// la construction du dossier (licences, manifeste) et sa vérification.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { bootstrapText, buildCopy, checkCopyFolder, checkMapBlock, copyMapText, mapBlock, packagesRead, readCopy, rewriteMapBlock } from '../outils/bibliotheques/copies.mjs';
import { checkPage, inlineScripts, rewritePage } from '../outils/bibliotheques/app.mjs';
import { importMapText, readMap } from '../outils/bibliotheques/carte.mjs';

const sha256 = text => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

const pkg = copie => ({
  dependencies: { 'prosemirror-model': '1.25.11', '@tiptap/core': '3.31.3', '@tiptap/pm': '3.31.3' },
  devDependencies: { esbuild: '0.25.10' },
  gfs: {
    carte: { origine: 'https://esm.sh', fixes: { 'kit/ambiance-pose': './kit/js/ambiance-pose.js?v=1' }, paquets: ['prosemirror-model', '@tiptap/core', '@tiptap/pm'], uniques: ['prosemirror-model'] },
    page: 'index.html',
    politique: { scriptSrc: ["'self'", 'https://esm.sh'] },
    copie: { fonction: 'editeur', dossier: 'vendor/editeur', sansEsm: ['@tiptap/pm'], cle: 'pp_editeur_copie', ...copie },
  },
});
const copyOf = copie => readCopy(pkg(copie));
const cdnText = packageJson => importMapText(readMap(packageJson));

const PAGE = `<!doctype html>
<html><head>
<meta http-equiv="Content-Security-Policy" content="
  script-src 'self' ancien;
  object-src 'none'">
<script type="importmap">
</script>
<script type="module" src="js/main.js"></script>
</head><body></body></html>
`;

// ---- La déclaration ----

test('readCopy : rien sans déclaration ; une carte, une fonction, un dossier relatif, une clé de stockage ; sansEsm dans la carte', () => {
  assert.equal(readCopy({ gfs: {} }), null);
  const copy = copyOf();
  assert.equal(copy.fonction, 'editeur');
  assert.equal(copy.prefixe, './vendor/editeur/');
  assert.deepEqual(copy.modules, ['prosemirror-model', '@tiptap/core'], '@tiptap/pm est sansEsm');
  assert.equal(copy.cle, 'pp_editeur_copie');
  assert.equal(copyOf({ cle: undefined }).cle, null, 'la clé est facultative');
  const noMap = pkg();
  delete noMap.gfs.carte;
  assert.throws(() => readCopy(noMap), /ne déclare pas de carte/);
  assert.throws(() => copyOf({ fonction: 'a b' }), /gfs\.copie\.fonction/);
  assert.throws(() => copyOf({ dossier: '../dehors' }), /gfs\.copie\.dossier/);
  assert.throws(() => copyOf({ dossier: 'node_modules/x' }), /gfs\.copie\.dossier/);
  assert.throws(() => copyOf({ cle: 'a"b' }), /gfs\.copie\.cle/);
  assert.throws(() => copyOf({ sansEsm: ['inconnu'] }), /gfs\.copie\.sansEsm : inconnu n'est pas dans la carte/);
});

test('copyMapText : les entrées fixes de l\'app puis chaque module à son adresse relative ; aucune adresse de CDN', () => {
  const imports = JSON.parse(copyMapText(copyOf())).imports;
  assert.deepEqual(imports, {
    'kit/ambiance-pose': './kit/js/ambiance-pose.js?v=1',
    'prosemirror-model': './vendor/editeur/prosemirror-model.js',
    '@tiptap/core': './vendor/editeur/tiptap__core.js',
  });
  assert.ok(!copyMapText(copyOf()).includes('esm.sh'));
});

// ---- Le script qui choisit la carte ----

// Exécute le script du bloc dans une page factice et rend le texte de la carte qu'il a posée (ou null).
function chosen(copy, { search = '', stored = null, storage = 'ok', location = 'ok' } = {}) {
  const posed = [];
  const data = { 'gfs-carte-cdn': { textContent: 'CARTE-CDN' }, 'gfs-carte-copie': { textContent: 'CARTE-COPIE' } };
  const sandbox = {
    URLSearchParams,
    get location() { if (location === 'throws') throw new Error('adresse illisible'); return { search }; },
    get localStorage() { if (storage === 'throws') throw new Error('stockage refusé'); return { getItem: key => (key === 'pp_editeur_copie' ? stored : null) }; },
    document: { createElement: () => ({}), getElementById: id => data[id], head: { appendChild: element => posed.push(element) } },
  };
  runInNewContext(bootstrapText(copy), sandbox);
  assert.equal(posed.length, 1, 'une seule carte posée');
  assert.equal(posed[0].type, 'importmap');
  return posed[0].textContent;
}

test('le script de choix : la copie quand l\'adresse dit copie=<fonction> (seule ou parmi d\'autres), le CDN sinon ; la clé du stockage choisit seule la copie ; rien ne casse sans stockage', () => {
  const copy = copyOf();
  assert.equal(chosen(copy), 'CARTE-CDN', 'sans rien : le CDN, le défaut');
  assert.equal(chosen(copy, { search: '?copie=editeur' }), 'CARTE-COPIE');
  assert.equal(chosen(copy, { search: '?x=1&copie=plotly,editeur' }), 'CARTE-COPIE', 'parmi d\'autres fonctions');
  assert.equal(chosen(copy, { search: '?copie=autre' }), 'CARTE-CDN', 'une autre fonction ne change rien');
  assert.equal(chosen(copy, { search: '?copie=editeurs' }), 'CARTE-CDN', 'le nom entier, pas un morceau');
  assert.equal(chosen(copy, { stored: 'copie' }), 'CARTE-COPIE', 'app seule : la clé du stockage');
  assert.equal(chosen(copy, { stored: 'cdn' }), 'CARTE-CDN');
  assert.equal(chosen(copy, { storage: 'throws' }), 'CARTE-CDN', 'stockage refusé : le CDN, sans erreur');
  assert.equal(chosen(copy, { location: 'throws' }), 'CARTE-CDN', 'adresse illisible : le CDN, sans erreur');
  assert.equal(chosen(copy, { search: '?copie=editeur', storage: 'throws' }), 'CARTE-COPIE', 'l\'adresse suffit sans stockage');
  assert.equal(chosen(copyOf({ cle: undefined }), { stored: 'copie' }), 'CARTE-CDN', 'sans clé déclarée, le stockage n\'est pas lu');
  assert.ok(!bootstrapText(copy).includes('http'), 'le script ne nomme aucune adresse : il choisit entre deux textes de la page');
});

// ---- La page ----

test('rewriteMapBlock : la carte écrite une fois à la main devient le bloc (deux cartes en données et le script) ; relancer ne change rien ; le bloc se réécrit sur place', () => {
  const packageJson = pkg();
  const copy = readCopy(packageJson);
  const text = cdnText(packageJson);
  const once = rewriteMapBlock(PAGE, text, copy);
  assert.ok(once.includes(`<script type="application/json" id="gfs-carte-cdn">${text}</script>`));
  assert.ok(once.includes(`<script type="application/json" id="gfs-carte-copie">${copyMapText(copy)}</script>`));
  assert.ok(once.includes(`<script>${bootstrapText(copy)}</script>`));
  assert.ok(!/<script type="importmap">/.test(once), 'plus de carte en dur');
  assert.equal(rewriteMapBlock(once, text, copy), once, 'relancer ne change rien');
  assert.equal(once, PAGE.replace('<script type="importmap">\n</script>', mapBlock(text, copy)));
  const other = rewriteMapBlock(once, text, copyOf({ dossier: 'autre/dossier' }));
  assert.ok(other.includes('./autre/dossier/tiptap__core.js') && !other.includes('./vendor/editeur/'), 'le bloc est réécrit sur place');
  assert.throws(() => rewriteMapBlock('<html></html>', text, copy), /ni <script type="importmap"> ni le bloc/);
  const commented = rewriteMapBlock(`<!-- ${mapBlock(text, copy)} -->\n${PAGE}`, text, copy);
  assert.equal(commented.split('<script type="application/json" id="gfs-carte-cdn">').length, 3, 'un bloc en commentaire ne compte pas : le vrai est posé, celui du commentaire reste');
  assert.deepEqual(checkMapBlock(commented, text, copy), []);
});

test('checkMapBlock : un bloc conforme n\'a aucun écart ; chaque écart se dit (carte du CDN, carte de la copie, script, carte restée en dur, bloc absent)', () => {
  const packageJson = pkg();
  const copy = readCopy(packageJson);
  const text = cdnText(packageJson);
  const page = rewriteMapBlock(PAGE, text, copy);
  assert.deepEqual(checkMapBlock(page, text, copy), []);
  assert.match(checkMapBlock(PAGE, text, copy)[0], /pas le bloc des deux cartes/);
  assert.ok(checkMapBlock(page.replace('"@tiptap/core": "./vendor/editeur/tiptap__core.js"', '"@tiptap/core": "./vendor/editeur/vieux.js"'), text, copy).some(problem => /changer dans la carte de la copie : @tiptap\/core/.test(problem)));
  assert.ok(checkMapBlock(page.replace('"@tiptap/core": "https://esm.sh/@tiptap/core@3.31.3"', '"@tiptap/core": "https://esm.sh/@tiptap/core@3.0.0"'), text, copy).some(problem => /changer dans la carte du CDN : @tiptap\/core/.test(problem)));
  assert.ok(checkMapBlock(page.replace('var fonction', 'var autre'), text, copy).some(problem => /script qui choisit la carte n'est pas celui de l'outil/.test(problem)));
  assert.ok(checkMapBlock(page.replace('</head>', '<script type="importmap">{}</script></head>'), text, copy).some(problem => /carte d'importation en dur reste à côté du bloc/.test(problem)));
  assert.deepEqual(checkMapBlock(page.replace('</head>', '<!-- <script type="importmap">{}</script> --></head>'), text, copy), [], 'une carte en commentaire ne compte pas');
});

test('la politique cite l\'empreinte du script de choix et celle du texte exact de chaque carte ; une carte qui change change son empreinte ; un oubli se voit', () => {
  const packageJson = pkg();
  const copy = readCopy(packageJson);
  const text = cdnText(packageJson);
  const policy = { page: 'index.html', fixed: packageJson.gfs.politique.scriptSrc };
  const catalogue = { bibliotheques: [] };
  const page = rewritePage(PAGE, policy, catalogue, text, copy);
  const wanted = [sha256(text), sha256(copyMapText(copy)), sha256(bootstrapText(copy))];
  for (const hash of wanted) assert.ok(page.includes(hash), `script-src cite ${hash}`);
  assert.deepEqual(checkPage(page, policy, catalogue, text, copy), []);
  assert.equal(rewritePage(page, policy, catalogue, text, copy), page, 'idempotent');
  assert.deepEqual(new Set(inlineScripts(page).map(script => script.hash)), new Set(wanted), 'les trois empreintes sont celles des scripts en ligne comptés');
  assert.equal(inlineScripts(page).length, 3, 'les deux cartes en données et le script (le type application/json ordinaire ne compte pas)');
  assert.equal(inlineScripts(`${page}<script type="application/json">{}</script>`).length, 3, 'une donnée ordinaire n\'est pas un script');
  const forgotten = page.replace(wanted[1], '');
  assert.ok(checkPage(forgotten, policy, catalogue, text, copy).some(problem => problem.includes(`à ajouter à script-src : ${wanted[1]}`)), 'l\'empreinte de la carte de la copie oubliée');
  const other = copyOf({ dossier: 'autre/dossier' });
  const moved = checkPage(page, policy, catalogue, text, other);
  assert.ok(moved.some(problem => /à ajouter à script-src : 'sha256-/.test(problem)) && moved.some(problem => /à retirer de script-src : 'sha256-/.test(problem)), 'une autre carte, une autre empreinte');
});

// ---- Le dossier de la copie ----

// Un faux `npm install` et un faux esbuild : ils posent ce que l'outil lit, sans réseau. Le faux esbuild écrit un module par entrée et un morceau partagé.
function fakeInstall(dir) {
  for (const [name, version, licence] of [['prosemirror-model', '1.25.11', 'MIT'], ['@tiptap/core', '3.31.3', 'MIT'], ['orderedmap', '2.1.1', 'MIT']]) {
    mkdirSync(join(dir, 'node_modules', name), { recursive: true });
    writeFileSync(join(dir, 'node_modules', name, 'package.json'), JSON.stringify({ name, version, license: licence }));
    if (name !== 'orderedmap') writeFileSync(join(dir, 'node_modules', name, 'LICENSE'), `Licence de ${name}\n`);
  }
}
// Les fichiers que le faux esbuild dit avoir lus (le dernier est dans un node_modules imbriqué).
const fakeEsbuildMeta = (orderedmap = 'node_modules/orderedmap') => ({ inputs: { 'entries/tiptap__core.js': {}, 'node_modules/@tiptap/core/dist/index.js': {}, 'node_modules/prosemirror-model/dist/index.js': {}, [`${orderedmap}/dist/index.js`]: {} } });
const fakeEsbuild = () => ({
  async build(options) {
    mkdirSync(options.outdir, { recursive: true });
    for (const name of Object.keys(options.entryPoints)) writeFileSync(join(options.outdir, `${name}.js`), `export * from "./chunk-ABC.js"; /* ${name} */\n`);
    writeFileSync(join(options.outdir, 'chunk-ABC.js'), 'export const partage = 1;\n');
    return { metafile: fakeEsbuildMeta() };
  },
});

test('packagesRead : les paquets que la construction a lus, triés, avec version et licence ; le dernier node_modules d\'un chemin nomme le paquet', () => {
  const work = mkdtempSync(join(tmpdir(), 'kit-copie-test-'));
  try {
    fakeInstall(work);
    mkdirSync(join(work, 'node_modules/@tiptap/core/node_modules/orderedmap'), { recursive: true });
    writeFileSync(join(work, 'node_modules/@tiptap/core/node_modules/orderedmap/package.json'), JSON.stringify({ name: 'orderedmap', version: '9.9.9', license: 'ISC' }));
    const found = packagesRead(work, fakeEsbuildMeta('node_modules/@tiptap/core/node_modules/orderedmap'));
    assert.deepEqual(Object.keys(found), ['@tiptap/core', 'orderedmap', 'prosemirror-model']);
    assert.equal(found.orderedmap.version, '9.9.9', 'celui de dessous, pas celui de dessus');
    assert.equal(found['prosemirror-model'].licence, 'MIT');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('buildCopy : le dossier de l\'app reçoit les modules, le morceau partagé, les licences et le manifeste ; ce que la copie ne dit plus est retiré ; la vérification passe puis voit chaque écart', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kit-copie-test-'));
  try {
    const messages = [];
    const packageJson = pkg();
    const copy = await buildCopy(root, packageJson, { install: fakeInstall, loadEsbuild: fakeEsbuild }, text => messages.push(text));
    const dir = join(root, 'vendor/editeur');
    assert.ok(existsSync(join(dir, 'prosemirror-model.js')) && existsSync(join(dir, 'tiptap__core.js')) && existsSync(join(dir, 'chunk-ABC.js')));
    assert.ok(!existsSync(join(dir, 'tiptap__pm.js')), 'sansEsm : pas de module pour @tiptap/pm');
    assert.match(messages[0], /copie « editeur » : 3 fichier\(s\), 3 paquet\(s\) dans vendor\/editeur/);
    const manifest = JSON.parse(readFileSync(join(dir, 'COPIE.json'), 'utf8'));
    assert.equal(manifest.fonction, 'editeur');
    assert.deepEqual(manifest.paquets, { '@tiptap/core': '3.31.3', orderedmap: '2.1.1', 'prosemirror-model': '1.25.11' });
    assert.deepEqual(Object.keys(manifest.fichiers), ['chunk-ABC.js', 'prosemirror-model.js', 'tiptap__core.js']);
    assert.match(manifest.fichiers['chunk-ABC.js'], /^sha384-/);
    const licences = readFileSync(join(dir, 'LICENCES.txt'), 'utf8');
    assert.match(licences, /== @tiptap\/core@3\.31\.3 : MIT ==\nLicence de @tiptap\/core/);
    assert.match(licences, /== orderedmap@2\.1\.1 : MIT ==\n\(pas de fichier de licence dans le paquet\)/, 'un paquet sans fichier de licence le dit');
    assert.deepEqual(checkCopyFolder(root, copy), []);

    writeFileSync(join(dir, 'tiptap__core.js'), 'export {};\n');
    assert.ok(checkCopyFolder(root, copy).some(problem => /tiptap__core\.js n'est plus celui de la copie/.test(problem)), 'un fichier modifié à la main');
    await buildCopy(root, packageJson, { install: fakeInstall, loadEsbuild: fakeEsbuild }, () => {});
    writeFileSync(join(dir, 'reste.js'), 'ancien');
    assert.ok(checkCopyFolder(root, copy).some(problem => /reste\.js : un fichier que la copie ne connaît pas/.test(problem)), 'un fichier en trop');
    await buildCopy(root, packageJson, { install: fakeInstall, loadEsbuild: fakeEsbuild }, () => {});
    assert.ok(!existsSync(join(dir, 'reste.js')), 'refaire la copie retire ce qu\'elle ne dit plus');
    rmSync(join(dir, 'chunk-ABC.js'));
    assert.ok(checkCopyFolder(root, copy).some(problem => /chunk-ABC\.js absent/.test(problem)), 'un fichier manquant');
    await buildCopy(root, packageJson, { install: fakeInstall, loadEsbuild: fakeEsbuild }, () => {});

    const bumped = pkg();
    bumped.dependencies['@tiptap/core'] = '3.40.0';
    assert.ok(checkCopyFolder(root, readCopy(bumped)).some(problem => /@tiptap\/core : la copie a 3\.31\.3, la liste dit 3\.40\.0 : refaire la copie/.test(problem)), 'la liste a monté une version : la copie est en retard');
    rmSync(join(dir, 'COPIE.json'));
    assert.match(checkCopyFolder(root, copy)[0], /COPIE\.json absent : la copie « editeur » n'est pas construite/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildCopy : sans `gfs.copie` ou sans esbuild dans la liste, l\'outil le dit', async () => {
  await assert.rejects(buildCopy('/inexistant', { gfs: {} }), /ne déclare pas de copie/);
  const noEsbuild = pkg();
  delete noEsbuild.devDependencies;
  await assert.rejects(buildCopy('/inexistant', noEsbuild, { install: fakeInstall, loadEsbuild: fakeEsbuild }), /esbuild n'est pas dans devDependencies/);
});
