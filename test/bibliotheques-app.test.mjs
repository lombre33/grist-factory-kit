// L'outil des bibliothèques d'une app (outils/bibliotheques/app.mjs) : la liste en versions exactes, le catalogue, la politique de sécurité de la page, et leur cohérence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { addressOf, buildEntry, checkCatalogue, checkPage, expectedSources, generate, generateCatalogue, inlineHash, inlineScripts, readAppList, readPolicy, renderScriptSrc, rewritePage, verify } from '../outils/bibliotheques/app.mjs';
import { archiveName, checkCdn, integrity } from '../outils/bibliotheques/primitives.mjs';

const MARKED = 'https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.12/marked.min.js';
const list = extra => ({
  dependencies: { jszip: '3.10.1', marked: '15.0.12' },
  gfs: { bibliotheques: { jszip: { paquet: 'jszip', fichier: 'dist/jszip.min.js' }, marked: { paquet: 'marked', src: MARKED } }, page: 'index.html', politique: { scriptSrc: ["'self'", "'unsafe-eval'", 'https://docs.getgrist.com/grist-plugin-api.js'] } },
  ...extra,
});
const JSZIP = Buffer.from('/* jszip */ var JSZip = {};');
const MARKED_BYTES = Buffer.from('/* marked */ var marked = {};');
const sha256 = text => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

const PAGE = `<!doctype html>
<html><head>
<!-- <script>commenté()</script> et https://exemple.test/commente.js : ne comptent pas -->
<meta http-equiv="Content-Security-Policy" content="
  script-src 'self' 'unsafe-eval' ancien;
  object-src 'none'; base-uri 'none'; frame-src https://www.youtube-nocookie.com; form-action 'none'">
<script>try { window.a = 1; } catch (e) {}</script>
<script src="https://docs.getgrist.com/grist-plugin-api.js"></script>
<script type="importmap">
{ "imports": { "x": "./x.js" } }
</script>
<script type="application/json">{ "donnees": true }</script>
</head><body></body></html>
`;

test('readAppList : une version exacte par fichier, « fichier » ou « src », jamais un intervalle ni une adresse sans la version', () => {
  assert.deepEqual(readAppList(list()), [
    { id: 'jszip', paquet: 'jszip', version: '3.10.1', fichier: 'dist/jszip.min.js', src: null },
    { id: 'marked', paquet: 'marked', version: '15.0.12', fichier: null, src: MARKED },
  ]);
  for (const version of ['^3.10.1', '~3.10', 'latest', '3.x', '']) assert.throws(() => readAppList(list({ dependencies: { jszip: version, marked: '15.0.12' } })), /doit être exacte/, version);
  const both = list();
  both.gfs.bibliotheques.jszip.src = MARKED;
  assert.throws(() => readAppList(both), /l'un des deux/);
  const neither = list();
  delete neither.gfs.bibliotheques.jszip.fichier;
  assert.throws(() => readAppList(neither), /l'un des deux/);
  const outside = list();
  outside.gfs.bibliotheques.jszip.fichier = '../../x.js';
  assert.throws(() => readAppList(outside), /hors du paquet/);
  const old = list();
  old.gfs.bibliotheques.marked.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/14.0.0/marked.min.js';
  assert.throws(() => readAppList(old), /ne nomme pas la version exacte 15\.12|ne nomme pas la version exacte 15\.0\.12/);
  const loose = list();
  loose.gfs.bibliotheques.marked.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.12/marked.min.js?latest=1';
  assert.throws(() => readAppList(loose), /sans paramètre/);
  const plain = list();
  plain.gfs.bibliotheques.marked.src = 'http://cdnjs.cloudflare.com/ajax/libs/marked/15.0.12/marked.min.js';
  assert.throws(() => readAppList(plain), /https/);
});

test('une version avec un point ne se confond pas avec une autre : 15.0.12 n\'est pas 15x0y12', () => {
  const tricky = list();
  tricky.gfs.bibliotheques.marked.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/15x0y12/marked.min.js';
  assert.throws(() => readAppList(tricky), /ne nomme pas la version exacte/);
});

test('addressOf et buildEntry : jsDelivr pour un fichier de paquet, l\'adresse de la liste sinon ; l\'empreinte est celle des octets', () => {
  const [jszip, marked] = readAppList(list());
  assert.equal(addressOf(jszip), 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
  assert.equal(addressOf(marked), MARKED);
  assert.deepEqual(buildEntry(jszip, JSZIP), { id: 'jszip', version: '3.10.1', cdn: { src: addressOf(jszip), integrite: integrity(JSZIP) } });
});

test('inlineScripts : les scripts en ligne qui s\'exécutent, la carte d\'importation comprise ; pas ceux qui ont un src, ni les données, ni les commentaires', () => {
  const found = inlineScripts(PAGE);
  assert.equal(found.length, 2);
  assert.equal(found[0].hash, sha256('try { window.a = 1; } catch (e) {}'));
  assert.equal(found[1].hash, sha256('\n{ "imports": { "x": "./x.js" } }\n'), 'le texte entre les balises, espaces compris');
  assert.equal(found[1].quoi, 'la carte d\'importation');
  assert.equal(inlineHash('a'), sha256('a'));
});

test('renderScriptSrc : ce que l\'app écrit, les adresses, les empreintes, chaque suite sur ses lignes, à la largeur de 150 colonnes', () => {
  assert.equal(renderScriptSrc(["'self'"], ['https://a.test/x.js'], ["'sha256-AAA='"]), "script-src 'self'\n    https://a.test/x.js\n    'sha256-AAA='");
  const long = Array.from({ length: 12 }, (_, at) => `https://cdn.test/paquet-${at}/fichier-long.min.js`);
  const lines = renderScriptSrc(["'self'"], long, []).split('\n');
  assert.ok(lines.length >= 3);
  assert.ok(lines.every(line => line.length <= 150), 'aucune ligne ne dépasse 150 colonnes');
  assert.equal(lines.slice(1).join(' ').trim().split(/\s+/).join(' '), long.join(' '), 'aucune adresse perdue ni coupée');
});

function catalogueOf() {
  const [jszip, marked] = readAppList(list());
  return { bibliotheques: [buildEntry(jszip, JSZIP), buildEntry(marked, MARKED_BYTES)] };
}

test('rewritePage : seul script-src change ; les autres directives, les commentaires et le reste de la page restent tels quels ; une deuxième passe ne change rien', () => {
  const policy = readPolicy(list());
  const catalogue = catalogueOf();
  const page = rewritePage(PAGE, policy, catalogue);
  const sources = expectedSources(policy, catalogue, PAGE);
  assert.match(page, /script-src 'self' 'unsafe-eval' https:\/\/docs\.getgrist\.com\/grist-plugin-api\.js\n {4}https:\/\/cdn\.jsdelivr\.net\/npm\/jszip@3\.10\.1\/dist\/jszip\.min\.js /);
  for (const source of [...sources.fixed, ...sources.addresses, ...sources.hashes]) assert.ok(page.includes(source), source);
  assert.ok(!page.includes('ancien'), 'la source qui n\'est plus dans la liste disparaît');
  assert.ok(page.includes(";\n  object-src 'none'; base-uri 'none'; frame-src https://www.youtube-nocookie.com; form-action 'none'\">"), 'les autres directives sont intactes');
  assert.ok(page.includes('<!-- <script>commenté()</script> et https://exemple.test/commente.js : ne comptent pas -->'));
  assert.equal(rewritePage(page, policy, catalogue), page, 'idempotent');
  assert.deepEqual(checkPage(page, policy, catalogue), []);
});

test('rewritePage : sans `gfs.politique` la page reste telle quelle ; sans politique dans la page, l\'outil le dit', () => {
  const policy = readPolicy({ gfs: {} });
  assert.equal(policy.fixed, null);
  assert.equal(rewritePage(PAGE, policy, catalogueOf()), PAGE);
  assert.deepEqual(checkPage(PAGE, policy, catalogueOf()), []);
  assert.throws(() => rewritePage('<html><script>a()</script></html>', readPolicy(list()), catalogueOf()), /pas de <meta http-equiv="Content-Security-Policy">/);
  assert.throws(() => rewritePage('<html><meta http-equiv="Content-Security-Policy" content="object-src \'none\'"></html>', readPolicy(list()), catalogueOf()), /script-src/);
});

test('checkPage : un script en ligne modifié (nouvelle empreinte), une empreinte orpheline, une adresse oubliée ou en trop, une écriture que l\'outil ne tient pas', () => {
  const policy = readPolicy(list());
  const catalogue = catalogueOf();
  const page = rewritePage(PAGE, policy, catalogue);
  const edited = page.replace('window.a = 1', 'window.a = 2');
  const problems = checkPage(edited, policy, catalogue);
  assert.ok(problems.some(problem => problem.startsWith(`à ajouter à script-src : ${sha256('try { window.a = 2; } catch (e) {}')} (un script en ligne « try { window.a = 2;`)), problems.join('|'));
  assert.ok(problems.some(problem => problem === `à retirer de script-src : ${sha256('try { window.a = 1; } catch (e) {}')}`));
  assert.ok(checkPage(page.replace('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js ', ''), policy, catalogue).some(problem => /^à ajouter à script-src : https:\/\/cdn\.jsdelivr\.net/.test(problem)));
  assert.ok(checkPage(page.replace("'unsafe-eval'", "'unsafe-eval' https://autre.test/x.js"), policy, catalogue).includes('à retirer de script-src : https://autre.test/x.js'));
  assert.deepEqual(checkPage(page.replace("script-src 'self' 'unsafe-eval'", "script-src 'unsafe-eval' 'self'"), policy, catalogue), ['script-src n\'est pas écrit comme l\'outil l\'écrit : relancer l\'outil']);
});

test('checkCatalogue : une entrée absente, d\'une autre version ou adresse, une empreinte qui n\'en est pas une, une entrée en trop', () => {
  const items = readAppList(list());
  const catalogue = catalogueOf();
  assert.deepEqual(checkCatalogue(catalogue, items), []);
  assert.match(checkCatalogue({ bibliotheques: [catalogue.bibliotheques[0]] }, items)[0], /marked@15\.0\.12 : absent du catalogue/);
  assert.match(checkCatalogue({ bibliotheques: [{ ...catalogue.bibliotheques[0], version: '3.10.0' }, catalogue.bibliotheques[1]] }, items)[0], /le catalogue dit 3\.10\.0, la liste 3\.10\.1/);
  assert.match(checkCatalogue({ bibliotheques: [catalogue.bibliotheques[0], { ...catalogue.bibliotheques[1], cdn: { ...catalogue.bibliotheques[1].cdn, src: 'https://autre.test/m.js' } }] }, items)[0], /l'adresse du catalogue n'est pas celle de la liste/);
  assert.match(checkCatalogue({ bibliotheques: [{ ...catalogue.bibliotheques[0], cdn: { ...catalogue.bibliotheques[0].cdn, integrite: 'sha384-court' } }, catalogue.bibliotheques[1]] }, items)[0], /n'est pas un sha384/);
  assert.match(checkCatalogue({ bibliotheques: [...catalogue.bibliotheques, { id: 'vieux', version: '1.0.0', cdn: {} }] }, items)[0], /vieux@1\.0\.0 : dans le catalogue mais plus dans la liste/);
});

// Une archive de paquet comme `npm pack` la fait : un dossier `package/` avec le fichier à servir.
function packArchive(dir, paquet, version, files) {
  const staging = join(dir, 'staging', paquet);
  rmSync(staging, { recursive: true, force: true });
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(staging, 'package', name, '..'), { recursive: true });
    writeFileSync(join(staging, 'package', name), text);
  }
  mkdirSync(join(dir, 'paquets'), { recursive: true });
  execFileSync('tar', ['-czf', join(dir, 'paquets', archiveName(paquet, version)), '-C', staging, 'package']);
}

test('generate : le catalogue et la politique s\'écrivent hors ligne pour un paquet npm, l\'empreinte d\'un autre CDN se prend une fois puis le catalogue la garde ; verify le relit', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-bibliotheques-test-'));
  try {
    const root = join(dir, 'app');
    mkdirSync(root);
    writeFileSync(join(root, 'package.json'), JSON.stringify(list()));
    writeFileSync(join(root, 'index.html'), PAGE);
    packArchive(dir, 'jszip', '3.10.1', { 'dist/jszip.min.js': JSZIP });
    const asked = [];
    const options = { packagesDir: join(dir, 'paquets'), fetcher: async url => { asked.push(url); return { bytes: MARKED_BYTES, headers: {} }; } };
    const messages = [];
    await generate(root, options, text => messages.push(text));
    assert.deepEqual(asked, [MARKED], 'l\'autre CDN est lu une fois');
    assert.deepEqual(messages, ['catalogue : 2 fichier(s)\n', 'index.html : réécrite\n']);
    const catalogue = JSON.parse(readFileSync(join(root, 'bibliotheques/catalogue.json'), 'utf8'));
    assert.equal(catalogue.bibliotheques[1].cdn.integrite, integrity(MARKED_BYTES));
    assert.deepEqual(verify(root).problems, []);

    await generate(root, options, text => messages.push(text));
    assert.deepEqual(asked, [MARKED], 'le catalogue garde l\'empreinte vue : pas de seconde lecture');
    assert.equal(messages.at(-1), 'index.html : inchangée\n');

    writeFileSync(join(root, 'index.html'), readFileSync(join(root, 'index.html'), 'utf8').replace('window.a = 1', 'window.a = 2'));
    assert.match(verify(root).problems.join('|'), /index\.html : à ajouter à script-src : 'sha256-/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateCatalogue : un autre CDN qui ne répond pas, et que le catalogue ne connaît pas, arrête l\'outil en le disant', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-bibliotheques-test-'));
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify(list()));
    packArchive(dir, 'jszip', '3.10.1', { 'dist/jszip.min.js': JSZIP });
    await assert.rejects(generateCatalogue(dir, { packagesDir: join(dir, 'paquets'), fetcher: async () => { throw new Error('HTTP 503'); } }), /marked : https:\/\/cdnjs\.cloudflare\.com\/\S+ n'a pas répondu \(HTTP 503\) : l'empreinte d'un fichier qui n'est pas celui d'un paquet npm se prend sur son CDN/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('checkCdn : le CDN sert le même fichier, un autre, ou ne répond pas ; sans l\'en-tête CORS ou le type JavaScript, le navigateur refuserait le script', async () => {
  const catalogue = catalogueOf();
  const answer = headers => async url => ({ bytes: url === MARKED ? MARKED_BYTES : JSZIP, headers: { cors: '*', type: 'application/javascript; charset=utf-8', ...headers } });
  assert.deepEqual(await checkCdn(catalogue, answer({})), []);
  assert.deepEqual(await checkCdn(catalogue, async url => (url === MARKED ? MARKED_BYTES : JSZIP)), [], 'sans en-têtes, seuls les octets comptent');
  assert.match((await checkCdn(catalogue, async () => Buffer.from('autre')))[0], /le CDN sert un fichier/);
  assert.match((await checkCdn(catalogue, async () => { throw new Error('HTTP 503'); }))[0], /n'a pas répondu \(HTTP 503\)/);
  assert.match((await checkCdn(catalogue, answer({ cors: null })))[0], /ne donne pas l'en-tête CORS/);
  assert.match((await checkCdn(catalogue, answer({ type: 'text/plain' })))[0], /pas comme du JavaScript/);
  assert.deepEqual(await checkCdn({ bibliotheques: [{ id: 'sans', cdn: null }] }, async () => { throw new Error('ne doit pas être appelé'); }), []);
});

test('integrity : sha384 en base 64, comme l\'attribut integrity', () => {
  assert.equal(integrity(Buffer.from('abc')), 'sha384-ywB1P0WjXou1oD1pmsZQBycsMqsO3tFjGotgWkP/W+2AhgcroefMI1i67KE0yCWn');
  assert.equal(archiveName('@tiptap/core', '3.31.3'), 'tiptap-core-3.31.3.tgz');
});
