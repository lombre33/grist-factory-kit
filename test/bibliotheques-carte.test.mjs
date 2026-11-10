// La carte d'importation d'une app, écrite d'après sa liste (outils/bibliotheques/carte.mjs), et son lien avec la politique de sécurité : l'empreinte de la carte change avec elle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildImportMap, checkImportMap, importMapText, readMap, rewriteImportMap } from '../outils/bibliotheques/carte.mjs';
import { checkPage, inlineHash, inlineScripts, readPolicy, rewritePage } from '../outils/bibliotheques/app.mjs';

const pkg = extra => ({
  dependencies: { 'prosemirror-model': '1.25.11', 'prosemirror-state': '1.4.4', '@tiptap/core': '3.31.3', '@tiptap/pm': '3.31.3' },
  gfs: {
    carte: {
      origine: 'https://esm.sh',
      fixes: { 'kit/ambiance-message': './kit/js/ambiance-message.js?v=8afa569' },
      paquets: ['prosemirror-model', 'prosemirror-state', '@tiptap/core', '@tiptap/pm'],
      uniques: ['prosemirror-model', 'prosemirror-state'],
      sousChemins: { '@tiptap/pm': { model: 'prosemirror-model', state: 'prosemirror-state' } },
      plages: { 'prosemirror-state': '^1.0.0' },
    },
    politique: { scriptSrc: ["'self'"] },
    ...extra,
  },
});
const withMap = changes => { const value = pkg(); Object.assign(value.gfs.carte, changes); return value; };

test('buildImportMap : les versions viennent de la liste, `*` pour les instances uniques, les sous-chemins et les plages ramenés à elles', () => {
  const { imports } = buildImportMap(readMap(pkg()));
  assert.deepEqual(imports, {
    'kit/ambiance-message': './kit/js/ambiance-message.js?v=8afa569',
    'prosemirror-model': 'https://esm.sh/*prosemirror-model@1.25.11',
    'prosemirror-state': 'https://esm.sh/*prosemirror-state@1.4.4',
    '@tiptap/core': 'https://esm.sh/@tiptap/core@3.31.3',
    '@tiptap/pm': 'https://esm.sh/@tiptap/pm@3.31.3',
    'https://esm.sh/@tiptap/pm@3.31.3/es2022/model.mjs': 'https://esm.sh/*prosemirror-model@1.25.11',
    'https://esm.sh/@tiptap/pm@3.31.3/es2022/state.mjs': 'https://esm.sh/*prosemirror-state@1.4.4',
    'https://esm.sh/prosemirror-state@^1.0.0?target=es2022': 'https://esm.sh/*prosemirror-state@1.4.4',
  });
  assert.deepEqual(Object.keys(imports).slice(0, 2), ['kit/ambiance-message', 'prosemirror-model'], 'dans l\'ordre de la liste');
});

test('une montée de version se fait une fois, dans la liste : le paquet, ses sous-chemins et ses plages la reprennent', () => {
  const next = pkg();
  next.dependencies['prosemirror-state'] = '1.4.5';
  next.dependencies['@tiptap/pm'] = '3.32.0';
  const text = JSON.stringify(buildImportMap(readMap(next)));
  assert.ok(!text.includes('1.4.4') && !text.includes('3.31.3@') && !text.includes('pm@3.31.3'), text);
  assert.equal(text.match(/prosemirror-state@1\.4\.5/g).length, 3, 'le paquet, le sous-chemin et la plage');
  assert.ok(text.includes('https://esm.sh/@tiptap/pm@3.32.0/es2022/model.mjs'));
});

test('readMap : rien sans déclaration ; une version exacte, des noms qui existent, des instances uniques cohérentes', () => {
  assert.equal(readMap({ gfs: {} }), null);
  assert.throws(() => readMap(withMap({ origine: 'http://esm.sh' })), /origine https/);
  assert.throws(() => readMap(withMap({ paquets: [] })), /liste de noms/);
  assert.throws(() => readMap(withMap({ paquets: ['prosemirror-model', 'prosemirror-model'] })), /écrit deux fois/);
  assert.throws(() => readMap(withMap({ paquets: ['prosemirror-model', 'inconnu'] })), /la version de inconnu doit être exacte/);
  const loose = pkg();
  loose.dependencies['@tiptap/core'] = '^3.31.3';
  assert.throws(() => readMap(loose), /la version de @tiptap\/core doit être exacte/);
  assert.throws(() => readMap(withMap({ uniques: ['prosemirror-view'] })), /prosemirror-view n'est pas dans paquets/);
  assert.throws(() => readMap(withMap({ sousChemins: { 'autre': { model: 'prosemirror-model' } } })), /autre n'est pas dans paquets/);
  assert.throws(() => readMap(withMap({ sousChemins: { '@tiptap/pm': { core: '@tiptap/core' } } })), /@tiptap\/core, qui n'est pas dans uniques/);
  assert.throws(() => readMap(withMap({ plages: { '@tiptap/core': '^3.0.0' } })), /@tiptap\/core n'est pas dans uniques/);
  assert.throws(() => readMap(withMap({ fixes: { x: 3 } })), /des adresses attendues/);
});

const PAGE = `<!doctype html>
<meta http-equiv="Content-Security-Policy" content="
  script-src 'self' ancien;
  object-src 'none'">
<script>try { window.a = 1; } catch (e) {}</script>
<script type="importmap">
{ "imports": { "vieux": "./vieux.js" } }
</script>
`;

test('rewriteImportMap et checkImportMap : seule la carte change ; ajout, retrait, changement et écriture sont dits ; une deuxième passe ne change rien', () => {
  const text = importMapText(readMap(pkg()));
  const page = rewriteImportMap(PAGE, text);
  assert.ok(page.includes('<script>try { window.a = 1; } catch (e) {}</script>\n<script type="importmap">\n{\n  "imports": {'));
  assert.equal(rewriteImportMap(page, text), page);
  assert.deepEqual(checkImportMap(page, text), []);
  const problems = checkImportMap(PAGE, text);
  assert.ok(problems.includes('à retirer de la carte d\'importation : vieux'));
  assert.ok(problems.includes('à ajouter à la carte d\'importation : @tiptap/core'));
  const changed = page.replace('prosemirror-model@1.25.11', 'prosemirror-model@1.25.10');
  assert.deepEqual(checkImportMap(changed, text), ['à changer dans la carte d\'importation : prosemirror-model vaut https://esm.sh/*prosemirror-model@1.25.10, la liste dit https://esm.sh/*prosemirror-model@1.25.11']);
  assert.match(checkImportMap(page.replace('"imports": {', '"imports":{'), text)[0], /pas écrite comme l'outil l'écrit/);
  assert.match(checkImportMap(page.replace('{\n  "imports"', '{ "imports"'), text)[0], /pas écrite comme l'outil l'écrit|pas du JSON/);
  assert.throws(() => rewriteImportMap('<html><script>a()</script></html>', text), /pas de <script type="importmap">/);
  assert.throws(() => rewriteImportMap('<!-- <script type="importmap"></script> --><html></html>', text), /pas de <script type="importmap">/, 'un exemple en commentaire n\'est pas la carte');
});

test('la politique cite l\'empreinte de la carte telle que l\'outil l\'écrit : changer une version change la carte, donc l\'empreinte, dans la même passe', () => {
  const policy = readPolicy(pkg());
  const catalogue = { bibliotheques: [] };
  const text = importMapText(readMap(pkg()));
  const page = rewritePage(PAGE, policy, catalogue, text);
  const hashes = inlineScripts(page).map(script => script.hash);
  assert.equal(hashes.length, 2);
  assert.equal(hashes[1], inlineHash(text), 'la carte écrite est celle dont l\'empreinte est citée');
  assert.ok(page.includes(hashes[1]));
  assert.deepEqual(checkPage(page, policy, catalogue, text), []);
  assert.equal(rewritePage(page, policy, catalogue, text), page, 'idempotent');

  const next = pkg();
  next.dependencies['@tiptap/core'] = '3.31.4';
  next.gfs.carte.paquets = [...next.gfs.carte.paquets];
  const nextText = importMapText(readMap(next));
  const problems = checkPage(page, policy, catalogue, nextText);
  assert.ok(problems.some(problem => problem.startsWith('à changer dans la carte d\'importation : @tiptap/core')), problems.join('|'));
  assert.ok(problems.some(problem => problem.startsWith(`à ajouter à script-src : ${inlineHash(nextText)} (la carte d'importation)`)), 'la nouvelle empreinte est celle de la carte à jour');
  assert.ok(problems.includes(`à retirer de script-src : ${inlineHash(text)}`));
  const regenerated = rewritePage(page, policy, catalogue, nextText);
  assert.ok(regenerated.includes(inlineHash(nextText)) && !regenerated.includes(inlineHash(text)));
  assert.deepEqual(checkPage(regenerated, policy, catalogue, nextText), []);
});

test('une page sans politique d\'app (`gfs.politique` absent) garde son script-src ; sa carte est tenue quand même', () => {
  const noPolicy = pkg();
  delete noPolicy.gfs.politique;
  const policy = readPolicy(noPolicy);
  const text = importMapText(readMap(noPolicy));
  const page = rewritePage(PAGE, policy, { bibliotheques: [] }, text);
  assert.ok(page.includes("script-src 'self' ancien;"));
  assert.ok(page.includes('"@tiptap/core": "https://esm.sh/@tiptap/core@3.31.3"'));
  assert.deepEqual(checkPage(page, policy, { bibliotheques: [] }, text), []);
});
