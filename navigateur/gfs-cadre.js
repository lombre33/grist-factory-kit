// L'app d'essai du lien : ce qu'une app fait du lien avec GFS, et ce qu'elle en a vu, que les essais lisent.
import { GfsLink } from '../js/gfs-link.js';

const seen = { langue: [], ouvrir: [] };
GfsLink.onLanguage(language => seen.langue.push(language));
GfsLink.onOpen((request) => { seen.ouvrir.push(request); return true; });

const ownStorage = (() => {
  try { return typeof window.localStorage.length; } catch (error) { return 'refusé'; }
})();

window.cadre = { GfsLink, seen, origin: window.origin, ownStorage };
