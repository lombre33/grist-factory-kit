// Des lignes de l'hôte aux événements du calendrier : lecture stricte des dates, jamais « réparée » en silence. Une ligne sans date va au plateau « Sans date » ; une ligne dont
// la date est illisible ou dont la fin précède le début est écartée et rendue dans `invalides`, avec sa raison, pour que l'hôte le dise.
import { lireMoment } from './dates.js';

const VIDE = valeur => valeur === null || valeur === undefined || valeur === '';
const COULEUR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9 .,%/-]+\))$/i;

export function couleurValide(couleur) {
  const lire = valeur => (typeof valeur === 'string' && COULEUR.test(valeur.trim()) ? valeur.trim() : null);
  if (!couleur || typeof couleur !== 'object') return null;
  const fond = lire(couleur.fond);
  const texte = lire(couleur.texte);
  return fond || texte ? { fond, texte } : null;
}

function listeDeTextes(valeur) {
  if (VIDE(valeur)) return [];
  return (Array.isArray(valeur) ? valeur : [valeur]).filter(item => !VIDE(item)).map(String);
}

function lireDates(ligne) {
  const avecHeure = ligne.avecHeure !== false;
  const lire = brut => {
    const moment = lireMoment(brut);
    return moment && !avecHeure ? { jour: moment.jour, heure: null } : moment;
  };
  if (VIDE(ligne.debut) && VIDE(ligne.fin)) return { sansDate: true };
  const debut = VIDE(ligne.debut) ? null : lire(ligne.debut);
  const fin = VIDE(ligne.fin) ? null : lire(ligne.fin);
  if ((!VIDE(ligne.debut) && !debut) || (!VIDE(ligne.fin) && !fin)) return { erreur: 'date-illisible' };
  const debutFinal = debut || fin;
  const finFinal = fin || debut;
  const avant = debutFinal.jour === finFinal.jour ? (debutFinal.heure || '') > (finFinal.heure || '') : debutFinal.jour > finFinal.jour;
  return avant ? { erreur: 'fin-avant-debut' } : { debut: debutFinal, fin: finFinal };
}

export function normaliserLigne(ligne) {
  const base = {
    id: ligne.id,
    titre: VIDE(ligne.titre) ? '' : String(ligne.titre),
    statut: VIDE(ligne.statut) ? '' : String(ligne.statut),
    couleur: couleurValide(ligne.couleur),
    responsables: listeDeTextes(ligne.responsables),
    modifiable: ligne.modifiable !== false,
  };
  const dates = lireDates(ligne);
  if (dates.erreur) return { erreur: dates.erreur };
  if (dates.sansDate) return { evenement: { ...base, debut: null, fin: null, heureDebut: null, heureFin: null, avecHeure: false, sansDate: true } };
  const { debut, fin } = dates;
  const avecHeure = debut.heure !== null || fin.heure !== null;
  return { evenement: { ...base, debut: debut.jour, fin: fin.jour, heureDebut: debut.heure, heureFin: fin.heure, avecHeure, sansDate: false } };
}

export function normaliser(lignes) {
  const evenements = [];
  const sansDate = [];
  const invalides = [];
  const vus = new Set();
  for (const ligne of Array.isArray(lignes) ? lignes : []) {
    if (!ligne || VIDE(ligne.id)) { invalides.push({ id: ligne ? ligne.id : undefined, raison: 'id-manquant' }); continue; }
    if (vus.has(String(ligne.id))) { invalides.push({ id: ligne.id, raison: 'id-en-double' }); continue; }
    vus.add(String(ligne.id));
    const { evenement, erreur } = normaliserLigne(ligne);
    if (erreur) invalides.push({ id: ligne.id, raison: erreur });
    else (evenement.sansDate ? sansDate : evenements).push(evenement);
  }
  return { evenements, sansDate, invalides };
}
