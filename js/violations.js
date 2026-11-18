// Le relais des appels bloqués vers GFS, pour une app qui a le lien du kit : `Violations` est la pose de `js/violations-pose.js` branchée sur `GfsLink` (contrats de GFS 5.4, point 14 ; guide des
// apps, règle S8).
//   Violations.start();   // une fois, au démarrage de l'app ; ou, plus tôt, `import './kit/js/violations-start.js'` en tête du module d'entrée
// Une violation qui arrive avant `start()` n'est pas vue : un module ES qui s'évalue avant celui qui appelle `start()` (les imports passent d'abord) peut déjà demander une adresse. D'où
// `violations-start.js`, à importer **en premier** : il démarre le relais avant que les autres modules s'évaluent.
// Une app qui a son propre lien avec GFS (et pas celui du kit) n'importe pas ce module, qui en démarrerait un deuxième dans son cadre : elle prend `createViolations` de `js/violations-pose.js`.
import { once } from './once.js';
import { GfsLink } from './gfs-link.js';
import { createViolations } from './violations-pose.js';

once('violations', import.meta.url);

// Le relais de la page : celui que démarre l'app.
export const Violations = createViolations({ link: GfsLink });
