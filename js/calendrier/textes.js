// Les textes du module, en français et en anglais ensemble. Une instance de traduction à lui : la langue vient de l'hôte (options.langue), jamais d'un réglage du module.
import { createI18n } from './lien-kit.js';

export const TEXTES = {
  'cal.precedent': { fr: 'Précédent', en: 'Previous' },
  'cal.suivant': { fr: 'Suivant', en: 'Next' },
  'cal.aujourdhui': { fr: 'Aujourd\'hui', en: 'Today' },
  'cal.mois': { fr: 'Mois', en: 'Month' },
  'cal.semaine': { fr: 'Semaine', en: 'Week' },
  'cal.jour': { fr: 'Jour', en: 'Day' },
  'cal.vues': { fr: 'Vue du calendrier', en: 'Calendar view' },
  'cal.sansDate': { fr: 'Sans date', en: 'No date' },
  'cal.sansDateTitre': { fr: 'Tâches sans date', en: 'Tasks without a date' },
  'cal.sansDateVide': { fr: 'Aucune tâche sans date', en: 'No task without a date' },
  'cal.sansDateAide': { fr: 'Glissez une tâche sur un jour pour lui donner une date.', en: 'Drag a task onto a day to give it a date.' },
  'cal.semaineNumero': { fr: 'S{n}', en: 'W{n}' },
  'cal.semaineAria': { fr: 'Semaine {n}', en: 'Week {n}' },
  'cal.plus': { fr: '+{n}', en: '+{n}' },
  'cal.plusAria': { fr: 'Voir toutes les tâches du {jour}', en: 'See all tasks of {jour}' },
  'cal.listeJour': { fr: 'Tâches du {jour}', en: 'Tasks of {jour}' },
  'cal.fermer': { fr: 'Fermer', en: 'Close' },
  'cal.ajouterAria': { fr: 'Ajouter une tâche le {jour}', en: 'Add a task on {jour}' },
  'cal.ajouterChamp': { fr: 'Titre de la tâche', en: 'Task title' },
  'cal.ajouterAide': { fr: 'Entrée pour ajouter, Échap pour annuler', en: 'Enter to add, Esc to cancel' },
  'cal.lectureSeule': { fr: 'Lecture seule : les dates ne se modifient pas', en: 'Read only: dates cannot be changed' },
  'cal.nonModifiable': { fr: 'Cette tâche ne peut pas être déplacée', en: 'This task cannot be moved' },
  'cal.sansTitre': { fr: 'Sans titre', en: 'Untitled' },
  'cal.ecartees': { fr: '{n|Une tâche écartée : date illisible ou fin avant le début|{n} tâches écartées : date illisible ou fin avant le début}', en: '{n|One task left out: unreadable date or end before start|{n} tasks left out: unreadable date or end before start}' },
};

export function creerTraduction(langue) {
  return createI18n({ strings: TEXTES, language: langue === 'en' ? 'en' : 'fr' });
}
