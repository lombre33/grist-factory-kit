// La feuille de la fenêtre de mise à jour des noms (css/names-update.css) se tient seule. Vu dans le labo de GFS avec la vraie Publipostage+, qui habille ses fenêtres à sa façon et ne charge
// pas css/windows.css : la première version laissait le texte flotter sur la page (ni fond ni bouton), et son `z-index: var(--z-dialog)`, sans ce jeton dans la page, valait `auto` : la
// fenêtre passait SOUS les barres de l'app. Ces essais lisent le texte de la feuille ; la mesure du rendu est celle du labo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { light, tokensCss } from './jetons.mjs';

const css = readFileSync(new URL('../css/names-update.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rule = selector => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} absent`);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
};

test('chaque jeton employé existe dans la charte du kit, sauf `--z-dialog`, qui a un repli', () => {
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)(,[^)]*)?\)/g)].filter(match => !match[2]).map(match => match[1]));
  for (const token of used) assert.ok(token in light || new RegExp(`${token}:`).test(tokensCss), `${token} n'est pas un jeton de la charte`);
});

test('le niveau de la fenêtre a un repli numérique au moins égal à celui des fenêtres (2000) : sans le jeton dans la page, elle ne passe pas sous les barres de l\'app', () => {
  const match = /z-index:\s*var\(--z-dialog,\s*(\d+)\)/.exec(rule('#nu-modal'));
  assert.ok(match, 'z-index sans repli');
  assert.ok(Number(match[1]) >= 2000, match[1]);
});

test('le cadre et le bouton principal ont chacun leur fond : la fenêtre ne dépend pas de css/windows.css', () => {
  assert.match(rule('.nu-box'), /background:\s*var\(--surface\)/);
  assert.match(rule('.nu-box'), /border-radius/);
  assert.match(rule('.nu-box'), /box-shadow/);
  assert.match(rule('.nu-box .pp-modal-actions button.pp-modal-primary'), /background:\s*var\(--accent-solid\)/);
  assert.match(rule('.nu-box .pp-modal-actions button'), /border:\s*1px solid var\(--border-strong\)/);
});

test('aucune couleur en dur dans la feuille (des jetons seulement, clair et sombre)', () => {
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
});
