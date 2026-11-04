// La grille : une ligne de sept jours par semaine (4 à 6 en mois, une en semaine), des barres par événement sur des pistes, « +n » pour ce qui dépasse, le numéro de la semaine, un
// jour pour déposer ou pour ajouter. Chaque ligne est : un fond de sept cellules (cliquable, déposable), la grille des barres par-dessus (qui laisse passer les clics hors de ses
// éléments). La saisie rapide et la liste du jour flottent dans une couche à part, au-dessus de tout le calendrier (ctx.flottant).
import { h } from '../lien-kit.js';
import { semaineDeLaLigne } from '../noyau/dates.js';
import { libelleJour, nomCourt, numeroDuJour, premierDuMoisAffiche } from '../noyau/format.js';
import { placerSemaine } from '../noyau/placement.js';
import { accepterDepots, rendreGlissable } from './glisser.js';
import { ouvrirListeDuJour } from './liste-jour.js';
import { ouvrirSaisie } from './saisie.js';

const surTouche = action => touche => {
  if (touche.key === 'Enter' || touche.key === ' ') { touche.preventDefault(); action(); }
};

export function construireEvenement(ctx, segment, jours, zone) {
  const evenement = segment.evenement;
  const modifiable = !ctx.lectureSeule && evenement.modifiable;
  const classes = ['cal-evt', segment.prolongeAvant ? 'cal-evt-avant' : '', segment.prolongeApres ? 'cal-evt-apres' : '', modifiable ? '' : 'cal-grise'];
  const element = h('div', {
    class: classes.filter(Boolean).join(' '), role: 'button', tabindex: '0', dataset: { id: String(evenement.id) },
    title: modifiable ? evenement.titre : `${evenement.titre} · ${ctx.t(ctx.lectureSeule ? 'cal.lectureSeule' : 'cal.nonModifiable')}`,
    vars: { '--cal-col': segment.colDebut + 1, '--cal-span': segment.colFin - segment.colDebut + 1, '--cal-piste': segment.piste + 2 },
    on: { click: () => ctx.ouvrir(evenement.id), keydown: surTouche(() => ctx.ouvrir(evenement.id)) },
  }, !segment.prolongeAvant && evenement.heureDebut ? [h('span', { class: 'cal-heure' }, evenement.heureDebut), ' '] : null, evenement.titre || ctx.t('cal.sansTitre'));
  if (modifiable) rendreGlissable(element, { id: evenement.id, jours, zone, glisse: ctx.glisse });
  ctx.appliquerCouleur(element, evenement);
  return element;
}

function construireJour(ctx, { jour, dansLeMois }, colonne) {
  const aujourdhui = jour === ctx.aujourdhui();
  const peutAjouter = ctx.peutAjouter();
  const ajouter = () => { if (peutAjouter) ouvrirSaisie(ctx, { jour, cellule: fond }); };
  const nom = ctx.etat.vue === 'semaine' ? `${nomCourt(jour, ctx.langue)} ` : '';
  const debutDeMois = jour.endsWith('-01') && ctx.etat.vue === 'mois' ? ` ${premierDuMoisAffiche(jour, ctx.langue)}` : '';
  const fond = h('div', {
    class: `cal-fond${dansLeMois ? '' : ' cal-hors-mois'}${aujourdhui ? ' cal-aujourdhui-fond' : ''}`, dataset: { jour }, vars: { '--cal-col': colonne + 1 },
    on: { click: ajouter },
  });
  const numero = h('div', {
    class: `cal-num${aujourdhui ? ' cal-num-aujourdhui' : ''}${dansLeMois ? '' : ' cal-num-hors-mois'}`, role: 'button', tabindex: '0',
    'aria-label': ctx.t('cal.ajouterAria', { jour: libelleJour(jour, ctx.langue) }), 'aria-disabled': peutAjouter ? undefined : 'true', 'aria-current': aujourdhui ? 'date' : undefined,
    vars: { '--cal-col': colonne + 1, '--cal-piste': 1 }, dataset: { jour }, on: { click: ajouter, keydown: surTouche(ajouter) },
  }, `${nom}${numeroDuJour(jour)}${debutDeMois}`);
  return { fond, numero };
}

export function construireZone(ctx, ligne, evenements, maxPistes) {
  const jours = ligne.map(cellule => cellule.jour);
  const placement = placerSemaine(evenements, jours, { maxPistes });
  const cellules = ligne.map((cellule, colonne) => construireJour(ctx, cellule, colonne));
  const fonds = h('div', { class: 'cal-fonds' }, cellules.map(c => c.fond));
  const grille = h('div', { class: 'cal-jours', vars: { '--cal-pistes': maxPistes } }, cellules.map(c => c.numero));
  const zone = h('div', { class: 'cal-zone' }, fonds, grille);
  for (const segment of placement.segments) grille.append(construireEvenement(ctx, segment, jours, zone));
  placement.caches.forEach((nombre, colonne) => {
    if (!nombre) return;
    const ouvrir = () => ouvrirListeDuJour(ctx, { jour: jours[colonne], cellule: cellules[colonne].fond });
    grille.append(h('div', {
      class: 'cal-plus', role: 'button', tabindex: '0', 'aria-label': ctx.t('cal.plusAria', { jour: libelleJour(jours[colonne], ctx.langue) }),
      vars: { '--cal-col': colonne + 1 }, on: { click: ouvrir, keydown: surTouche(ouvrir) },
    }, ctx.t('cal.plus', { n: nombre })));
  });
  accepterDepots(zone, jours, ctx.glisse, {
    survol: jour => fonds.querySelectorAll('.cal-fond').forEach(fond => fond.classList.toggle('cal-survol', fond.dataset.jour === jour)),
    depose: jour => ctx.deposer(jour),
  });
  return zone;
}

export function construireGrille(ctx, lignes) {
  const maxPistes = ctx.capacite();
  const entete = h('div', { class: 'cal-entete', role: 'row' }, h('div', { class: 'cal-sem' }), h('div', { class: 'cal-noms' }, lignes[0].map(({ jour }) => h('div', { class: 'cal-nom', role: 'columnheader' }, nomCourt(jour, ctx.langue)))));
  const corps = h('div', { class: `cal-corps cal-${ctx.etat.vue}` }, lignes.map(ligne => {
    const numero = semaineDeLaLigne(ligne.map(cellule => cellule.jour));
    return h('div', { class: 'cal-ligne', role: 'row' },
      h('div', { class: 'cal-sem', 'aria-label': ctx.t('cal.semaineAria', { n: numero }) }, ctx.t('cal.semaineNumero', { n: numero })),
      construireZone(ctx, ligne, ctx.modele.evenements, maxPistes));
  }));
  return [entete, corps];
}
