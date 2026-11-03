// Poser l'ambiance de GFS sur la page d'une app (contrats de GFS 5.2, point 10 ; guide des apps, règle 15), avec le lien et le mode qu'on lui donne : la personne choisit une ambiance et, si elle veut, sa couleur,
// une fois pour GFS et pour toutes ses apps ; GFS les donne à l'app, et ce module les pose sur sa page : les jetons de couleur du mode que l'app affiche (clair ou sombre) et les jetons de forme, par le CSSOM
// (`style.setProperty` sur <html>, que la politique `style-src 'self'` d'une app hébergée laisse passer : jamais un attribut `style` ni une feuille écrits d'après le message). Les feuilles du kit
// (css/tokens.css) et celles de l'app lisent ces jetons : rien d'autre à changer chez elle.
// Il n'importe ni le lien du kit ni son thème : une app qui a déjà son propre lien avec GFS (Publipostage+) s'en sert ici sans en démarrer un deuxième dans son cadre. Les apps qui ont le lien du kit
// prennent `js/ambiance.js` (`Ambiance.start()`), qui branche celui-ci sur `GfsLink` et sur `Theme`.
//   const ambiance = createAmbiance({ link, isDark }).start();
//     link     { ambiance(), onAmbiance(fn), ready } : `ambiance()` rend le message lu par `normalizeAmbiance` (js/ambiance-message.js) ou null ; `onAmbiance(fn)` rappelle `fn` à chaque changement et rend de quoi se
//              désabonner ; `ready` se règle quand le contexte de GFS est arrivé (ou que son attente est finie)
//     isDark   () → vrai quand l'app affiche son mode sombre
//   await ambiance.ready;     // facultatif : le contexte est arrivé et l'ambiance est posée, l'app s'affiche sans repeindre (jamais rejetée)
//   ambiance.repaint();       // le mode de l'app a changé autrement que par `data-theme` ou `data-grist-appearance` sur <html> ou par la préférence du système (une classe, par exemple)
//   ambiance.stop();          // retire ce qui a été posé
// L'ambiance suit GFS (un événement par geste de la personne) et le mode de l'app : l'attribut `data-theme` de <html> (le choix de la personne dans l'app), `data-grist-appearance` (celui de Grist) et la préférence
// du système. GFS dit `null` quand rien n'est choisi : tout ce que ce module avait posé est alors retiré, jamais d'autre propriété de la page. Seule, l'app n'a pas d'ambiance : rien n'est posé, rien n'est retiré.
import { once } from './once.js';

once('ambiance-pose', import.meta.url);

const MODE_ATTRIBUTES = ['data-theme', 'data-grist-appearance'];

// Pose `message` (le message d'ambiance, js/ambiance-message.js) sur `root` pour le mode demandé et rend les noms posés ; retire d'abord ceux que `previous` avait posés. Sans message, ne fait que retirer.
export function paintAmbiance(root, message, dark, previous = []) {
  for (const name of previous) root.style.removeProperty(name);
  if (!message) return [];
  const values = { ...message.forme, ...(dark ? message.sombre : message.clair) };
  const names = Object.keys(values);
  for (const name of names) root.style.setProperty(name, values[name]);
  return names;
}

// Un posé pour une page : `link` tient lieu du lien avec GFS et `isDark` du mode affiché (l'un et l'autre sont demandés) ; `doc` et `win` sont la page (ceux du navigateur par défaut, ceux d'un essai sinon).
export function createAmbiance({ link, isDark, doc = globalThis.document, win = globalThis.window } = {}) {
  if (!link || typeof link.ambiance !== 'function' || typeof link.onAmbiance !== 'function' || typeof isDark !== 'function') {
    throw new TypeError('createAmbiance : `link` ({ ambiance(), onAmbiance(fn), ready }) et `isDark()` sont demandés');
  }
  let running = null;

  function begin() {
    const root = doc.documentElement;
    let posed = [];
    const paint = () => { posed = paintAmbiance(root, link.ambiance(), isDark(), posed); };
    const stops = [link.onAmbiance(paint)];
    // Le mode change sans que GFS dise rien : le thème de l'app (data-theme), celui de Grist (data-grist-appearance) ou la préférence du système.
    const observer = new win.MutationObserver(paint);
    observer.observe(root, { attributes: true, attributeFilter: MODE_ATTRIBUTES });
    const query = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-color-scheme: dark)') : null;
    if (query) query.addEventListener('change', paint);
    paint();
    const ready = Promise.resolve(link.ready).then(paint);
    const stop = () => {
      for (const unsubscribe of stops) unsubscribe();
      observer.disconnect();
      if (query) query.removeEventListener('change', paint);
      posed = paintAmbiance(root, null, false, posed);
      running = null;
    };
    return Object.freeze({ ready, repaint: paint, stop });
  }

  return Object.freeze({ start: () => { if (!running) running = begin(); return running; } });
}
