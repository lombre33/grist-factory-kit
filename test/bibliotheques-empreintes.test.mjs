// Les empreintes que le code d'une app écrit à côté des adresses de ses scripts (outils/bibliotheques/empreintes.mjs) : reportées depuis le catalogue, vérifiées, et une adresse cachée est dite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkLiterals, readCodeSpec, readLiterals, rewriteLiterals, writeLiterals } from '../outils/bibliotheques/empreintes.mjs';
import { integrity } from '../outils/bibliotheques/primitives.mjs';
import { generate, verify } from '../outils/bibliotheques/app.mjs';

const MARKED = 'https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.12/marked.min.js';
const GOOD = integrity(Buffer.from('marked'));
const OLD = integrity(Buffer.from('ancien marked'));
const catalogue = { bibliotheques: [{ id: 'marked', version: '15.0.12', cdn: { src: MARKED, integrite: GOOD } }] };
const code = sri => `const MARKED_LIB = { src: '${MARKED}', integrity: '${sri}' };\n`;

test('readCodeSpec : rien sans déclaration, des dossiers relatifs sinon', () => {
  assert.equal(readCodeSpec({ gfs: {} }), null);
  assert.deepEqual(readCodeSpec({ gfs: { code: { dossiers: ['js', 'extensions'] } } }), { dossiers: ['js', 'extensions'] });
  for (const dossiers of [[], 'js', ['../dehors'], ['/abs']]) assert.throws(() => readCodeSpec({ gfs: { code: { dossiers } } }), /gfs\.code\.dossiers/, JSON.stringify(dossiers));
});

test('rewriteLiterals et checkLiterals : l\'empreinte du code devient celle du catalogue, guillemets doubles et plusieurs lignes compris ; le reste du code ne bouge pas', () => {
  assert.deepEqual(checkLiterals(code(OLD), catalogue), [`${MARKED} : l'empreinte écrite (${OLD}) n'est pas celle du catalogue (${GOOD})`]);
  assert.deepEqual(checkLiterals(code(GOOD), catalogue), []);
  const result = rewriteLiterals(`// avant\n${code(OLD)}const autre = { src: 'x', integrity: 'y' };\n`, catalogue);
  assert.equal(result.text, `// avant\n${code(GOOD)}const autre = { src: 'x', integrity: 'y' };\n`);
  assert.deepEqual(result.unknown, []);
  const multi = `const L = {\n  src: "${MARKED}",\n  integrity: "${OLD}",\n};\n`;
  assert.equal(rewriteLiterals(multi, catalogue).text, `const L = {\n  src: "${MARKED}",\n  integrity: "${GOOD}",\n};\n`);
  assert.equal(rewriteLiterals(code(GOOD), catalogue).text, code(GOOD), 'idempotent');
});

test('une adresse écrite avec une empreinte et absente de la liste est dite, jamais devinée ni réécrite', () => {
  const hidden = `const X = { src: 'https://cdn.example.test/x@1.0.0/x.min.js', integrity: '${OLD}' };\n`;
  assert.deepEqual(rewriteLiterals(hidden, catalogue), { text: hidden, unknown: ['https://cdn.example.test/x@1.0.0/x.min.js'] });
  assert.match(checkLiterals(hidden, catalogue)[0], /écrite avec une empreinte, mais pas dans la liste/);
});

test('writeLiterals et readLiterals : les fichiers de js/ et ses sous-dossiers, pas node_modules ; le dossier absent est dit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-empreintes-test-'));
  try {
    mkdirSync(join(dir, 'js/sous'), { recursive: true });
    mkdirSync(join(dir, 'js/node_modules'), { recursive: true });
    writeFileSync(join(dir, 'js/a.js'), code(OLD));
    writeFileSync(join(dir, 'js/sous/b.mjs'), code(GOOD));
    writeFileSync(join(dir, 'js/node_modules/c.js'), code(OLD));
    const spec = { dossiers: ['js'] };
    assert.deepEqual(readLiterals(dir, spec, catalogue).map(problem => problem.split(' : ')[0]), ['js/a.js']);
    assert.deepEqual(writeLiterals(dir, spec, catalogue), { changed: ['js/a.js'], unknown: [] });
    assert.deepEqual(readLiterals(dir, spec, catalogue), []);
    assert.equal(readFileSync(join(dir, 'js/node_modules/c.js'), 'utf8'), code(OLD), 'les paquets installés ne se touchent pas');
    assert.throws(() => writeLiterals(dir, { dossiers: ['absent'] }, catalogue), /absent n'existe pas dans l'app/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generate et verify : l\'empreinte écrite dans le code suit le catalogue ; une adresse cachée arrête l\'outil', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-empreintes-test-'));
  try {
    mkdirSync(join(dir, 'js'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { marked: '15.0.12' }, gfs: { bibliotheques: { marked: { paquet: 'marked', src: MARKED } }, code: { dossiers: ['js'] } } }));
    writeFileSync(join(dir, 'js/m.js'), code(OLD));
    const options = { fetcher: async () => Buffer.from('marked') };
    const messages = [];
    await generate(dir, options, text => messages.push(text));
    assert.deepEqual(messages, ['catalogue : 1 fichier(s)\n', 'code : 1 fichier(s) réécrit(s) (js/m.js)\n']);
    assert.equal(readFileSync(join(dir, 'js/m.js'), 'utf8'), code(GOOD));
    assert.deepEqual(verify(dir).problems, []);
    writeFileSync(join(dir, 'js/m.js'), code(OLD));
    assert.match(verify(dir).problems[0], /js\/m\.js : .*l'empreinte écrite .* n'est pas celle du catalogue/);
    writeFileSync(join(dir, 'js/cache.js'), `const X = { src: 'https://cdn.example.test/x@1.0.0/x.js', integrity: '${OLD}' };\n`);
    await assert.rejects(generate(dir, options, () => {}), /js\/cache\.js : https:\/\/cdn\.example\.test\/x@1\.0\.0\/x\.js/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
