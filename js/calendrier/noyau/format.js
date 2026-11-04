// Les noms des jours et des mois, par Intl, sur des jours civils (lus en UTC pour qu'aucun fuseau ne décale un jour).
import { numeroDeJour } from './dates.js';

const MS_PAR_JOUR = 86400000;
const date = jour => new Date(numeroDeJour(jour) * MS_PAR_JOUR);
const formateur = (langue, options) => new Intl.DateTimeFormat(langue, { ...options, timeZone: 'UTC' });
export const majuscule = texte => (texte ? texte[0].toUpperCase() + texte.slice(1) : texte);

export const titreDuMois = (jour, langue) => majuscule(formateur(langue, { month: 'long', year: 'numeric' }).format(date(jour)));

export function titreDeSemaine(jours, langue) {
  return formateur(langue, { day: 'numeric', month: 'short', year: 'numeric' }).formatRange(date(jours[0]), date(jours[6]));
}

// « Lun » pour lundi : l'abréviation de la langue, sans point final, la première lettre en capitale.
export const nomCourt = (jour, langue) => majuscule(formateur(langue, { weekday: 'short' }).format(date(jour)).replace(/\.$/, ''));
export const libelleJour = (jour, langue) => formateur(langue, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date(jour));
export const numeroDuJour = jour => String(Number(jour.slice(8, 10)));
export const premierDuMoisAffiche = (jour, langue) => formateur(langue, { month: 'short' }).format(date(jour)).replace(/\.$/, '');
