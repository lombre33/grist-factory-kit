// L'app d'essai du lien : ce qu'une app fait du lien avec GFS, et ce qu'elle en a vu, que les essais lisent.
import { GfsLink } from '../js/gfs-link.js';
import { Ambiance } from '../js/ambiance.js';
import { Theme } from '../js/theme.js';

const seen = { langue: [], ouvrir: [], ambiance: [] };
GfsLink.onLanguage(language => seen.langue.push(language));
GfsLink.onAmbiance(message => seen.ambiance.push(message && message.id));
Ambiance.start();
GfsLink.onOpen((request) => { seen.ouvrir.push(request); return true; });

const ownStorage = (() => {
  try { return typeof window.localStorage.length; } catch (error) { return 'refusé'; }
})();

window.cadre = { GfsLink, Theme, seen, origin: window.origin, ownStorage };
