// Les correcteurs du navigateur coupés sur la page de l'app quand GFS le dit (contrats de GFS 5.2, point 13 ; guide des apps, règle 21), pour une app qui a le lien du kit : `Correcteurs` est la pose de
// `js/correcteurs-pose.js` branchée sur `GfsLink` (le message `{ coupes }` de GFS, js/gfs-link.js).
//   const correcteurs = Correcteurs.start();   // une fois, au démarrage de l'app (le module d'entrée) ; deux appels rendent le même
//   await correcteurs.ready;                   // facultatif : le contexte est arrivé et la marque est posée
//   correcteurs.refresh();                     // tout repasser (la page a été refaite d'une façon que la pose ne voit pas)
//   correcteurs.stop();                        // retire les marques posées
// Une app qui a son propre lien avec GFS (et pas celui du kit) n'importe pas ce module, qui en démarrerait un deuxième dans son cadre : elle prend `createCorrecteurs` de `js/correcteurs-pose.js` et lui donne le sien.
import { once } from './once.js';
import { GfsLink } from './gfs-link.js';
import { createCorrecteurs } from './correcteurs-pose.js';

once('correcteurs', import.meta.url);

// Les correcteurs de la page : ceux que démarre l'app.
export const Correcteurs = createCorrecteurs({ link: GfsLink });
