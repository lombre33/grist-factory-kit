// Où est le calendrier : s'ouvrir sur aujourd'hui (et non sur la date du premier enregistrement, le défaut du calendrier officiel), avancer et reculer d'un mois ou d'une semaine.
import { ajouterJours, ajouterMois, aujourdhui, estJour, grilleDuMois, joursDeSemaine } from './dates.js';

export const VUES = Object.freeze(['mois', 'semaine', 'jour']);

export const vueValide = vue => (VUES.includes(vue) ? vue : 'mois');

export function jourInitial(jourCourant, maintenant) {
  return estJour(jourCourant) ? jourCourant : aujourdhui(maintenant);
}

export function voisin(vue, jour, sens) {
  if (vue === 'jour') return ajouterJours(jour, sens);
  return vue === 'semaine' ? ajouterJours(jour, 7 * sens) : ajouterMois(jour, sens);
}

// Les lignes à dessiner : un mois en 4 à 6 lignes de sept jours, une semaine en une, un jour en une ligne d'un seul jour.
export function lignesDeLaVue(vue, jour, premier = 1) {
  if (vue === 'jour') return [[{ jour, dansLeMois: true }]];
  if (vue === 'semaine') return [joursDeSemaine(jour, premier).map(j => ({ jour: j, dansLeMois: true }))];
  return grilleDuMois(jour, premier);
}
