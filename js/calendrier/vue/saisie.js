// La saisie rapide : un champ de titre ouvert sur place dans un jour. Entrée envoie, Échap annule, un titre vide n'envoie rien.
import { h } from '../lien-kit.js';
import { libelleJour } from '../noyau/format.js';
import { poserPres } from './flottant.js';

// `debut` : le moment envoyé (le jour par défaut, ou jour + heure dans la grille horaire) ; `decalage` : où poser le champ sous le haut de `cellule` (le bas de la cellule par défaut).
export function ouvrirSaisie(ctx, { jour, cellule, debut = jour, decalage }) {
  const couche = ctx.flottant;
  fermerSaisie(couche);
  let envoi = false;
  const champ = h('input', { type: 'text', class: 'cal-saisie-champ', 'aria-label': ctx.t('cal.ajouterAria', { jour: libelleJour(jour, ctx.langue) }), placeholder: ctx.t('cal.ajouterChamp'), title: ctx.t('cal.ajouterAide'), maxlength: '200', autocomplete: 'off' });
  const boite = h('div', { class: 'cal-saisie', dataset: { jour } }, champ);
  const fermer = () => { if (boite.isConnected) boite.remove(); };
  const valider = async () => {
    const titre = champ.value.trim();
    if (!titre || envoi) return;
    envoi = true;
    champ.setAttribute('aria-busy', 'true');
    try {
      await ctx.ajouter({ debut, titre });
      fermer();
    } catch (erreur) {
      champ.removeAttribute('aria-busy');
      champ.setAttribute('aria-invalid', 'true');
      envoi = false;
    }
  };
  champ.addEventListener('keydown', touche => {
    if (touche.key === 'Enter') { touche.preventDefault(); valider(); }
    else if (touche.key === 'Escape') { touche.stopPropagation(); fermer(); }
  });
  champ.addEventListener('blur', () => { if (!envoi) fermer(); });
  poserPres(boite, couche, cellule, { decalage: decalage === undefined ? Math.max(0, cellule.getBoundingClientRect().height - 32) : decalage, largeurMin: 150 });
  champ.focus();
}

export function fermerSaisie(couche) {
  couche.querySelectorAll('.cal-saisie').forEach(boite => boite.remove());
}
