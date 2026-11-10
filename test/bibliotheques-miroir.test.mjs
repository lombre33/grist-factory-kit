// Le miroir des essais d'une app, refait d'après sa liste (outils/bibliotheques/miroir.mjs) : ce qu'il fait (le plan), puis ce qu'il pose dans le dossier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { buildMirror, mirrorPlan, moduleName } from '../outils/bibliotheques/miroir.mjs';

const pkg = extra => ({
  dependencies: { marked: '15.0.12', docx: '9.15.1', 'prosemirror-model': '1.25.11', '@tiptap/pm': '3.31.3' },
  devDependencies: { esbuild: '0.25.10', jsqr: '1.4.0' },
  gfs: {
    bibliotheques: {
      docx: { paquet: 'docx', fichier: 'dist/index.iife.js', miroir: { vers: 'umd/docx.iife.js' } },
      marked: { paquet: 'marked', src: 'https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.12/marked.min.js', miroir: { depuis: 'marked.min.js', vers: 'umd/marked.min.js' } },
    },
    carte: { origine: 'https://esm.sh', paquets: ['prosemirror-model', '@tiptap/pm'], uniques: ['prosemirror-model'] },
    miroir: { dossier: 'dev-tests/.offline-cache', prefixe: '/dev-tests/.offline-cache/esm/', sansEsm: ['@tiptap/pm'], supplementaires: [{ paquet: 'jsqr', depuis: 'dist/jsQR.js', vers: 'umd/jsqr.js' }] },
    ...extra,
  },
});
const withMirror = changes => { const value = pkg(); Object.assign(value.gfs.miroir, changes); return value; };

test('mirrorPlan : les versions de la liste, les modules de la carte, les fichiers à copier d\'après la liste ; rien sans déclaration', () => {
  assert.equal(mirrorPlan({ gfs: {} }), null);
  const plan = mirrorPlan(pkg());
  assert.equal(plan.dossier, 'dev-tests/.offline-cache');
  assert.deepEqual(Object.keys(plan.dependencies), ['@tiptap/pm', 'docx', 'esbuild', 'jsqr', 'marked', 'prosemirror-model'], 'les dépendances et les outils, triés');
  assert.equal(plan.dependencies.esbuild, '0.25.10');
  assert.deepEqual(plan.esm, ['prosemirror-model'], '@tiptap/pm est sansEsm');
  assert.deepEqual(plan.copies, [
    { paquet: 'docx', depuis: 'dist/index.iife.js', vers: 'umd/docx.iife.js' },
    { paquet: 'marked', depuis: 'marked.min.js', vers: 'umd/marked.min.js' },
    { paquet: 'jsqr', depuis: 'dist/jsQR.js', vers: 'umd/jsqr.js' },
  ]);
});

test('mirrorPlan : un fichier d\'un autre CDN dit le sien, des chemins sûrs, des paquets de la liste', () => {
  const noFrom = pkg();
  delete noFrom.gfs.bibliotheques.marked.miroir.depuis;
  assert.throws(() => mirrorPlan(noFrom), /marked : miroir\.depuis et miroir\.vers .*depuis est à dire/);
  const escaping = pkg();
  escaping.gfs.bibliotheques.docx.miroir.vers = '../dehors.js';
  assert.throws(() => mirrorPlan(escaping), /docx : miroir\.depuis et miroir\.vers/);
  assert.throws(() => mirrorPlan(withMirror({ dossier: '/tmp' })), /gfs\.miroir\.dossier/);
  assert.throws(() => mirrorPlan(withMirror({ dossier: 'node_modules/x' })), /gfs\.miroir\.dossier/);
  assert.throws(() => mirrorPlan(withMirror({ prefixe: 'esm' })), /gfs\.miroir\.prefixe/);
  assert.throws(() => mirrorPlan(withMirror({ sansEsm: ['inconnu'] })), /sansEsm : inconnu n'est pas dans la carte/);
  assert.throws(() => mirrorPlan(withMirror({ supplementaires: [{ paquet: 'absent', depuis: 'a.js', vers: 'umd/a.js' }] })), /absent n'est pas dans la liste/);
  const missing = pkg();
  delete missing.dependencies.marked;
  assert.throws(() => mirrorPlan(missing), /marked : marked n'est pas dans la liste/);
});

test('moduleName : @tiptap/core devient tiptap__core', () => {
  assert.equal(moduleName('@tiptap/core'), 'tiptap__core');
  assert.equal(moduleName('prosemirror-model'), 'prosemirror-model');
});

// Un faux `npm install` : il pose dans node_modules les fichiers que le plan lit, sans réseau.
function fakeInstall(files) {
  return dir => {
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(join(dir, 'node_modules', name, '..'), { recursive: true });
      writeFileSync(join(dir, 'node_modules', name), text);
    }
  };
}

const hasEsbuild = (() => { try { createRequire(import.meta.url)('esbuild'); return true; } catch (error) { return false; } })();

test('buildMirror : le package.json du miroir, les modules ES construits d\'un tenant, esm-map.json, les fichiers copiés ; un fichier absent du paquet arrête l\'outil', { skip: hasEsbuild ? false : 'esbuild n\'est pas installé' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-miroir-test-'));
  try {
    const messages = [];
    const files = {
      'docx/dist/index.iife.js': 'var docx = {};', 'marked/marked.min.js': 'var marked = {};', 'jsqr/dist/jsQR.js': 'var jsQR = {};',
      'prosemirror-model/package.json': JSON.stringify({ name: 'prosemirror-model', version: '1.25.11', main: 'index.js' }), 'prosemirror-model/index.js': 'export const Schema = class {};',
    };
    const options = { install: fakeInstall(files), loadEsbuild: () => createRequire(import.meta.url)('esbuild') };
    const plan = await buildMirror(dir, pkg(), options, text => messages.push(text));
    const mirror = join(dir, plan.dossier);
    const written = JSON.parse(readFileSync(join(mirror, 'package.json'), 'utf8'));
    assert.equal(written.dependencies.docx, '9.15.1');
    assert.equal(written.dependencies.esbuild, '0.25.10', 'les outils (esbuild) sont installés avec le reste');
    assert.deepEqual(JSON.parse(readFileSync(join(mirror, 'esm-map.json'), 'utf8')), { 'prosemirror-model': '/dev-tests/.offline-cache/esm/prosemirror-model.js' });
    assert.match(readFileSync(join(mirror, 'esm/prosemirror-model.js'), 'utf8'), /Schema/);
    assert.equal(readFileSync(join(mirror, 'umd/docx.iife.js'), 'utf8'), 'var docx = {};');
    assert.equal(readFileSync(join(mirror, 'umd/marked.min.js'), 'utf8'), 'var marked = {};');
    assert.equal(readFileSync(join(mirror, 'umd/jsqr.js'), 'utf8'), 'var jsQR = {};');
    assert.deepEqual(messages, ['miroir : 1 module(s) ES, 3 fichier(s) copié(s) dans dev-tests/.offline-cache\n']);

    writeFileSync(join(mirror, 'umd/reste.js'), 'ancien');
    await buildMirror(dir, pkg(), options, () => {});
    assert.ok(!existsSync(join(mirror, 'umd/reste.js')), 'ce que le miroir ne dit plus est retiré');

    delete files['marked/marked.min.js'];
    rmSync(join(mirror, 'node_modules'), { recursive: true, force: true });
    await assert.rejects(buildMirror(dir, pkg(), { ...options, install: fakeInstall(files) }, () => {}), /marked : marked\.min\.js n'est pas dans le paquet installé/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildMirror : sans `gfs.miroir`, l\'outil le dit', async () => {
  await assert.rejects(buildMirror('/inexistant', { gfs: {} }), /ne déclare pas de miroir/);
});
