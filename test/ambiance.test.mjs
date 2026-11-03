// L'ambiance de GFS chez l'app : le message d'ambiance lu avec méfiance (js/ambiance-message.js) et posé sur la page par le CSSOM (js/ambiance-pose.js, branché sur le lien et le thème du kit par js/ambiance.js). Le message d'essai est un vrai message de GFS
// (`ambianceMessage('pop', '#6d4fd6')`, GFS à b3513f5) ; ce que GFS envoie vraiment se mesure dans son labo (`run-theme.mjs`, `run-ambiance-kit.mjs`), avec une app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLOR_TOKENS, SHAPE_TOKENS, normalizeAmbiance } from '../js/ambiance-message.js';
import { paintAmbiance, createAmbiance } from '../js/ambiance-pose.js';
import { Ambiance } from '../js/ambiance.js';

const SAMPLE = JSON.parse(readFileSync(new URL('./ambiance-exemple.json', import.meta.url), 'utf8'));
const sample = () => structuredClone(SAMPLE);

// Le <html> d'une page pour l'essai : ses propriétés en ligne, dans l'ordre où elles ont été posées.
function root(initial = {}) {
  const props = new Map(Object.entries(initial));
  return { props, style: { setProperty: (name, value) => props.set(name, value), removeProperty: name => props.delete(name), getPropertyValue: name => props.get(name) || '' } };
}

test('le message de GFS est lu tel quel : tous ses jetons sont connus, rien n\'est perdu', () => {
  assert.deepEqual(normalizeAmbiance(sample()), SAMPLE);
  assert.equal(Object.keys(SAMPLE.clair).length, 19);
  assert.equal(Object.keys(SAMPLE.sombre).length, 19);
  assert.ok(Object.keys(SAMPLE.forme).length > 20);
  for (const name of [...Object.keys(SAMPLE.clair), ...Object.keys(SAMPLE.sombre)]) assert.ok(COLOR_TOKENS.includes(name), name);
  for (const name of Object.keys(SAMPLE.forme)) assert.ok(SHAPE_TOKENS.includes(name), name);
});

test('les listes de jetons : des noms de la forme `--[a-z0-9-]+`, sans doublon, couleur et forme séparées', () => {
  for (const list of [COLOR_TOKENS, SHAPE_TOKENS]) {
    assert.equal(new Set(list).size, list.length);
    for (const name of list) assert.match(name, /^--[a-z0-9-]+$/);
  }
  assert.deepEqual(COLOR_TOKENS.filter(name => SHAPE_TOKENS.includes(name)), []);
});

test('ce qui n\'est pas un message d\'ambiance vaut null : l\'app garde ses couleurs', () => {
  for (const raw of [null, undefined, 'pop', 3, [], [SAMPLE], {}, { id: 'pop' }, { ...sample(), id: 'Pop' }, { ...sample(), id: '' }, { ...sample(), id: 'p'.repeat(40) }, { id: 'pop', clair: {}, sombre: {} }]) {
    assert.equal(normalizeAmbiance(raw), null, JSON.stringify(raw) && JSON.stringify(raw).slice(0, 40));
  }
});

test('une couleur qui n\'est pas un `#rrggbb`, et un jeton que l\'app ne connaît pas, ne sont pas posés', () => {
  const raw = sample();
  raw.clair['--accent'] = 'red';
  raw.clair['--bg'] = 'url(https://example.com/x.png)';
  raw.clair['--surface'] = '#fff';
  raw.clair['--text'] = 12;
  raw.clair['--pirate'] = '#000000';
  raw.clair['--accent-hover'] = '#ABCDEF';
  raw.sombre['pas-un-jeton'] = '#000000';
  const message = normalizeAmbiance(raw);
  assert.deepEqual(Object.keys(message.clair), COLOR_TOKENS.filter(name => !['--accent', '--bg', '--surface', '--text'].includes(name)));
  assert.equal(message.clair['--accent-hover'], '#abcdef', 'les majuscules sont ramenées en minuscules');
  assert.equal(message.clair['--pirate'], undefined);
  assert.equal(message.sombre['pas-un-jeton'], undefined);
});

test('une valeur de forme qui sort de sa déclaration est ignorée : `;`, `{`, `}`, `url(`, `@import`, vide, trop longue', () => {
  const raw = sample();
  const bad = {
    '--radius-md': '14px; background: red', '--radius-lg': '18px } body { display: none', '--shadow-panel': 'url(https://example.com/x)', '--wash': '@import "x.css"',
    '--font-head': 'URL(x)', '--stripe': '   ', '--wash-size': 'x'.repeat(601), '--gap': 4,
  };
  Object.assign(raw.forme, bad, { '--pirate': '1px', '--bw': ' 2px ' });
  const { forme } = normalizeAmbiance(raw);
  for (const name of Object.keys(bad)) assert.equal(forme[name], undefined, name);
  assert.equal(forme['--pirate'], undefined, 'un jeton de forme inconnu');
  assert.equal(forme['--bw'], '2px', 'les blancs de bord sont retirés');
  assert.equal(forme['--radius-sm'], SAMPLE.forme['--radius-sm'], 'les autres sont gardées');
});

test('`couleur` et `ajustee` : la couleur libre en minuscules ou null, « ajustée » seulement quand c\'est vrai', () => {
  assert.equal(normalizeAmbiance({ ...sample(), couleur: '#6D4FD6' }).couleur, '#6d4fd6');
  for (const couleur of ['violet', '#6d4', 12, null, undefined]) assert.equal(normalizeAmbiance({ ...sample(), couleur }).couleur, null, String(couleur));
  assert.equal(normalizeAmbiance({ ...sample(), ajustee: true }).ajustee, true);
  for (const ajustee of ['true', 1, null, undefined]) assert.equal(normalizeAmbiance({ ...sample(), ajustee }).ajustee, false, String(ajustee));
});

test('un seul mode suffit : l\'autre est vide, le message reste valable', () => {
  const raw = sample();
  delete raw.sombre;
  const message = normalizeAmbiance(raw);
  assert.equal(Object.keys(message.sombre).length, 0);
  assert.equal(Object.keys(message.clair).length, 19);
});

test('le message rendu est une copie : le modifier ne change pas l\'original', () => {
  const raw = sample();
  const message = normalizeAmbiance(raw);
  message.clair['--accent'] = '#000000';
  message.forme['--bw'] = '9px';
  assert.equal(raw.clair['--accent'], SAMPLE.clair['--accent']);
  assert.equal(raw.forme['--bw'], SAMPLE.forme['--bw']);
});

test('paintAmbiance pose la forme et les couleurs du mode, et ne retire que ce qu\'elle avait posé', () => {
  const html = root({ 'color-scheme': 'dark', '--mon-jeton': '3px' });
  const message = normalizeAmbiance(sample());
  const light = paintAmbiance(html, message, false);
  assert.equal(html.props.get('--accent'), SAMPLE.clair['--accent']);
  assert.equal(html.props.get('--radius-md'), SAMPLE.forme['--radius-md']);
  assert.equal(light.length, 19 + Object.keys(SAMPLE.forme).length);
  assert.equal(html.props.get('color-scheme'), 'dark', 'ce que la page avait déjà reste');
  const dark = paintAmbiance(html, message, true, light);
  assert.equal(html.props.get('--accent'), SAMPLE.sombre['--accent'], 'le mode sombre remplace les couleurs');
  assert.equal(html.props.get('--radius-md'), SAMPLE.forme['--radius-md'], 'la forme est la même dans les deux modes');
  assert.deepEqual(paintAmbiance(html, null, true, dark), [], 'null retire tout');
  assert.deepEqual([...html.props.keys()], ['color-scheme', '--mon-jeton'], 'et rien d\'autre');
});

test('paintAmbiance : un jeton que la nouvelle ambiance ne redit pas est retiré, pas gardé de la précédente', () => {
  const html = root();
  const first = normalizeAmbiance(sample());
  const posed = paintAmbiance(html, first, false);
  const second = normalizeAmbiance({ ...sample(), id: 'brut', forme: { '--bw': '2px' } });
  paintAmbiance(html, second, false, posed);
  assert.equal(html.props.get('--bw'), '2px');
  assert.equal(html.props.has('--radius-md'), false);
});

// Le lien avec GFS, la page et le mode pour l'essai de `createAmbiance`.
function setup({ message = null, dark = false } = {}) {
  const html = root();
  const listeners = new Set();
  let current = message;
  let release;
  const link = { ambiance: () => (current ? structuredClone(current) : null), onAmbiance: fn => { listeners.add(fn); return () => listeners.delete(fn); }, ready: new Promise(resolve => { release = resolve; }) };
  const observers = [];
  class FakeObserver {
    constructor(callback) { this.callback = callback; this.options = null; this.connected = true; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.connected = false; }
  }
  const media = { listeners: new Set(), addEventListener(type, fn) { if (type === 'change') this.listeners.add(fn); }, removeEventListener(type, fn) { this.listeners.delete(fn); } };
  const state = { dark };
  const ambiance = createAmbiance({ link, doc: { documentElement: html }, win: { MutationObserver: FakeObserver, matchMedia: () => media }, isDark: () => state.dark });
  return {
    html, ambiance, observers, media, state, listeners,
    gfsSays: next => { current = next; for (const fn of [...listeners]) fn(next); },
    arrives: () => release(),
  };
}

test('start : l\'ambiance déjà connue est posée tout de suite, celle qui arrive ensuite l\'est aussi, `null` la retire', async () => {
  const page = setup({ message: normalizeAmbiance(sample()) });
  const handle = page.ambiance.start();
  assert.equal(page.html.props.get('--accent'), SAMPLE.clair['--accent']);
  page.gfsSays(normalizeAmbiance({ ...sample(), clair: { ...SAMPLE.clair, '--accent': '#123456' } }));
  assert.equal(page.html.props.get('--accent'), '#123456');
  page.gfsSays(null);
  assert.equal(page.html.props.size, 0);
  page.arrives();
  await handle.ready;
  assert.equal(page.html.props.size, 0);
});

test('start : avant le contexte rien n\'est posé ; `ready` se règle quand il arrive et que l\'ambiance est posée', async () => {
  const page = setup();
  const handle = page.ambiance.start();
  assert.equal(page.html.props.size, 0);
  page.gfsSays(normalizeAmbiance(sample()));
  page.arrives();
  await handle.ready;
  assert.equal(page.html.props.get('--bg'), SAMPLE.clair['--bg']);
});

test('start : le mode change (le thème de l\'app, celui de Grist, la préférence du système) sans que GFS dise rien, les jetons suivent', () => {
  const page = setup({ message: normalizeAmbiance(sample()) });
  page.ambiance.start();
  assert.deepEqual(page.observers[0].options, { attributes: true, attributeFilter: ['data-theme', 'data-grist-appearance'] }, 'seuls les attributs de mode sont observés : poser un jeton ne se rappelle pas lui-même');
  assert.equal(page.observers[0].target, page.html);
  page.state.dark = true;
  page.observers[0].callback([]);
  assert.equal(page.html.props.get('--accent'), SAMPLE.sombre['--accent']);
  page.state.dark = false;
  [...page.media.listeners].forEach(fn => fn());
  assert.equal(page.html.props.get('--accent'), SAMPLE.clair['--accent']);
});

test('start deux fois rend le même ; stop retire ce qui a été posé, se désabonne et laisse repartir', () => {
  const page = setup({ message: normalizeAmbiance(sample()) });
  const first = page.ambiance.start();
  assert.equal(page.ambiance.start(), first);
  assert.equal(page.observers.length, 1);
  assert.equal(page.listeners.size, 1);
  first.stop();
  assert.equal(page.html.props.size, 0);
  assert.equal(page.listeners.size, 0);
  assert.equal(page.observers[0].connected, false);
  assert.equal(page.media.listeners.size, 0);
  page.ambiance.start();
  assert.equal(page.html.props.get('--accent'), SAMPLE.clair['--accent']);
  assert.equal(page.observers.length, 2);
});

test('start sans matchMedia (un navigateur sans lui) : le reste marche', () => {
  const html = root();
  const link = { ambiance: () => normalizeAmbiance(sample()), onAmbiance: () => () => {}, ready: Promise.resolve() };
  class Observer { observe() {} disconnect() {} }
  const ambiance = createAmbiance({ link, doc: { documentElement: html }, win: { MutationObserver: Observer }, isDark: () => false });
  const handle = ambiance.start();
  assert.equal(html.props.get('--accent'), SAMPLE.clair['--accent']);
  handle.stop();
  assert.equal(html.props.size, 0);
});

test('createAmbiance demande un lien (ambiance, onAmbiance) et un mode (isDark) : sans eux, une erreur qui le dit, jamais une pose à moitié', () => {
  const link = { ambiance: () => null, onAmbiance: () => () => {}, ready: Promise.resolve() };
  for (const options of [undefined, {}, { link }, { isDark: () => false }, { link: {}, isDark: () => false }, { link: { ambiance: () => null }, isDark: () => false }, { link, isDark: true }]) {
    assert.throws(() => createAmbiance(options), /`link` .* et `isDark\(\)` sont demandés/);
  }
});

test('repaint : le mode de l\'app a changé par un autre chemin que les attributs de <html> ou le système (une classe) : la pose est refaite pour le mode affiché', () => {
  const page = setup({ message: normalizeAmbiance(sample()) });
  const handle = page.ambiance.start();
  page.state.dark = true;
  assert.equal(page.html.props.get('--accent'), SAMPLE.clair['--accent'], 'sans rien dire, la page garde le mode d\'avant');
  handle.repaint();
  assert.equal(page.html.props.get('--accent'), SAMPLE.sombre['--accent']);
  assert.equal(page.html.props.size, 19 + Object.keys(SAMPLE.forme).length);
});

test('une app qui a son propre lien : `ambiance-pose.js` n\'importe ni le lien du kit ni son thème, et `ambiance.js` y branche les deux', () => {
  const imports = file => [...readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8').matchAll(/^import .* from '([^']+)';$/gm)].map(match => match[1]).sort();
  assert.deepEqual(imports('ambiance-pose.js'), ['./once.js'], 'un deuxième lien dans un cadre numéroterait ses appels depuis 1 comme le premier et prendrait ses réponses (retrouvées par leur seul `id`)');
  assert.deepEqual(imports('ambiance.js'), ['./ambiance-pose.js', './gfs-link.js', './once.js', './theme.js']);
  assert.equal(typeof Ambiance.start, 'function');
});
