// La liste d'un jour (le clic sur « +n ») : toutes les tâches du jour, une fenêtre légère qui se ferme avec Échap ou quand le focus la quitte.
import { h } from '../lien-kit.js';
import { evenementsDuJour } from '../noyau/placement.js';
import { libelleJour } from '../noyau/format.js';
import { poserPres } from './flottant.js';

export function ouvrirListeDuJour(ctx, { jour, cellule }) {
  const couche = ctx.flottant;
  couche.querySelectorAll('.cal-liste').forEach(liste => liste.remove());
  const lignes = evenementsDuJour(ctx.modele.evenements, jour).map(evenement => {
    const ouvrir = () => { fermer(); ctx.ouvrir(evenement.id); };
    const ligne = h('div', { class: 'cal-liste-ligne', role: 'button', tabindex: '0', on: { click: ouvrir, keydown: touche => { if (touche.key === 'Enter' || touche.key === ' ') { touche.preventDefault(); ouvrir(); } } } },
      evenement.heureDebut ? [h('span', { class: 'cal-heure' }, evenement.heureDebut), ' '] : null, evenement.titre || ctx.t('cal.sansTitre'));
    ctx.appliquerCouleur(ligne, evenement);
    return ligne;
  });
  const fermer = () => { if (liste.isConnected) liste.remove(); };
  const bouton = h('button', { type: 'button', class: 'cal-liste-fermer', 'aria-label': ctx.t('cal.fermer'), on: { click: fermer } }, '×');
  const liste = h('div', { class: 'cal-liste', role: 'dialog', 'aria-label': ctx.t('cal.listeJour', { jour: libelleJour(jour, ctx.langue) }), tabindex: '-1',
    on: {
      keydown: touche => { if (touche.key === 'Escape') { touche.stopPropagation(); fermer(); } },
      focusout: evenement => { if (!liste.contains(evenement.relatedTarget)) fermer(); },
    } },
  h('div', { class: 'cal-liste-titre' }, libelleJour(jour, ctx.langue), bouton), h('div', { class: 'cal-liste-corps' }, lignes));
  poserPres(liste, couche, cellule, { decalage: 22, largeurMin: 220 });
  liste.focus();
}
