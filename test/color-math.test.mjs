// Le calcul de couleur du sélecteur (js/color-math.js) : des fonctions pures, essayées telles quelles. Ce sont celles de Publipostage+ (son essai unit-color-math.mjs), qui les retire de chez elle
// en prenant le kit : ce que lisent les marques de texte, les fonds de case et le trait des bordures reste donc un « #rrggbb » en minuscules.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ColorMath } from '../js/color-math.js';

const { parseHex, parseCss, toHex, toRgb, rgbToHsv, hsvToRgb, luminance, contrast, inkOn } = ColorMath;

test('parseHex : le # est facultatif, les blancs et la casse sont ignorés, trois chiffres valent six chiffres doublés', () => {
  assert.equal(parseHex('#1e8449'), '#1e8449');
  assert.equal(parseHex('1E8449'), '#1e8449');
  assert.equal(parseHex('  #1E8449 '), '#1e8449');
  assert.equal(parseHex('#1e8'), '#11ee88');
  assert.equal(parseHex('FFF'), '#ffffff');
});

test('parseHex : tout autre texte rend null (cinq chiffres, un caractère non hexadécimal, une opacité, le vide)', () => {
  for (const text of ['#12345', '#gggggg', '#11223344', '#12', '', '   ', null, undefined, 'rouge', '#1e84490']) assert.equal(parseHex(text), null, String(text));
});

test('parseCss : ce que le navigateur relit d\'un style en ligne, « rgb(…) » ou « rgba(…) », devient « #rrggbb »', () => {
  assert.equal(parseCss('#1E8'), '#11ee88');
  assert.equal(parseCss('rgb(30, 132, 73)'), '#1e8449');
  assert.equal(parseCss('rgba(30,132,73,0.5)'), '#1e8449');
  assert.equal(parseCss('rgb(30 132 73 / 50%)'), '#1e8449');
  assert.equal(parseCss('RGB(0, 0, 0)'), '#000000');
});

test('parseCss : un nom de couleur, une valeur vide ou un texte quelconque rendent null (rien à marquer)', () => {
  for (const value of ['red', 'transparent', '', null, undefined, 'hsl(10, 50%, 50%)', 'rgb(1, 2)']) assert.equal(parseCss(value), null, String(value));
});

test('toHex et toRgb : aller-retour, avec des canaux ramenés dans [0, 255]', () => {
  assert.equal(toHex({ r: 30, g: 132, b: 73 }), '#1e8449');
  assert.deepEqual(toRgb('#1e8449'), { r: 30, g: 132, b: 73 });
  assert.equal(toHex({ r: 300, g: -5, b: 127.6 }), '#ff0080');
  for (const hex of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#123456', '#abcdef']) assert.equal(toHex(toRgb(hex)), hex);
});

test('rgbToHsv : les couleurs franches ont leur teinte, un gris et un noir n\'en ont pas (0, à l\'appelant de garder la sienne)', () => {
  assert.deepEqual(rgbToHsv({ r: 255, g: 0, b: 0 }), { h: 0, s: 1, v: 1 });
  assert.deepEqual(rgbToHsv({ r: 0, g: 255, b: 0 }), { h: 120, s: 1, v: 1 });
  assert.deepEqual(rgbToHsv({ r: 0, g: 0, b: 255 }), { h: 240, s: 1, v: 1 });
  assert.deepEqual(rgbToHsv({ r: 255, g: 255, b: 255 }), { h: 0, s: 0, v: 1 });
  assert.deepEqual(rgbToHsv({ r: 0, g: 0, b: 0 }), { h: 0, s: 0, v: 0 });
  assert.equal(rgbToHsv({ r: 255, g: 0, b: 255 }).h, 300);
  assert.equal(rgbToHsv({ r: 255, g: 0, b: 128 }).h.toFixed(1), '329.9');
});

test('hsvToRgb : la teinte tourne sur 360 degrés, dans les deux sens', () => {
  assert.deepEqual(hsvToRgb({ h: 0, s: 1, v: 1 }), { r: 255, g: 0, b: 0 });
  assert.deepEqual(hsvToRgb({ h: 360, s: 1, v: 1 }), { r: 255, g: 0, b: 0 });
  assert.deepEqual(hsvToRgb({ h: -120, s: 1, v: 1 }), { r: 0, g: 0, b: 255 });
  assert.deepEqual(hsvToRgb({ h: 60, s: 1, v: 0.5 }), { r: 128, g: 128, b: 0 });
  assert.deepEqual(hsvToRgb({ h: 200, s: 0, v: 0.5 }), { r: 128, g: 128, b: 128 });
});

test('rgb → hsv → rgb rend la même couleur (le carré de la fenêtre ne change pas une couleur qu\'on lui donne)', () => {
  let seed = 12345;
  const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % 256; };
  for (let i = 0; i < 2000; i++) {
    const rgb = { r: next(), g: next(), b: next() };
    assert.deepEqual(hsvToRgb(rgbToHsv(rgb)), rgb, JSON.stringify(rgb));
  }
});

test('luminance et contraste de la WCAG 2 : 21:1 du noir au blanc, 1:1 d\'une couleur à elle-même, symétrique', () => {
  assert.equal(luminance('#000000'), 0);
  assert.equal(luminance('#ffffff'), 1);
  assert.equal(contrast('#000000', '#ffffff').toFixed(2), '21.00');
  assert.equal(contrast('#2f6fed', '#2f6fed'), 1);
  assert.equal(contrast('#2f6fed', '#ffffff'), contrast('#ffffff', '#2f6fed'));
  assert.equal(contrast('#767676', '#ffffff').toFixed(2), '4.54');
});

test('inkOn : l\'encre, noire ou blanche, qui se lit le mieux sur la couleur (la coche d\'une pastille)', () => {
  assert.equal(inkOn('#ffffff'), '#000000');
  assert.equal(inkOn('#000000'), '#ffffff');
  assert.equal(inkOn('#fff2a8'), '#000000');
  assert.equal(inkOn('#1d4ed8'), '#ffffff');
  for (const hex of ['#ef4444', '#22c55e', '#2f6fed', '#eab308', '#8b5cf6', '#6b7280']) {
    const ink = inkOn(hex);
    const other = ink === '#000000' ? '#ffffff' : '#000000';
    assert.ok(contrast(hex, ink) >= contrast(hex, other), hex);
  }
});
