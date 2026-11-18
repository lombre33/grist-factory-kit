// Le relais des appels bloqués vers GFS (contrats de GFS 5.4, point 14 ; guide des apps, règle S8) : l'app écoute `securitypolicyviolation` sur sa page et dit à GFS, sans réponse attendue, ce que sa
// propre politique de sécurité a bloqué. **Cela informe, cela ne protège pas** : la protection est la politique de l'app, appliquée par le navigateur ; un code piraté peut aussi taire ce relais, et un
// appel vers une adresse que la politique permet ne lève aucun événement. GFS ne voit un cadre d'app que de l'extérieur : sans ce relais, une violation lui reste invisible (mesuré à l'étape 2).
//   - Au démarrage, `{ quoi: 'relais', kit }` : GFS note que le relais de cette app est actif pour la session.
//   - À chaque violation nouvelle, `{ quoi: 'bloque', directive, cible, source, disposition, fois }` (js/violations-message.js : l'hôte seul, jamais l'adresse). La même violation ne repart qu'à la
//     10e, 100e et 1000e fois (`fois` dit le compte) ; au plus 50 violations différentes et 200 messages par page : un code piraté ne peut pas noyer GFS.
// `link` : le lien avec GFS (js/gfs-link.js) ou un lien propre à l'app, qui sait `hosted` (vrai quand GFS héberge l'app) et `tell(nom, args)` (un appel sans réponse, faux quand personne ne l'entend).
// Une app qui a son propre lien (Publipostage+) n'importe pas `js/violations.js` (il démarrerait un second lien dans son cadre) : elle prend `createViolations` et lui donne le sien.
import { once } from './once.js';
import { KIT_VERSION, normalizeViolation } from './violations-message.js';

once('violations-pose', import.meta.url);

export const MAX_KEYS = 50;
export const MAX_SENT = 200;
export const STEPS = Object.freeze([10, 100, 1000]);

export function createViolations({ link, doc = globalThis.document, home = globalThis.location && globalThis.location.hostname }) {
  if (!link || typeof link.tell !== 'function' || !('hosted' in link)) throw new TypeError('createViolations : un lien qui sait `hosted` et `tell` est attendu');
  const counts = new Map();
  let listener = null;
  let sent = 0;

  function report(event) {
    const violation = normalizeViolation(event, home || '');
    const key = `${violation.directive}|${violation.cible}|${violation.source}`;
    if (!counts.has(key) && counts.size >= MAX_KEYS) return;
    const times = (counts.get(key) || 0) + 1;
    counts.set(key, times);
    if ((times !== 1 && !STEPS.includes(times)) || sent >= MAX_SENT) return;
    sent += 1;
    link.tell('securite', { quoi: 'bloque', ...violation, fois: times });
  }

  const handle = Object.freeze({
    // Une fois, au démarrage de l'app. Seule (GFS n'héberge pas l'app), rien n'écoute : personne n'entendrait.
    start() {
      if (listener || !link.hosted || !doc || typeof doc.addEventListener !== 'function') return handle;
      listener = event => report(event);
      doc.addEventListener('securitypolicyviolation', listener);
      link.tell('securite', { quoi: 'relais', kit: KIT_VERSION });
      return handle;
    },
    stop() {
      if (listener) doc.removeEventListener('securitypolicyviolation', listener);
      listener = null;
      return handle;
    },
    active: () => listener !== null,
    sent: () => sent,
  });
  return handle;
}
