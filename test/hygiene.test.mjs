// Les règles du dépôt qui se lisent dans le code : le kit n'importe rien d'extérieur, ne construit pas de HTML par chaîne, ne remplace pas l'écoute des messages de Grist, n'écrit rien
// dans la console, ne dépasse pas les seuils de l'outil d'audit (600 lignes de code par fichier). La mesure des fonctions et de la complexité est celle de l'outil d'audit lui-même
// (voir README, « Contrôles »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = name => new URL(`../${name}/`, import.meta.url);
const files = name => readdirSync(dir(name)).filter(file => /\.(js|css)$/.test(file)).map(file => ({ file: `${name}/${file}`, text: readFileSync(new URL(file, dir(name)), 'utf8') }));
const sources = files('js');
const sheets = files('css');

// Le code sans ses commentaires ni ses chaînes : ce que les règles visent. Une chaîne de caractères ou un commentaire qui cite `innerHTML` pour l'interdire n'est pas un emploi.
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

test('le kit a des modules et des feuilles à tester', () => {
  assert.ok(sources.length >= 7);
  assert.ok(sheets.length >= 2);
});

test('le kit n\'importe rien d\'extérieur : que des fichiers du kit, par des chemins relatifs', () => {
  for (const { file, text } of sources) {
    for (const [, specifier] of text.matchAll(/^\s*import\s[^;]*?from\s+'([^']+)'/gm)) assert.match(specifier, /^\.\/[a-z0-9-]+\.js$/, `${file} importe ${specifier}`);
    assert.doesNotMatch(code(text), /\bimport\s*\(|\brequire\s*\(|https?:\/\//, `${file} : import dynamique ou adresse`);
  }
});

test('aucun HTML construit par chaîne, aucun eval, aucune boîte du navigateur', () => {
  for (const { file, text } of sources) {
    const body = code(text);
    assert.doesNotMatch(body, /\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write/, `${file} construit du HTML par chaîne`);
    assert.doesNotMatch(body, /\beval\s*\(|new Function\s*\(/, `${file} : eval`);
    assert.doesNotMatch(body, /(^|[^.\w])(prompt|confirm|alert)\s*\(/, `${file} : boîte du navigateur`);
    assert.doesNotMatch(body, /\.setAttribute\(\s*'style'|\.style\.cssText|\.style\s*=\s/, `${file} : attribut style (refusé par style-src 'self')`);
  }
});

test('l\'écoute des messages passe par addEventListener, jamais par window.onmessage', () => {
  for (const { file, text } of sources) assert.doesNotMatch(code(text), /\bonmessage\s*=/, file);
});

test('rien dans la console hors avertissements et erreurs', () => {
  for (const { file, text } of sources) assert.doesNotMatch(code(text), /console\.(log|debug|info|trace|dir)\b/, file);
});

test('chaque accès au stockage du navigateur est dans un try/catch', () => {
  for (const { file, text } of sources) {
    const body = code(text);
    for (const match of body.matchAll(/\b(localStorage|sessionStorage|indexedDB)\b/g)) {
      const before = body.slice(Math.max(0, match.index - 400), match.index);
      const lastTry = before.lastIndexOf('try {');
      const lastClose = before.lastIndexOf('} catch');
      assert.ok(lastTry >= 0 && lastTry > lastClose, `${file} : ${match[0]} hors d'un try/catch`);
    }
  }
});

test('aucun fichier ne dépasse 600 lignes (le seuil de l\'outil d\'audit compte les lignes de code : celles-ci les comptent toutes)', () => {
  for (const { file, text } of [...sources, ...sheets]) {
    const lines = text.split('\n');
    assert.ok(lines.length <= 600, `${file} : ${lines.length} lignes`);
  }
});

test('chaque module dit en tête à quoi il sert (un commentaire avant le premier import)', () => {
  for (const { file, text } of sources) assert.match(text, /^\/\/ \S/, `${file} sans commentaire de tête`);
});
