// Un signalement de violation de la politique de sécurité de l'app, réduit à ce qui peut partir sans risque (contrats de GFS 5.4, point 14 ; guide des apps, règle S8). Le navigateur donne, pour
// un appel bloqué, l'adresse complète : chemin et paramètres compris, c'est-à-dire, dans une compromission, ce que le code piraté cherchait à envoyer. **Seul le nom d'hôte part** : jamais un
// chemin, des paramètres, un fragment, ni du texte libre. Ce que GFS reçoit est ainsi borné par la forme, jamais par la confiance dans l'app.
// Le module n'importe rien d'autre que `once` ; `normalizeViolation` est une fonction pure.
import { once } from './once.js';

once('violations-message', import.meta.url);

// La version du kit, dite à GFS quand l'app active le relais : il l'affiche à côté de « relais actif ». Un essai la garde égale à celle de `package.json`.
export const KIT_VERSION = '0.27.0';

// Les directives dont GFS accepte le nom ; tout autre vaut « autre ».
export const DIRECTIVES = Object.freeze(['default-src', 'script-src', 'script-src-elem', 'script-src-attr', 'style-src', 'style-src-elem', 'style-src-attr', 'img-src', 'font-src',
  'connect-src', 'media-src', 'object-src', 'frame-src', 'child-src', 'worker-src', 'manifest-src', 'base-uri', 'form-action', 'frame-ancestors', 'navigate-to']);

// Ce que le navigateur dit à la place d'une adresse : du code en ligne, `eval`, une donnée intégrée…
const KEYWORDS = new Set(['inline', 'eval', 'data', 'blob', 'self', 'wasm-eval', 'mediastream', 'filesystem']);
const HOST = /^[a-z0-9](?:[a-z0-9.-]{0,98}[a-z0-9])?$/;

const hostOf = raw => {
  try {
    const host = new URL(String(raw)).hostname.toLowerCase();
    return HOST.test(host) ? host : null;
  } catch (error) { return null; }
};

// `event` : l'événement `securitypolicyviolation` ; `home` : l'hôte de la page de l'app (le code qui vient de là est « app »). Rend
// `{ directive, cible, source, disposition }` :
//   directive : un nom de DIRECTIVES, ou « autre » ;
//   cible : ce qui a été bloqué : un mot de KEYWORDS, un nom d'hôte, ou « autre » ;
//   source : qui l'a demandé : « app » (le code de l'app), un nom d'hôte (le code d'une bibliothèque), « inconnue » (le navigateur ne le dit pas) ou « autre » ;
//   disposition : « enforce » (bloqué) ou « report » (seulement signalé).
export function normalizeViolation(event, home = '') {
  const given = event !== null && typeof event === 'object' ? event : {};
  const directive = String(given.effectiveDirective || given.violatedDirective || '').trim().split(/\s+/)[0].toLowerCase();
  const raw = String(given.blockedURI || '');
  return { directive: DIRECTIVES.includes(directive) ? directive : 'autre', cible: targetOf(raw), source: sourceOf(String(given.sourceFile || ''), home),
    disposition: given.disposition === 'report' ? 'report' : 'enforce' };
}

// Ce qui a été bloqué : un mot de KEYWORDS, un nom d'hôte, ou « autre ».
function targetOf(raw) {
  return KEYWORDS.has(raw.toLowerCase()) ? raw.toLowerCase() : (hostOf(raw) || 'autre');
}

// Qui l'a demandé : « app » (le code de l'app), un nom d'hôte, « inconnue » (le navigateur ne le dit pas) ou « autre ».
function sourceOf(file, home) {
  if (!file) return 'inconnue';
  const host = hostOf(file);
  return host && host === String(home).toLowerCase() ? 'app' : (host || 'autre');
}
