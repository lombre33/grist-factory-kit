// La page d'essai du calendrier : monte le module comme le ferait un hôte (une app) et garde les appels reçus dans `kit.appels`, pour que les essais les relisent. Les essais choisissent les
// lignes, les options et la réponse de l'hôte (`kit.reponse` : 'ok', 'refus' ou 'erreur'). Rien ici n'est du kit.
import { I18n } from '../js/i18n.js';
import { creerCalendrier } from '../js/calendrier/index.js';

I18n.init({ storageKey: 'kit_lang' });   // la langue de la page : celle du navigateur, que l'hôte passe au module (options.langue)
const kit = { I18n, appels: [], reponse: 'ok', calendrier: null };
const noter = (nom, valeur) => { kit.appels.push({ nom, valeur }); };
kit.calendrier = creerCalendrier({
  onOuvrir: id => noter('ouvrir', id),
  onDeplacer: async resultat => { noter('deplacer', resultat); if (kit.reponse === 'refus') return false; if (kit.reponse === 'erreur') throw new Error('non'); return true; },
  onAjouter: async demande => { noter('ajouter', demande); if (kit.reponse === 'refus') throw new Error('non'); return true; },
  onEtat: etat => noter('etat', etat),
});
document.getElementById('cadre').append(kit.calendrier.element);
window.kit = kit;
