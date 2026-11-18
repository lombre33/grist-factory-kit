// Le relais des appels bloqués vers GFS (contrats de GFS 5.4, point 14) : le signalement réduit à l'hôte (js/violations-message.js), puis la pose (js/violations-pose.js) : ce qui part, ce qui ne repart
// pas, les plafonds, et rien quand l'app est seule. Une page de poche : un document qui reçoit des écouteurs et un lien qui note ce qu'il dit à GFS. Que le navigateur lève bien l'événement dans un cadre
// d'app, et que GFS le reçoive, se mesure dans le labo de GFS (labo/run-securite-relais.mjs), avec une vraie app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KIT_VERSION, DIRECTIVES, normalizeViolation } from '../js/violations-message.js';
import { MAX_KEYS, MAX_SENT, createViolations } from '../js/violations-pose.js';
import { Violations } from '../js/violations.js';
import { createGfsLink } from '../js/gfs-link.js';

const HOME = 'app.github.io';
const event = (fields = {}) => ({ effectiveDirective: 'connect-src', violatedDirective: "connect-src 'self'", blockedURI: 'https://evil.example/steal?token=SECRET', sourceFile: `https://${HOME}/js/app.js`,
  disposition: 'enforce', ...fields });

test('la version du kit dite à GFS est celle du package', () => {
  assert.equal(KIT_VERSION, JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).version);
});

test('un appel bloqué part réduit à son hôte : jamais le chemin, les paramètres ni le fragment', () => {
  const seen = normalizeViolation(event({ blockedURI: 'https://Evil.Example:8443/a/b?token=SECRET&user=ana#frag' }), HOME);
  assert.deepEqual(seen, { directive: 'connect-src', cible: 'evil.example', source: 'app', disposition: 'enforce' });
  assert.doesNotMatch(JSON.stringify(seen), /SECRET|token|ana|frag|8443/);
});

test('ce que le navigateur dit à la place d\'une adresse se garde ; une adresse qui n\'est pas un nom d\'hôte, une chaîne libre ou un objet valent « autre »', () => {
  for (const word of ['inline', 'eval', 'data', 'blob', 'self', 'wasm-eval']) assert.equal(normalizeViolation(event({ blockedURI: word }), HOME).cible, word);
  assert.equal(normalizeViolation(event({ blockedURI: 'EVAL' }), HOME).cible, 'eval');
  for (const blocked of ['', 'pas une adresse', 'https://[::1]/x', 'javascript:alert(1)', '<img src=x onerror=alert(1)>', 'https://' + 'a'.repeat(120) + '.example/', undefined, null, 42, {}]) {
    assert.equal(normalizeViolation(event({ blockedURI: blocked }), HOME).cible, 'autre', String(blocked));
  }
  assert.equal(normalizeViolation(event({ blockedURI: 'https://192.168.0.12:8080/x' }), HOME).cible, '192.168.0.12', 'une adresse IP de réseau local est dite : c\'est ce qu\'on cherche');
});

test('la directive est un nom connu (le premier mot), sinon « autre » ; sans effectiveDirective, violatedDirective', () => {
  assert.equal(normalizeViolation(event({ effectiveDirective: undefined, violatedDirective: "script-src-elem 'self' https://x" }), HOME).directive, 'script-src-elem');
  assert.equal(normalizeViolation(event({ effectiveDirective: 'CONNECT-SRC' }), HOME).directive, 'connect-src');
  for (const directive of ['', 'plugin-types', '<script>', 'connect-src; img-src', undefined, 5]) assert.equal(normalizeViolation(event({ effectiveDirective: directive, violatedDirective: undefined }), HOME).directive, 'autre', String(directive));
  assert.ok(DIRECTIVES.every(name => /^[a-z-]+$/.test(name)));
});

test('qui a demandé : le code de l\'app, une bibliothèque par son hôte, personne de connu, autre chose', () => {
  assert.equal(normalizeViolation(event({ sourceFile: `https://${HOME}/x.js` }), HOME).source, 'app');
  assert.equal(normalizeViolation(event({ sourceFile: 'https://esm.sh/tiptap@3/x.js' }), HOME).source, 'esm.sh');
  assert.equal(normalizeViolation(event({ sourceFile: '' }), HOME).source, 'inconnue');
  assert.equal(normalizeViolation(event({ sourceFile: undefined }), HOME).source, 'inconnue');
  assert.equal(normalizeViolation(event({ sourceFile: 'blob:https://x/uuid' }), HOME).source, 'autre');
});

test('« report » reste « report », tout le reste est « enforce » ; un événement qui n\'en est pas un ne fait pas planter', () => {
  assert.equal(normalizeViolation(event({ disposition: 'report' }), HOME).disposition, 'report');
  for (const disposition of ['enforce', 'autre', undefined, 3]) assert.equal(normalizeViolation(event({ disposition }), HOME).disposition, 'enforce');
  for (const nothing of [null, undefined, 'x', 12, []]) assert.deepEqual(normalizeViolation(nothing, HOME), { directive: 'autre', cible: 'autre', source: 'inconnue', disposition: 'enforce' });
});

// ---------- la pose ----------
function poche({ hosted = true } = {}) {
  const listeners = new Set();
  const doc = { addEventListener: (type, fn) => { if (type === 'securitypolicyviolation') listeners.add(fn); }, removeEventListener: (type, fn) => { if (type === 'securitypolicyviolation') listeners.delete(fn); } };
  const told = [];
  const link = { hosted, tell: (name, args) => { told.push({ name, args: structuredClone(args) }); return hosted; } };
  const fire = fields => listeners.forEach(fn => fn(event(fields)));
  return { doc, link, told, listeners, fire };
}

test('au démarrage : un message « relais » avec la version du kit, une seule écoute, même après deux démarrages', () => {
  const page = poche();
  const relay = createViolations({ link: page.link, doc: page.doc, home: HOME });
  assert.equal(relay.active(), false);
  assert.equal(relay.start(), relay);
  relay.start();
  assert.equal(page.listeners.size, 1);
  assert.deepEqual(page.told, [{ name: 'securite', args: { quoi: 'relais', kit: KIT_VERSION } }]);
  assert.equal(relay.active(), true);
});

test('une violation part avec son hôte et son compte ; la même ne repart qu\'à la 10e, 100e et 1000e fois ; une autre repart tout de suite', () => {
  const page = poche();
  createViolations({ link: page.link, doc: page.doc, home: HOME }).start();
  for (let i = 0; i < 12; i += 1) page.fire();
  const sent = page.told.slice(1).map(entry => entry.args);
  assert.deepEqual(sent.map(args => args.fois), [1, 10]);
  assert.deepEqual(sent[0], { quoi: 'bloque', directive: 'connect-src', cible: 'evil.example', source: 'app', disposition: 'enforce', fois: 1 });
  page.fire({ blockedURI: 'https://other.example/' });
  assert.equal(page.told.at(-1).args.cible, 'other.example');
  for (let i = 0; i < 1100; i += 1) page.fire();
  assert.deepEqual(page.told.map(entry => entry.args.fois).filter(Boolean).filter(times => times > 1), [10, 100, 1000]);
});

test('un code piraté ne peut pas noyer GFS : au plus 50 violations différentes et 200 messages par page', () => {
  const page = poche();
  const relay = createViolations({ link: page.link, doc: page.doc, home: HOME });
  relay.start();
  for (let i = 0; i < MAX_KEYS + 30; i += 1) page.fire({ blockedURI: `https://h${i}.example/` });
  assert.equal(page.told.length - 1, MAX_KEYS);
  const crowded = poche();
  const many = createViolations({ link: crowded.link, doc: crowded.doc, home: HOME });
  many.start();
  for (let key = 0; key < MAX_KEYS; key += 1) for (let times = 0; times < 1001; times += 1) crowded.fire({ blockedURI: `https://k${key}.example/` });
  assert.ok(many.sent() <= MAX_SENT, `${many.sent()} messages`);
});

test('seule (GFS n\'héberge pas l\'app), rien n\'écoute ni ne part ; après `stop`, plus rien ne part et l\'écoute est retirée', () => {
  const alone = poche({ hosted: false });
  const relay = createViolations({ link: alone.link, doc: alone.doc, home: HOME });
  relay.start();
  alone.fire();
  assert.equal(alone.listeners.size, 0);
  assert.deepEqual(alone.told, []);
  const page = poche();
  const live = createViolations({ link: page.link, doc: page.doc, home: HOME });
  live.start();
  live.stop();
  page.fire();
  assert.equal(page.listeners.size, 0);
  assert.equal(page.told.length, 1, 'seulement le « relais » du départ');
  live.start();
  assert.equal(page.listeners.size, 1, 'redémarré');
});

test('sans lien qui sache `hosted` et `tell`, la pose le dit au lieu de ne rien faire', () => {
  for (const link of [undefined, null, {}, { hosted: true }, { tell: () => true }]) assert.throws(() => createViolations({ link, doc: {} }), TypeError);
});

test('`Violations` est la pose branchée sur le lien du kit ; seul, il n\'écoute rien', () => {
  assert.equal(typeof Violations.start, 'function');
  assert.equal(Violations.start().active(), false, 'sous Node, GFS n\'héberge rien');
});

test('GfsLink.tell : un appel sans id, au cadre parent ; faux quand l\'app est seule', async () => {
  const sent = [];
  const parent = { postMessage: (message, origin) => sent.push({ message: structuredClone(message), origin }) };
  const host = { location: { search: '?gfs=0' }, parent, addEventListener: () => {} };
  const warn = console.warn;
  console.warn = () => {};
  const link = createGfsLink({ host, timeoutMs: 5 });
  assert.equal(link.tell('securite', { quoi: 'relais' }), true);
  const message = sent.at(-1).message;
  assert.deepEqual(message, { gfs: 0, type: 'appel', nom: 'securite', args: { quoi: 'relais' } });
  assert.equal('id' in message, false);
  assert.equal(link.tell('securite'), true);
  assert.equal('args' in sent.at(-1).message, false);
  await link.ready.catch(() => {});
  console.warn = warn;
  const alone = createGfsLink({ host: { location: { search: '' }, parent: null, addEventListener: () => {} } });
  assert.equal(alone.tell('securite', {}), false);
});
