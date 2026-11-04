// Déplacer un événement sur un autre jour : l'écart entre le début et la fin est conservé, les heures aussi. Le module ne fait que calculer : l'hôte écrit dans Grist.
import { ajouterJours, ecartEnJours, ecrireMoment } from './dates.js';

// `jourSaisi` : le jour de l'événement sous le doigt quand le glisser a commencé (hors de l'événement, le premier jour est pris) ; `jourDepose` : le jour visé.
// Rend { id, debut, fin } (des textes AAAA-MM-JJ ou AAAA-MM-JJTHH:mm), ou null quand rien ne change.
export function deplacer(evenement, jourSaisi, jourDepose) {
  if (evenement.modifiable === false) return null;
  if (evenement.sansDate) return { id: evenement.id, debut: jourDepose, fin: jourDepose };
  const saisi = jourSaisi >= evenement.debut && jourSaisi <= evenement.fin ? jourSaisi : evenement.debut;
  const ecart = ecartEnJours(saisi, jourDepose);
  if (ecart === 0) return null;
  return {
    id: evenement.id,
    debut: ecrireMoment(ajouterJours(evenement.debut, ecart), evenement.heureDebut),
    fin: ecrireMoment(ajouterJours(evenement.fin, ecart), evenement.heureFin),
  };
}
