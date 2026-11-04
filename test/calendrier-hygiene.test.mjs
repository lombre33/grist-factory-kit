// Les règles propres au module de calendrier (js/calendrier/, css/calendrier.css) : il ne parle ni à Grist ni à la fenêtre, il ne prend au kit que ce que lien-kit.js lui donne, et sa
// feuille n'écrit aucune couleur ni aucun z-index en dur. Les règles de tout le kit (pas de HTML par chaîne, pas de console, 600 lignes) sont dans hygiene.test.mjs, qui lit aussi ce dossier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, fichiersDe } from './sources.mjs';

const scripts = fichiersDe('js', /^calendrier\/.*\.js$/);
const feuilles = fichiersDe('css', /^calendrier\.css$/);

test('le module et sa feuille sont là', () => {
  assert.ok(scripts.length >= 15, `${scripts.length} fichiers dans js/calendrier/`);
  assert.equal(feuilles.length, 1);
});

// Les imports : des fichiers du module, par chemin relatif ; le reste du kit seulement par lien-kit.js, qui n'importe que ces fichiers-là.
test('le module n\'importe rien hors de lui, sauf lien-kit.js qui prend au kit h et createI18n', () => {
  for (const { file, text } of scripts) {
    for (const [, cible] of text.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+'([^']+)'/gm)) {
      const chemin = new URL(cible, `file:///${file}`).pathname.slice(1);
      if (file === 'js/calendrier/lien-kit.js') assert.match(chemin, /^js\/(dom|i18n)\.js$/, `${file} importe ${cible}`);
      else assert.ok(chemin.startsWith('js/calendrier/'), `${file} importe ${cible} sans passer par lien-kit.js`);
    }
  }
});

test('le module ne parle ni à Grist ni à la fenêtre : pas de grist, window, parent, postMessage, document.body, stockage', () => {
  for (const { file, text } of scripts) {
    assert.doesNotMatch(code(text), /\bgrist\b|\bwindow\b|\bparent\b|\bpostMessage\b|\bdocument\.body\b|\bonmessage\b|\blocalStorage\b|\bsessionStorage\b/, file);
  }
});

test('aucune couleur ni z-index en dur dans la feuille (les jetons du kit)', () => {
  for (const { file, text } of feuilles) {
    assert.doesNotMatch(text.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|z-index\s*:\s*-?\d/, file);
  }
});

test('le module n\'a aucun prénom de personne dans son code', () => {
  for (const { file, text } of scripts) assert.doesNotMatch(code(text), /\b(Antoine|Camille|Alex|Claude)\b/, file);
});
