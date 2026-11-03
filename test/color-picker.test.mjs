// Le sélecteur de couleur lu sans navigateur : la palette (dix colonnes, cinq rangées, des #rrggbb en minuscules, des tons qui se lisent), les textes (chaque clé employée existe en français et en anglais,
// et chaque clé existante est employée), la feuille de style (des jetons définis, des couleurs propres seulement là où ce sont celles qu'on choisit). Les gestes sont aux essais du navigateur
// (navigateur/scenarios-couleur.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COLOR_ROWS, COLOR_COLUMNS } from '../js/color-palette.js';
import { COLOR_STRINGS } from '../js/color-strings.js';
import { KIT_STRINGS, I18n } from '../js/i18n.js';
import { ColorMath } from '../js/color-math.js';
import { light, darkChosen } from './jetons.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('css/color-picker.css');
const sources = { 'js/color-palette.js': read('js/color-palette.js'), 'js/color-dialog.js': read('js/color-dialog.js') };
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

test('la palette : cinq rangées de dix couleurs, des #rrggbb en minuscules, aucune en double', () => {
  assert.equal(COLOR_ROWS.length, 5);
  assert.equal(COLOR_COLUMNS, 10);
  for (const row of COLOR_ROWS) {
    assert.equal(row.length, COLOR_COLUMNS);
    for (const color of row) assert.match(color, /^#[0-9a-f]{6}$/);
  }
  const all = COLOR_ROWS.flat();
  assert.equal(new Set(all).size, all.length);
  assert.ok(Object.isFrozen(COLOR_ROWS) && COLOR_ROWS.every(Object.isFrozen));
});

test('la palette : la première rangée est celle des gris, du noir au blanc ; la deuxième se lit en texte sur une page blanche (4,5:1 au moins)', () => {
  const [grays, dark] = COLOR_ROWS;
  assert.equal(grays[0], '#000000');
  assert.equal(grays[grays.length - 1], '#ffffff');
  const lightness = grays.map(ColorMath.luminance);
  assert.deepEqual([...lightness].sort((a, b) => a - b), lightness, 'du plus foncé au plus clair');
  for (const color of dark) assert.ok(ColorMath.contrast(color, '#ffffff') >= 4.5, `${color} : ${ColorMath.contrast(color, '#ffffff').toFixed(2)}:1`);
});

test('la coche d\'une pastille se lit sur sa couleur : l\'encre que choisit inkOn tient 4,5:1 sur chacune des cinquante', () => {
  for (const color of COLOR_ROWS.flat()) {
    const ink = ColorMath.inkOn(color);
    assert.ok(ColorMath.contrast(color, ink) >= 4.5, `${color} sous ${ink} : ${ColorMath.contrast(color, ink).toFixed(2)}:1`);
  }
});

test('les textes : les clés employées par les modules existent, chaque clé existante est employée, français et anglais côte à côte', () => {
  const used = new Set();
  for (const text of Object.values(sources)) for (const [, key] of text.matchAll(/'(kit\.color\.[A-Za-z]+)'/g)) used.add(key);
  // Les noms de canaux : `kit.color.${name}` (red, green, blue) et `kit.color.${key}` (r, g, b), écrits une fois en boucle.
  for (const name of ['red', 'green', 'blue', 'r', 'g', 'b']) used.add(`kit.color.${name}`);
  assert.match(sources['js/color-dialog.js'], /`kit\.color\.\$\{name\}`/);
  assert.match(sources['js/color-dialog.js'], /`kit\.color\.\$\{key\}`/);
  for (const key of used) assert.ok(key in COLOR_STRINGS, `${key} n'existe pas`);
  for (const key of Object.keys(COLOR_STRINGS)) assert.ok(used.has(key), `${key} n'est employée nulle part`);
  for (const [key, entry] of Object.entries(COLOR_STRINGS)) {
    assert.match(key, /^kit\.color\./);
    assert.equal(typeof entry.fr, 'string', key);
    assert.equal(typeof entry.en, 'string', key);
  }
});

test('les textes du sélecteur sont ceux du kit : I18n.t les rend sans rien déclarer, dans la langue de la page', () => {
  for (const key of Object.keys(COLOR_STRINGS)) assert.equal(KIT_STRINGS[key], COLOR_STRINGS[key]);
  assert.equal(I18n.t('kit.color.apply'), 'Appliquer');
  assert.equal(I18n.t('kit.color.forget', { color: '#FF0000' }), 'Retirer #FF0000 de la liste');
  I18n.setLanguage('en');
  try {
    assert.equal(I18n.t('kit.color.apply'), 'Apply');
    assert.equal(I18n.t('kit.color.areaValue', { s: 40, v: 90 }), 'Saturation 40%, brightness 90%');
  } finally { I18n.setLanguage('fr'); }
});

test('la feuille : seuls le carré, la teinte et leurs curseurs portent une couleur à eux (celles qu\'on choisit) ; aucun z-index', () => {
  const rules = [...withoutComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.trim(), body }));
  assert.ok(rules.length > 40);
  for (const { selector, body } of rules) {
    if (!/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(body.replace(/color-mix\([^)]*\)/g, ''))) continue;
    for (const part of selector.split(',')) assert.match(part.trim(), /^\.cp-(area|thumb|hue)\b/, `couleur en dur dans « ${part.trim()} »`);
  }
  for (const [, value] of withoutComments(css).matchAll(/z-index:\s*([^;}]+)/g)) assert.match(value.trim(), /^\d{1,2}$/, `z-index : un petit rang local seulement, pas ${value}`);
  assert.doesNotMatch(css, /@font-face|@import|url\(/);
});

test('la feuille n\'emploie que des jetons de la charte, ou ceux que le code pose lui-même (--swatch, --ink, --hue)', () => {
  const defined = new Set([...Object.keys(light), ...Object.keys(darkChosen), '--swatch', '--ink', '--hue']);
  const used = new Set([...withoutComments(css).matchAll(/var\((--[a-z0-9-]+)/g)].map(match => match[1]));
  assert.ok(used.size >= 8);
  for (const name of used) assert.ok(defined.has(name), `${name} n'est défini nulle part`);
  const posed = readFileSync(new URL('../js/color-palette.js', import.meta.url), 'utf8') + readFileSync(new URL('../js/color-dialog.js', import.meta.url), 'utf8');
  for (const name of ['--swatch', '--ink', '--hue']) assert.ok(posed.includes(`'${name}'`), `${name} n'est posé par aucun module`);
});
