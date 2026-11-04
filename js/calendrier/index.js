// La porte d'entrée du module de calendrier, accordée avec Tuesday (consigne 006 de GFS) :
//   const calendrier = creerCalendrier({ onOuvrir, onDeplacer, onAjouter, onEtat });
//   conteneur.append(calendrier.element);
//   calendrier.definir({ lignes, options });     // à rappeler à chaque changement de données
// Rend { element, definir, aller, aujourdhui, detruire }. Le module ne parle jamais à Grist : il reçoit des lignes ({ id, titre, debut, fin, avecHeure, statut, couleur, responsables,
// modifiable }, dates en AAAA-MM-JJ ou AAAA-MM-JJTHH:mm) et rend des gestes par les rappels, que l'hôte exécute (docs/plan.md, section 3).
//   onOuvrir(id) · onDeplacer({ id, debut, fin }) -> promesse (refusée ou `false` : l'événement revient) · onAjouter({ debut, titre }) -> promesse · onEtat({ vue, jourCourant })
// options : debutSemaine (1 = lundi), vue ('mois' | 'semaine' | 'jour'), jourCourant, langue ('fr' | 'en'), maintenant (horloge injectée), lectureSeule, maxPistes.
import { h } from './lien-kit.js';
import { creerTraduction } from './textes.js';
import { aujourdhui as aujourdhuiDe, estJour } from './noyau/dates.js';
import { deplacer } from './noyau/deplacement.js';
import { deplacerHoraire } from './noyau/horaire.js';
import { normaliser } from './noyau/evenements.js';
import { jourInitial, lignesDeLaVue, vueValide, voisin } from './noyau/navigation.js';
import { construireBarre } from './vue/barre.js';
import { HEURE_AU_DEFILEMENT } from './vue/horaire.js';
import { construirePlateau } from './vue/plateau.js';
import { construireVueHoraire } from './vue/heures.js';
import { construireGrille } from './vue/semaines.js';

// Combien de barres tiennent dans une ligne de la grille : sa hauteur moins le numéro du jour, par barre de 20 px (2 tant que rien n'est mesuré). `options.maxPistes` l'impose.
const HAUTEUR_NUMERO = 27;
const HAUTEUR_BARRE = 20;
const premierJourValide = valeur => (Number.isInteger(valeur) && valeur >= 0 && valeur <= 6 ? valeur : 1);

// La couleur que Grist donne à un événement (une donnée de la personne) : posée par le CSSOM, lue par la feuille (--cal-fond, --cal-texte).
function appliquerCouleur(cible, evenement) {
  if (!evenement.couleur) return;
  if (evenement.couleur.fond) cible.style.setProperty('--cal-fond', evenement.couleur.fond);
  if (evenement.couleur.texte) cible.style.setProperty('--cal-texte', evenement.couleur.texte);
}

// L'hôte peut demander une vue ou un jour (sa mémoire d'une visite précédente) : pris en compte à la première fois et chaque fois que sa demande change, jamais à chaque rappel.
// Sans jour demandé, le calendrier s'ouvre sur aujourd'hui. Rend la demande à retenir pour la fois suivante.
function appliquerDemande(etat, demande, nouvelles) {
  const premiere = !demande.vu;
  if (nouvelles.vue !== demande.vue && nouvelles.vue !== undefined) etat.vue = vueValide(nouvelles.vue);
  if (nouvelles.jourCourant !== demande.jourCourant && estJour(nouvelles.jourCourant)) etat.jour = nouvelles.jourCourant;
  else if (premiere) etat.jour = jourInitial(nouvelles.jourCourant, nouvelles.maintenant);
  return { vu: true, vue: nouvelles.vue, jourCourant: nouvelles.jourCourant };
}

// Déplacer ce que la personne tient (glisse.courant) sur un jour ou à une heure : le calcul est celui du noyau, l'effet est immédiat, et si l'hôte refuse l'événement revient à sa place.
// `lire()` rend le modèle d'à présent ; `surcharger(id, dates)` pose un déplacement (dates) ou l'annule (null) et redessine : celui du calendrier.
function creerDeplacements({ rappels, glisse, lectureSeule, lire, surcharger }) {
  async function avecRetour(resultat) {
    surcharger(resultat.id, { debut: resultat.debut, fin: resultat.fin });
    try {
      if (await rappels.onDeplacer(resultat) === false) throw new Error('refusé');
    } catch (erreur) {
      surcharger(resultat.id, null);
    }
  }
  const deposerAvec = calculer => {
    const enCours = glisse.courant;
    if (!enCours || lectureSeule()) return;
    const { evenements, sansDate } = lire();
    const evenement = [...evenements, ...sansDate].find(e => String(e.id) === String(enCours.id));
    const resultat = evenement ? calculer(evenement, enCours) : null;
    if (resultat) avecRetour(resultat);
  };
  return {
    deposer: jour => deposerAvec((evenement, enCours) => deplacer(evenement, enCours.jourSaisi, jour)),
    deposerHoraire: (jour, minute) => deposerAvec((evenement, enCours) => deplacerHoraire(evenement, enCours.saisi || { jour: enCours.jourSaisi || jour, minute: 0 }, { jour, minute })),
  };
}

// Dessiner le calendrier dans son élément : la barre, la grille du mois ou les heures, le plateau, l'avis, et la couche flottante des saisies et des listes ; mesurer une ligne pour savoir
// combien de barres tiennent (et redessiner si la mesure change le compte), et suivre la taille de l'élément. Tout ce que les vues lisent passe par `ctx`.
function creerRendu(element, ctx) {
  let flottant = h('div', { class: 'cal-flottant' });
  let hauteurLigne = 0;

  function capaciteDe(hauteur) {
    const { maxPistes } = ctx.options;
    if (Number.isInteger(maxPistes) && maxPistes > 0) return maxPistes;
    return hauteur ? Math.min(12, Math.max(1, Math.floor((hauteur - HAUTEUR_NUMERO) / HAUTEUR_BARRE))) : 2;
  }

  function mesurer() {
    const ligne = element.querySelector('.cal-ligne');
    return ligne ? Math.round(ligne.getBoundingClientRect().height) : 0;
  }

  function dessiner() {
    const { etat, modele } = ctx;
    const lignesDeVue = lignesDeLaVue(etat.vue, etat.jour, premierJourValide(ctx.options.debutSemaine));
    const barre = construireBarre(ctx, { jours: lignesDeVue[0].map(cellule => cellule.jour) });
    const defile = element.querySelector('.cal-heures');
    const hautDefile = defile ? defile.scrollTop : null;
    const principal = etat.vue === 'mois' ? construireGrille(ctx, lignesDeVue) : construireVueHoraire(ctx, lignesDeVue[0]);
    const plateau = etat.plateau && modele.sansDate.length ? construirePlateau(ctx) : null;
    const avis = modele.invalides.length ? h('div', { class: 'cal-avis', role: 'status' }, ctx.t('cal.ecartees', { n: modele.invalides.length })) : null;
    flottant = h('div', { class: 'cal-flottant' });
    element.replaceChildren(...[barre, avis, h('div', { class: 'cal-milieu' }, h('div', { class: `cal-principal cal-vue-${etat.vue}` }, principal), plateau), flottant].filter(Boolean));
    const heures = element.querySelector('.cal-heures');
    if (heures) {
      const etiquette = element.querySelector('.cal-etiquette');
      heures.scrollTop = hautDefile === null ? HEURE_AU_DEFILEMENT * (etiquette ? etiquette.offsetHeight : 40) - 8 : hautDefile;
    }
  }

  function rendre() {
    dessiner();
    const mesure = mesurer();
    if (mesure && capaciteDe(mesure) !== capaciteDe(hauteurLigne)) {
      hauteurLigne = mesure;
      dessiner();
    } else if (mesure) {
      hauteurLigne = mesure;
    }
  }

  const observateur = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (mesurer() && mesurer() !== hauteurLigne) rendre(); }) : null;
  if (observateur) observateur.observe(element);
  return {
    rendre,
    capacite: () => capaciteDe(hauteurLigne),
    get flottant() { return flottant; },
    arreter() { if (observateur) observateur.disconnect(); },
  };
}

export function creerCalendrier(rappels = {}) {
  let options = {};
  const etat = { vue: 'mois', jour: jourInitial(undefined, undefined), plateau: false };
  const glisse = { courant: null };
  let lignes = [];
  let modele = { evenements: [], sansDate: [], invalides: [] };
  let traduction = creerTraduction('fr');
  let demande = {};
  const surcharges = new Map();
  const element = h('div', { class: 'cal', role: 'region' });
  let rendu = null;

  const remodeler = () => {
    modele = normaliser(lignes.map(ligne => (surcharges.has(String(ligne.id)) ? { ...ligne, ...surcharges.get(String(ligne.id)) } : ligne)));
  };
  // Un déplacement posé (dates) ou annulé (null) : le modèle et l'écran suivent tout de suite.
  const surcharger = (id, dates) => {
    if (dates) surcharges.set(String(id), dates); else surcharges.delete(String(id));
    remodeler();
    rendu.rendre();
  };
  const notifier = () => { if (typeof rappels.onEtat === 'function') rappels.onEtat({ vue: etat.vue, jourCourant: etat.jour }); };
  const lectureSeule = () => Boolean(options.lectureSeule) || typeof rappels.onDeplacer !== 'function';
  const deplacements = creerDeplacements({ rappels, glisse, lectureSeule, lire: () => modele, surcharger });

  const ctx = {
    etat,
    glisse,
    get options() { return options; },
    get modele() { return modele; },
    get langue() { return traduction.language; },
    get flottant() { return rendu.flottant; },
    capacite: () => rendu.capacite(),
    get lectureSeule() { return lectureSeule(); },
    t: (cle, variables) => traduction.t(cle, variables),
    aujourdhui: () => aujourdhuiDe(options.maintenant),
    peutAjouter: () => typeof rappels.onAjouter === 'function' && !options.lectureSeule,
    ouvrir: id => { if (typeof rappels.onOuvrir === 'function') rappels.onOuvrir(id); },
    ajouter: async demandeAjout => { if (await rappels.onAjouter(demandeAjout) === false) throw new Error('refusé'); },
    deposer: deplacements.deposer,
    deposerHoraire: deplacements.deposerHoraire,
    appliquerCouleur,
    naviguer(sens) { ctx.aller(voisin(etat.vue, etat.jour, sens)); },
    aller(jour) { if (estJour(jour)) { etat.jour = jour; notifier(); rendu.rendre(); } },
    changerVue(vue) { etat.vue = vueValide(vue); notifier(); rendu.rendre(); },
    basculerPlateau() { etat.plateau = !etat.plateau; rendu.rendre(); },
  };

  rendu = creerRendu(element, ctx);
  rendu.rendre();
  return {
    element,
    definir({ lignes: nouvelles = [], options: reglages = {} } = {}) {
      options = reglages && typeof reglages === 'object' ? reglages : {};
      if (options.langue && options.langue !== traduction.language) traduction = creerTraduction(options.langue);
      demande = appliquerDemande(etat, demande, options);
      lignes = Array.isArray(nouvelles) ? nouvelles : [];
      surcharges.clear();
      remodeler();
      rendu.rendre();
    },
    aller: jour => ctx.aller(jour),
    aujourdhui: () => ctx.aller(ctx.aujourdhui()),
    detruire() { rendu.arreter(); element.remove(); element.replaceChildren(); surcharges.clear(); },
  };
}
