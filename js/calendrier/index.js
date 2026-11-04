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
  let flottant = h('div', { class: 'cal-flottant' });
  let hauteurLigne = 0;

  const remodeler = () => {
    modele = normaliser(lignes.map(ligne => (surcharges.has(String(ligne.id)) ? { ...ligne, ...surcharges.get(String(ligne.id)) } : ligne)));
  };
  const notifier = () => { if (typeof rappels.onEtat === 'function') rappels.onEtat({ vue: etat.vue, jourCourant: etat.jour }); };
  const lectureSeule = () => Boolean(options.lectureSeule) || typeof rappels.onDeplacer !== 'function';

  async function deplacerAvecRetour(resultat) {
    surcharges.set(String(resultat.id), { debut: resultat.debut, fin: resultat.fin });
    remodeler();
    rendre();
    try {
      if (await rappels.onDeplacer(resultat) === false) throw new Error('refusé');
    } catch (erreur) {
      surcharges.delete(String(resultat.id));
      remodeler();
      rendre();
    }
  }

  const ctx = {
    etat,
    glisse,
    get options() { return options; },
    get modele() { return modele; },
    get langue() { return traduction.language; },
    get flottant() { return flottant; },
    capacite: () => capaciteDe(hauteurLigne),
    get lectureSeule() { return lectureSeule(); },
    t: (cle, variables) => traduction.t(cle, variables),
    aujourdhui: () => aujourdhuiDe(options.maintenant),
    peutAjouter: () => typeof rappels.onAjouter === 'function' && !options.lectureSeule,
    ouvrir: id => { if (typeof rappels.onOuvrir === 'function') rappels.onOuvrir(id); },
    async ajouter(demandeAjout) {
      if (await rappels.onAjouter(demandeAjout) === false) throw new Error('refusé');
    },
    deposer(jour) {
      const enCours = glisse.courant;
      if (!enCours || lectureSeule()) return;
      const evenement = [...modele.evenements, ...modele.sansDate].find(e => String(e.id) === String(enCours.id));
      const resultat = evenement ? deplacer(evenement, enCours.jourSaisi, jour) : null;
      if (resultat) deplacerAvecRetour(resultat);
    },
    deposerHoraire(jour, minute) {
      const enCours = glisse.courant;
      if (!enCours || lectureSeule()) return;
      const evenement = [...modele.evenements, ...modele.sansDate].find(e => String(e.id) === String(enCours.id));
      const saisi = enCours.saisi || { jour: enCours.jourSaisi || jour, minute: 0 };
      const resultat = evenement ? deplacerHoraire(evenement, saisi, { jour, minute }) : null;
      if (resultat) deplacerAvecRetour(resultat);
    },
    appliquerCouleur(cible, evenement) {
      if (!evenement.couleur) return;
      if (evenement.couleur.fond) cible.style.setProperty('--cal-fond', evenement.couleur.fond);
      if (evenement.couleur.texte) cible.style.setProperty('--cal-texte', evenement.couleur.texte);
    },
    naviguer(sens) { ctx.aller(voisin(etat.vue, etat.jour, sens)); },
    aller(jour) {
      if (!estJour(jour)) return;
      etat.jour = jour;
      notifier();
      rendre();
    },
    changerVue(vue) {
      etat.vue = vueValide(vue);
      notifier();
      rendre();
    },
    basculerPlateau() {
      etat.plateau = !etat.plateau;
      rendre();
    },
  };

  function capaciteDe(hauteur) {
    if (Number.isInteger(options.maxPistes) && options.maxPistes > 0) return options.maxPistes;
    return hauteur ? Math.min(12, Math.max(1, Math.floor((hauteur - HAUTEUR_NUMERO) / HAUTEUR_BARRE))) : 2;
  }

  function mesurer() {
    const ligne = element.querySelector('.cal-ligne');
    return ligne ? Math.round(ligne.getBoundingClientRect().height) : 0;
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

  function dessiner() {
    const lignesDeVue = lignesDeLaVue(etat.vue, etat.jour, premierJourValide(options.debutSemaine));
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

  // L'hôte peut demander une vue ou un jour (sa mémoire d'une visite précédente) : pris en compte à la première fois et chaque fois que sa demande change, jamais à chaque rappel.
  // Sans jour demandé, le calendrier s'ouvre sur aujourd'hui.
  function appliquerDemande(nouvelles) {
    const premiere = !demande.vu;
    if (nouvelles.vue !== demande.vue && nouvelles.vue !== undefined) etat.vue = vueValide(nouvelles.vue);
    if (nouvelles.jourCourant !== demande.jourCourant && estJour(nouvelles.jourCourant)) etat.jour = nouvelles.jourCourant;
    else if (premiere) etat.jour = jourInitial(nouvelles.jourCourant, nouvelles.maintenant);
    demande = { vu: true, vue: nouvelles.vue, jourCourant: nouvelles.jourCourant };
  }

  const observateur = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (mesurer() && mesurer() !== hauteurLigne) rendre(); }) : null;
  if (observateur) observateur.observe(element);
  rendre();
  return {
    element,
    definir({ lignes: nouvelles = [], options: reglages = {} } = {}) {
      options = reglages && typeof reglages === 'object' ? reglages : {};
      if (options.langue && options.langue !== traduction.language) traduction = creerTraduction(options.langue);
      appliquerDemande(options);
      lignes = Array.isArray(nouvelles) ? nouvelles : [];
      surcharges.clear();
      remodeler();
      rendre();
    },
    aller: jour => ctx.aller(jour),
    aujourdhui: () => ctx.aller(ctx.aujourdhui()),
    detruire() { if (observateur) observateur.disconnect(); element.remove(); element.replaceChildren(); surcharges.clear(); },
  };
}
