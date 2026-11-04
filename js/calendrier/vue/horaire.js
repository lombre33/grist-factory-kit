// La grille horaire des vues Semaine et Jour : 24 heures de haut, une colonne par jour, des blocs placés à leur heure (côte à côte quand ils se chevauchent), glisser pour changer le
// jour et l'heure (au quart d'heure), clic dans une colonne vide pour ajouter à cette heure.
import { h } from '../lien-kit.js';
import { arrondir, blocsDuJour, enHeure, MINUTES_PAR_JOUR } from '../noyau/horaire.js';
import { rendreGlissable } from './glisser.js';
import { ouvrirSaisie } from './saisie.js';

export const HEURE_AU_DEFILEMENT = 7;
const HEURES = Array.from({ length: 24 }, (_, i) => i);

function minuteSousLeCurseur(colonne, y) {
  const rect = colonne.getBoundingClientRect();
  if (!rect.height) return 0;
  return Math.min(MINUTES_PAR_JOUR - 1, Math.max(0, Math.round(((y - rect.top) / rect.height) * MINUTES_PAR_JOUR)));
}

function construireBloc(ctx, bloc, jour, colonne) {
  const evenement = bloc.evenement;
  const modifiable = !ctx.lectureSeule && evenement.modifiable;
  const ouvrir = () => ctx.ouvrir(evenement.id);
  const element = h('div', {
    class: `cal-bloc${modifiable ? '' : ' cal-grise'}`, role: 'button', tabindex: '0', dataset: { id: String(evenement.id) },
    title: modifiable ? evenement.titre : `${evenement.titre} · ${ctx.t(ctx.lectureSeule ? 'cal.lectureSeule' : 'cal.nonModifiable')}`,
    vars: { '--cal-debut': (bloc.debut / MINUTES_PAR_JOUR) * 100, '--cal-duree': ((bloc.fin - bloc.debut) / MINUTES_PAR_JOUR) * 100, '--cal-rang': bloc.colonne, '--cal-rangs': bloc.colonnes },
    on: { click: ouvrir, keydown: touche => { if (touche.key === 'Enter' || touche.key === ' ') { touche.preventDefault(); ouvrir(); } } },
  }, jour === evenement.debut ? [h('span', { class: 'cal-heure' }, enHeure(bloc.debut)), ' '] : null, evenement.titre || ctx.t('cal.sansTitre'));
  if (modifiable) {
    rendreGlissable(element, { id: evenement.id, jours: null, zone: null, glisse: ctx.glisse });
    element.addEventListener('dragstart', glisser => { ctx.glisse.courant = { id: evenement.id, saisi: { jour, minute: minuteSousLeCurseur(colonne, glisser.clientY) } }; });
  }
  ctx.appliquerCouleur(element, evenement);
  return element;
}

function construireColonne(ctx, jour) {
  const aujourdhui = jour === ctx.aujourdhui();
  const colonne = h('div', { class: `cal-colonne${aujourdhui ? ' cal-aujourdhui-fond' : ''}`, dataset: { jour } });
  for (const bloc of blocsDuJour(ctx.modele.evenements, jour)) colonne.append(construireBloc(ctx, bloc, jour, colonne));
  colonne.addEventListener('click', clic => {
    if (clic.target !== colonne || !ctx.peutAjouter()) return;
    const minute = Math.floor(minuteSousLeCurseur(colonne, clic.clientY) / 15) * 15;
    const rect = colonne.getBoundingClientRect();
    const pointe = { getBoundingClientRect: () => ({ left: rect.left, top: clic.clientY, width: rect.width, height: 0, bottom: clic.clientY }) };
    ouvrirSaisie(ctx, { jour, cellule: pointe, debut: `${jour}T${enHeure(minute)}`, decalage: 0 });
  });
  colonne.addEventListener('dragover', glisser => {
    if (!ctx.glisse.courant) return;
    glisser.preventDefault();
    colonne.classList.add('cal-survol');
  });
  colonne.addEventListener('dragleave', glisser => { if (!colonne.contains(glisser.relatedTarget)) colonne.classList.remove('cal-survol'); });
  colonne.addEventListener('drop', glisser => {
    if (!ctx.glisse.courant) return;
    glisser.preventDefault();
    colonne.classList.remove('cal-survol');
    ctx.deposerHoraire(jour, arrondir(minuteSousLeCurseur(colonne, glisser.clientY)));
  });
  return colonne;
}

export function construireHoraire(ctx, jours) {
  const etiquettes = h('div', { class: 'cal-etiquettes', 'aria-hidden': 'true' }, HEURES.map(heure => h('div', { class: 'cal-etiquette' }, heure ? enHeure(heure * 60) : '')));
  const colonnes = h('div', { class: 'cal-colonnes', vars: { '--cal-n': jours.length } }, jours.map(jour => construireColonne(ctx, jour)));
  return h('div', { class: 'cal-heures' }, etiquettes, colonnes);
}
