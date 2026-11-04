// Les vues Semaine et Jour : en haut la bande des jours entiers (les jours de la semaine avec leurs barres, ou la liste du jour), en dessous la grille horaire qui défile.
import { h } from '../lien-kit.js';
import { semaineDeLaLigne } from '../noyau/dates.js';
import { toutesLaJournee } from '../noyau/horaire.js';
import { construireHoraire } from './horaire.js';
import { accepterDepots } from './glisser.js';
import { ouvrirSaisie } from './saisie.js';
import { construireEvenement, construireZone } from './semaines.js';

const BARRES_DE_LA_BANDE = 3;

function bandeSemaine(ctx, ligne) {
  const numero = semaineDeLaLigne(ligne.map(cellule => cellule.jour));
  const joursEntiers = ctx.modele.evenements.filter(evenement => !evenement.avecHeure);
  return h('div', { class: 'cal-ligne cal-bande', role: 'row' },
    h('div', { class: 'cal-sem', 'aria-label': ctx.t('cal.semaineAria', { n: numero }) }, ctx.t('cal.semaineNumero', { n: numero })),
    construireZone(ctx, ligne, joursEntiers, BARRES_DE_LA_BANDE));
}

function bandeJour(ctx, jour) {
  const jours = Array(7).fill(jour);
  const bande = h('div', { class: 'cal-bande-jour', dataset: { jour } });
  for (const evenement of toutesLaJournee(ctx.modele.evenements, jour)) {
    const segment = { evenement, colDebut: 0, colFin: 0, piste: 0, prolongeAvant: false, prolongeApres: false };
    bande.append(construireEvenement(ctx, segment, jours, bande));
  }
  bande.addEventListener('click', clic => { if (clic.target === bande && ctx.peutAjouter()) ouvrirSaisie(ctx, { jour, cellule: bande, decalage: 0 }); });
  accepterDepots(bande, jours, ctx.glisse, { survol: cible => bande.classList.toggle('cal-survol', Boolean(cible)), depose: () => ctx.deposer(jour) });
  return h('div', { class: 'cal-ligne cal-bande' }, h('div', { class: 'cal-sem' }), bande);
}

export function construireVueHoraire(ctx, ligne) {
  const jours = ligne.map(cellule => cellule.jour);
  const bande = ctx.etat.vue === 'semaine' ? bandeSemaine(ctx, ligne) : bandeJour(ctx, jours[0]);
  const horaire = construireHoraire(ctx, jours);
  return [bande, horaire];
}
