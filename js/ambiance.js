// L'ambiance de GFS posée sur la page de l'app (contrats de GFS 5.2, point 10 ; guide des apps, règle 15) : la personne choisit une ambiance et, si elle veut, sa couleur, une fois pour GFS et pour toutes ses
// apps ; GFS les donne à l'app (`GfsLink.ambiance()`, `GfsLink.onAmbiance(fn)`) et ce module les pose sur la page : les jetons de couleur du mode que l'app affiche (clair ou sombre) et les jetons de forme, par le
// CSSOM (`style.setProperty` sur <html>, que la politique `style-src 'self'` d'une app hébergée laisse passer : jamais un attribut `style` ni une feuille écrits d'après le message). Les feuilles du kit (css/tokens.css)
// et celles de l'app lisent ces jetons : rien d'autre à changer chez elle.
//   const ambiance = Ambiance.start();   // une fois, au démarrage de l'app (le module d'entrée), avant d'afficher ; deux appels rendent le même
//   await ambiance.ready;                // facultatif : le contexte est arrivé et l'ambiance est posée, l'app s'affiche sans repeindre (jamais rejetée)
//   ambiance.stop();                     // retire ce qui a été posé
// L'ambiance suit GFS (un événement par geste de la personne) et le mode de l'app (le thème que la personne a choisi dans l'app, puis celui de Grist, puis la préférence du système : js/theme.js). GFS dit `null`
// quand rien n'est choisi : tout ce que ce module avait posé est alors retiré, jamais d'autre propriété de la page. Seule, l'app n'a pas d'ambiance : rien n'est posé, rien n'est retiré.
import { once } from './once.js';
import { GfsLink } from './gfs-link.js';
import { Theme } from './theme.js';

once('ambiance', import.meta.url);

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

// Un posé par page (`Ambiance`, plus bas) ; `createAmbiance` en fait un autre pour un essai : `link` tient lieu du lien avec GFS, `doc` et `win` de la page, `isDark` du mode affiché.
export function createAmbiance({ link = GfsLink, doc = globalThis.document, win = globalThis.window, isDark = () => Theme.isDark() } = {}) {
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
    const ready = link.ready.then(paint);
    const stop = () => {
      for (const unsubscribe of stops) unsubscribe();
      observer.disconnect();
      if (query) query.removeEventListener('change', paint);
      posed = paintAmbiance(root, null, false, posed);
      running = null;
    };
    return Object.freeze({ ready, stop });
  }

  return Object.freeze({ start: () => { if (!running) running = begin(); return running; } });
}

// L'ambiance de la page : celle que démarre l'app.
export const Ambiance = createAmbiance();
