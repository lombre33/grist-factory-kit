// Le message « correcteurs » de GFS lu avec méfiance (contrats de GFS 5.2, point 13 ; guide des apps, règle 21) : `{ coupes }`, vrai quand la personne a coupé les correcteurs du navigateur
// (LanguageTool) dans les apps par le bouton de la barre de GFS. Dans le contexte (`contexte.correcteurs`) comme dans l'événement `correcteurs` (`{ correcteurs: { coupes } }`) la forme est la même.
// Tout ce qui n'est pas exactement `{ coupes: true }` vaut « pas coupé » : une app que GFS ne prévient pas, ou qui reçoit autre chose, laisse les correcteurs comme le navigateur les fait.
// Ce module n'importe rien : une app qui a son propre lien avec GFS (Publipostage+) s'en sert dans son lien, comme de `normalizeAmbiance` (js/ambiance-message.js).
import { once } from './once.js';

once('correcteurs-message', import.meta.url);

export const normalizeCorrecteurs = raw => ({ coupes: Boolean(raw) && typeof raw === 'object' && raw.coupes === true });
