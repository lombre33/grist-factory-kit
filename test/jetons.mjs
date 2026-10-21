// Les jetons de css/tokens.css lus tels quels, pour les essais sous Node (test/tokens.test.mjs) et ceux du navigateur (navigateur/essais.mjs) : une seule lecture, aucune valeur recopiée.
import { readFileSync } from 'node:fs';

export const tokensCss = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
export const windowsCss = readFileSync(new URL('../css/windows.css', import.meta.url), 'utf8');

// Le bloc qui suit un sélecteur, accolades comprises.
export function blockAfter(css, selector) {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`${selector} absent`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`${selector} jamais refermé`);
}
// Les jetons d'un bloc : « --nom: valeur; » (toute valeur, sur une ligne).
export const declared = block => Object.fromEntries([...block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
export const hexOnly = set => Object.fromEntries(Object.entries(set).filter(([, value]) => /^#[0-9a-fA-F]{6}$/.test(value)));

export const light = declared(blockAfter(tokensCss, ':root {'));
export const darkChosen = declared(blockAfter(tokensCss, ':root[data-theme="dark"],'));
export const darkSystem = declared(blockAfter(tokensCss, ':root:not([data-theme]):not([data-grist-appearance]) {'));
export const dark = { ...light, ...darkChosen };

// Contraste de deux couleurs (WCAG), en #rrggbb ou [r, g, b].
const channel = value => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const rgbOf = color => (typeof color === 'string' && color.startsWith('#') ? [16, 8, 0].map(shift => (parseInt(color.slice(1), 16) >> shift) & 255) : color);
const luminance = color => { const [r, g, b] = rgbOf(color); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); };
export const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
// « #2f6fed » comme le navigateur le rend : « rgb(47, 111, 237) ».
export const cssRgb = hex => `rgb(${rgbOf(hex).join(', ')})`;
