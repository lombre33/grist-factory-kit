// L'ambiance de GFS posée sur la page de l'app (contrats de GFS 5.2, point 10 ; guide des apps, règle 15), pour une app qui a le lien du kit : `Ambiance` est la pose de `js/ambiance-pose.js` branchée sur
// `GfsLink` (le message d'ambiance de GFS, js/gfs-link.js) et sur `Theme` (le mode que l'app affiche : le choix de la personne dans l'app, puis celui de Grist, puis la préférence du système, js/theme.js).
//   const ambiance = Ambiance.start();   // une fois, au démarrage de l'app (le module d'entrée), avant d'afficher ; deux appels rendent le même
//   await ambiance.ready;                // facultatif : le contexte est arrivé et l'ambiance est posée, l'app s'affiche sans repeindre (jamais rejetée)
//   ambiance.repaint();                  // le mode de l'app a changé autrement que par `data-theme` ou `data-grist-appearance` sur <html> ou par le système
//   ambiance.stop();                     // retire ce qui a été posé
// Une app qui a son propre lien avec GFS (et pas celui du kit) n'importe pas ce module, qui en démarrerait un deuxième dans son cadre : elle prend `createAmbiance` de `js/ambiance-pose.js` et lui donne le sien.
import { once } from './once.js';
import { GfsLink } from './gfs-link.js';
import { Theme } from './theme.js';
import { createAmbiance } from './ambiance-pose.js';

once('ambiance', import.meta.url);

// L'ambiance de la page : celle que démarre l'app.
export const Ambiance = createAmbiance({ link: GfsLink, isDark: () => Theme.isDark() });
