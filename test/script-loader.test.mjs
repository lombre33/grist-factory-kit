// Charger un script par un CDN, puis par la copie de GFS (js/script-loader.js ; contrats de GFS 5.2, point 14), face à un document joué par l'essai : ce que la balise porte, ce qui la fait
// tomber sur le secours (erreur, hôte muet), ce qui ne le fait pas (CDN qui charge, pas de secours). Le vrai navigateur, l'empreinte et la politique de sécurité : prototype/test/secours-firefox.mjs de GFS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScript, SECOURS_DELAI } from '../js/script-loader.js';

// Un document dont chaque balise, une fois posée, répond comme le dit `behave(src)` : 'load', 'error' ou rien (un hôte qui ne répond jamais).
function page(behave) {
  const tags = [];
  const doc = {
    createElement: name => { assert.equal(name, 'script'); return { tag: name }; },
    head: { append: tag => { tags.push(tag); const answer = behave(tag.src); if (answer) queueMicrotask(() => tag[answer === 'load' ? 'onload' : 'onerror']()); } },
  };
  return { doc, tags };
}
const CDN = { src: 'https://cdn.example/plotly.js', integrite: 'sha384-cdn', forme: 'script' };
const COPY = { version: '2.13.2', src: 'https://gfs.example/vendor/plotly.js', integrite: 'sha384-copie', forme: 'script' };
const quiet = async run => {
  const warnings = [];
  const original = console.warn;
  console.warn = (...parts) => warnings.push(parts.join(' '));
  try { return { result: await run(), warnings }; } finally { console.warn = original; }
};

test('le CDN charge : une seule balise, avec son empreinte et `crossOrigin`, rien de la copie', async () => {
  const { doc, tags } = page(() => 'load');
  const { result, warnings } = await quiet(() => loadScript(CDN, { secours: COPY, doc }));
  assert.deepEqual(result, { src: CDN.src, secours: false });
  assert.equal(tags.length, 1);
  assert.deepEqual([tags[0].src, tags[0].integrity, tags[0].crossOrigin, tags[0].type], [CDN.src, 'sha384-cdn', 'anonymous', undefined]);
  assert.deepEqual(warnings, []);
});

test('le CDN échoue (hôte mort, empreinte refusée, adresse que la politique ne nomme pas : le même `error`) : la copie de GFS, avec sa propre empreinte', async () => {
  const { doc, tags } = page(src => (src === CDN.src ? 'error' : 'load'));
  const { result, warnings } = await quiet(() => loadScript(CDN, { secours: COPY, doc }));
  assert.deepEqual(result, { src: COPY.src, secours: true });
  assert.deepEqual(tags.map(tag => [tag.src, tag.integrity]), [[CDN.src, 'sha384-cdn'], [COPY.src, 'sha384-copie']]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /la copie de GFS prend le relais/);
});

test('un hôte muet : la minuterie décide, puis la copie ; la copie, dernier recours, n\'a pas de minuterie', async () => {
  const { doc, tags } = page(src => (src === COPY.src ? 'load' : null));
  const started = Date.now();
  const { result } = await quiet(() => loadScript(CDN, { secours: COPY, delai: 40, doc }));
  assert.deepEqual(result, { src: COPY.src, secours: true });
  assert.ok(Date.now() - started >= 35, 'la copie n\'est prise qu\'après le délai');
  assert.equal(tags.length, 2);
  const slow = page(() => null);
  const pending = await Promise.race([quiet(() => loadScript(CDN, { secours: COPY, delai: 20, doc: slow.doc })).then(() => 'réglée'), new Promise(resolve => setTimeout(() => resolve('attend'), 120))]);
  assert.equal(pending, 'attend', 'une copie qui ne répond pas non plus : on attend le navigateur, sans second secours');
  assert.equal(SECOURS_DELAI, 3000, 'le délai par défaut est celui mesuré (faits vérifiés 163 de GFS)');
});

test('sans secours : l\'erreur du CDN remonte, et aucune minuterie ne s\'en mêle (rien ne change pour une app qui n\'en a pas)', async () => {
  const failing = page(() => 'error');
  await assert.rejects(quiet(() => loadScript(CDN, { doc: failing.doc })), /chargement refusé ou en échec : https:\/\/cdn\.example\/plotly\.js/);
  const mute = page(() => null);
  const outcome = await Promise.race([loadScript(CDN, { secours: null, delai: 10, doc: mute.doc }).then(() => 'réglée', () => 'rejetée'), new Promise(resolve => setTimeout(() => resolve('attend'), 80))]);
  assert.equal(outcome, 'attend', 'sans copie à prendre, un délai ne ferait que perdre le CDN qui allait répondre');
});

test('le secours échoue aussi : l\'erreur est celle de la copie', async () => {
  const { doc } = page(() => 'error');
  await assert.rejects(quiet(() => loadScript(CDN, { secours: COPY, doc })), /https:\/\/gfs\.example\/vendor\/plotly\.js/);
});

test('un fichier assemblé (forme `module`) se charge en module, au CDN comme en secours ; `integrity` de l\'app vaut `integrite`', async () => {
  const { doc, tags } = page(src => (src.startsWith('https://cdn.') ? 'error' : 'load'));
  const module = { src: 'https://cdn.example/live.mjs', integrity: 'sha384-app', forme: 'module' };
  await quiet(() => loadScript(module, { secours: { ...COPY, src: 'https://gfs.example/live.mjs', forme: 'module' }, doc }));
  assert.deepEqual(tags.map(tag => [tag.type, tag.integrity]), [['module', 'sha384-app'], ['module', 'sha384-copie']]);
});

test('sans empreinte, ni `integrity` ni `crossOrigin` (un fichier du dépôt de l\'app : même origine)', async () => {
  const { doc, tags } = page(() => 'load');
  await loadScript({ src: './vendor/x.js' }, { doc });
  assert.deepEqual([tags[0].integrity, tags[0].crossOrigin], [undefined, undefined]);
});
