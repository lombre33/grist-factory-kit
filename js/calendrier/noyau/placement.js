// Poser les événements sur une ligne de sept jours : une barre par événement et par semaine, rangée sur des pistes (la première piste libre), avec « +n » pour ce qui dépasse.
import { ecartEnJours } from './dates.js';

const comparerTexte = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function comparerSegments(a, b) {
  return (a.colDebut - b.colDebut)
    || (Number(b.prolongeAvant) - Number(a.prolongeAvant))
    || ((b.colFin - b.colDebut) - (a.colFin - a.colDebut))
    || comparerTexte(a.evenement.heureDebut || '', b.evenement.heureDebut || '')
    || comparerTexte(a.evenement.titre, b.evenement.titre)
    || comparerTexte(String(a.id), String(b.id));
}

function segmentsDeLaSemaine(evenements, jours) {
  const [premier, dernier] = [jours[0], jours[6]];
  const segments = [];
  for (const evenement of evenements) {
    if (evenement.sansDate || evenement.fin < premier || evenement.debut > dernier) continue;
    const prolongeAvant = evenement.debut < premier;
    const prolongeApres = evenement.fin > dernier;
    segments.push({
      id: evenement.id,
      evenement,
      colDebut: prolongeAvant ? 0 : ecartEnJours(premier, evenement.debut),
      colFin: prolongeApres ? 6 : ecartEnJours(premier, evenement.fin),
      prolongeAvant,
      prolongeApres,
      piste: 0,
    });
  }
  return segments.sort(comparerSegments);
}

// `maxPistes` : le nombre de pistes que la cellule peut montrer ; au-delà, l'événement est caché et chaque jour qu'il couvre compte un « +n » de plus dans `caches`.
export function placerSemaine(evenements, jours, { maxPistes = Infinity } = {}) {
  const segments = segmentsDeLaSemaine(evenements, jours);
  const dernieres = [];
  for (const segment of segments) {
    let piste = dernieres.findIndex(fin => fin < segment.colDebut);
    if (piste === -1) piste = dernieres.length;
    dernieres[piste] = segment.colFin;
    segment.piste = piste;
  }
  const caches = Array(7).fill(0);
  const visibles = [];
  for (const segment of segments) {
    if (segment.piste < maxPistes) { visibles.push(segment); continue; }
    for (let col = segment.colDebut; col <= segment.colFin; col += 1) caches[col] += 1;
  }
  return { segments: visibles, caches, pistes: Math.min(dernieres.length, maxPistes) };
}

// La liste d'un jour (le clic sur « +n ») : ce qui dure plusieurs jours d'abord, puis par heure, puis par titre.
export function evenementsDuJour(evenements, jour) {
  const duree = e => ecartEnJours(e.debut, e.fin);
  return evenements
    .filter(e => !e.sansDate && e.debut <= jour && jour <= e.fin)
    .sort((a, b) => (Number(duree(b) > 0) - Number(duree(a) > 0))
      || comparerTexte(a.heureDebut || '', b.heureDebut || '')
      || comparerTexte(a.titre, b.titre)
      || comparerTexte(String(a.id), String(b.id)));
}
