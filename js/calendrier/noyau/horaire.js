// Les blocs horaires d'un jour (vues Semaine et Jour) : où chaque événement avec heure commence et finit dans la journée, comment les blocs qui se chevauchent se partagent la largeur,
// et comment un glisser change le jour et l'heure (pas de 15 minutes, durée conservée). Tout est en minutes depuis minuit ; les heures sont celles de l'hôte, sans fuseau.
import { jourDepuisNumero, numeroDeJour } from './dates.js';

export const PAS = 15;
export const MINUTES_PAR_JOUR = 1440;
const DUREE_PAR_DEFAUT = 60;

export const enMinutes = heure => Number(heure.slice(0, 2)) * 60 + Number(heure.slice(3, 5));
const deux = n => String(n).padStart(2, '0');
export const enHeure = minutes => `${deux(Math.floor(minutes / 60))}:${deux(minutes % 60)}`;
export const arrondir = (minutes, pas = PAS) => Math.round(minutes / pas) * pas;

// La minute de fin, le jour où l'événement finit : un début sans fin (ou une fin égale au début) dure une heure ; une fin sans heure, sur un autre jour, couvre ce jour entier.
function minutesDeFin(evenement) {
  const debut = evenement.heureDebut ? enMinutes(evenement.heureDebut) : 0;
  const memeJour = evenement.fin === evenement.debut;
  if (!evenement.heureFin) return memeJour ? Math.min(MINUTES_PAR_JOUR, debut + DUREE_PAR_DEFAUT) : MINUTES_PAR_JOUR;
  const fin = enMinutes(evenement.heureFin);
  return memeJour && fin <= debut ? Math.min(MINUTES_PAR_JOUR, debut + DUREE_PAR_DEFAUT) : fin;
}

// Le bloc d'un événement un jour donné : ses minutes de début et de fin dans ce jour (0 à 1440), ou null s'il n'a pas d'heure ou ne tombe pas ce jour.
export function blocDuJour(evenement, jour) {
  if (evenement.sansDate || !evenement.avecHeure || jour < evenement.debut || jour > evenement.fin) return null;
  const debut = jour === evenement.debut && evenement.heureDebut ? enMinutes(evenement.heureDebut) : 0;
  const fin = jour === evenement.fin ? minutesDeFin(evenement) : MINUTES_PAR_JOUR;
  return { debut, fin: Math.max(fin, debut + PAS), evenement };
}

// Les événements du jour sans heure : la bande « Toute la journée ».
export const toutesLaJournee = (evenements, jour) => evenements.filter(e => !e.sansDate && !e.avecHeure && e.debut <= jour && jour <= e.fin);

const comparer = (a, b) => (a.debut - b.debut) || (b.fin - a.fin) || (a.evenement.titre < b.evenement.titre ? -1 : a.evenement.titre > b.evenement.titre ? 1 : String(a.evenement.id) < String(b.evenement.id) ? -1 : 1);

// Les blocs d'un jour, chacun avec sa colonne et le nombre de colonnes de son groupe de blocs qui se chevauchent : { id, evenement, debut, fin, colonne, colonnes }.
export function blocsDuJour(evenements, jour) {
  const blocs = evenements.map(e => blocDuJour(e, jour)).filter(Boolean).sort(comparer);
  const resultat = [];
  let groupe = [];
  let finDuGroupe = -1;
  const clore = () => {
    const colonnes = groupe.reduce((max, bloc) => Math.max(max, bloc.colonne + 1), 0);
    for (const bloc of groupe) resultat.push({ ...bloc, colonnes });
    groupe = [];
  };
  for (const bloc of blocs) {
    if (groupe.length && bloc.debut >= finDuGroupe) { clore(); finDuGroupe = -1; }
    const prises = new Set(groupe.filter(autre => autre.fin > bloc.debut).map(autre => autre.colonne));
    let colonne = 0;
    while (prises.has(colonne)) colonne += 1;
    groupe.push({ id: bloc.evenement.id, evenement: bloc.evenement, debut: bloc.debut, fin: bloc.fin, colonne });
    finDuGroupe = Math.max(finDuGroupe, bloc.fin);
  }
  clore();
  return resultat;
}

const absolu = (jour, minutes) => numeroDeJour(jour) * MINUTES_PAR_JOUR + minutes;
function depuisAbsolu(total) {
  const jour = Math.floor(total / MINUTES_PAR_JOUR);
  return `${jourDepuisNumero(jour)}T${enHeure(total - jour * MINUTES_PAR_JOUR)}`;
}

// Déplacer un événement avec heure : le point saisi (jour, minute) va au point déposé ; début et fin se décalent du même nombre de minutes, arrondi au pas. Rend { id, debut, fin } ou null.
// Un événement sans heure déposé dans la grille horaire reçoit l'heure déposée et une heure de durée.
export function deplacerHoraire(evenement, saisi, depose) {
  if (evenement.modifiable === false) return null;
  const arrive = arrondir(depose.minute);
  if (evenement.sansDate || !evenement.avecHeure) {
    const debut = absolu(depose.jour, arrive);
    return { id: evenement.id, debut: depuisAbsolu(debut), fin: depuisAbsolu(debut + DUREE_PAR_DEFAUT) };
  }
  const debutHeure = evenement.heureDebut ? enMinutes(evenement.heureDebut) : 0;
  const depart = absolu(evenement.debut, debutHeure);
  const pointSaisi = absolu(saisi.jour, saisi.minute);
  const decalage = arrondir(absolu(depose.jour, depose.minute) - pointSaisi);
  if (decalage === 0) return null;
  return { id: evenement.id, debut: depuisAbsolu(depart + decalage), fin: depuisAbsolu(absolu(evenement.fin, minutesDeFin(evenement)) + decalage) };
}
