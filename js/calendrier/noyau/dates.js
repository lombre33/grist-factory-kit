// Les jours civils : du calcul de dates sans fuseau ni heure d'été. Un jour est un texte AAAA-MM-JJ ; tout passe par un numéro de jour (jours depuis le 01/01/1970, UTC), donc
// un changement d'heure ne décale jamais un jour. Les semaines commencent par défaut le lundi (1) ; les numéros de semaine sont ceux de la norme ISO 8601.

const MOTIF_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
const MOTIF_MOMENT = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/;
const MS_PAR_JOUR = 86400000;
const LUNDI = 1;

const deux = n => String(n).padStart(2, '0');

function dateUtc(annee, mois, jour) {
  const date = new Date(0);
  date.setUTCFullYear(annee, mois - 1, jour);
  return date;
}

export function numeroDeJour(texte) {
  const trouve = typeof texte === 'string' ? MOTIF_JOUR.exec(texte) : null;
  if (!trouve) return null;
  const [annee, mois, jour] = [Number(trouve[1]), Number(trouve[2]), Number(trouve[3])];
  const date = dateUtc(annee, mois, jour);
  const juste = date.getUTCFullYear() === annee && date.getUTCMonth() === mois - 1 && date.getUTCDate() === jour;
  return juste ? date.getTime() / MS_PAR_JOUR : null;
}

export const estJour = texte => numeroDeJour(texte) !== null;

export function jourDepuisNumero(numero) {
  const date = new Date(numero * MS_PAR_JOUR);
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${deux(date.getUTCMonth() + 1)}-${deux(date.getUTCDate())}`;
}

export const ajouterJours = (jour, n) => jourDepuisNumero(numeroDeJour(jour) + n);
export const ecartEnJours = (de, a) => numeroDeJour(a) - numeroDeJour(de);

// Le jour d'une date du navigateur, lu à l'heure locale de la personne (ce que dit son horloge : « aujourd'hui »).
export function jourLocal(date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

// `maintenant` est une date, une fonction qui rend une date (une horloge injectée par les essais), ou rien.
export function aujourdhui(maintenant) {
  const date = typeof maintenant === 'function' ? maintenant() : maintenant;
  return jourLocal(date instanceof Date ? date : new Date());
}

// Un moment : « AAAA-MM-JJ » (un jour sans heure) ou « AAAA-MM-JJTHH:mm ». Rend { jour, heure } (heure null sans heure) ou null.
export function lireMoment(texte) {
  const trouve = typeof texte === 'string' ? MOTIF_MOMENT.exec(texte) : null;
  if (!trouve || !estJour(trouve[1])) return null;
  if (trouve[2] === undefined) return { jour: trouve[1], heure: null };
  if (Number(trouve[2]) > 23 || Number(trouve[3]) > 59) return null;
  return { jour: trouve[1], heure: `${trouve[2]}:${trouve[3]}` };
}

export const ecrireMoment = (jour, heure) => (heure ? `${jour}T${heure}` : jour);

// 0 = le premier jour de la semaine (le lundi par défaut), 6 = le dernier.
export function rangDansLaSemaine(jour, premier = LUNDI) {
  const dimancheZero = (numeroDeJour(jour) + 4) % 7;
  return (((dimancheZero - premier) % 7) + 7) % 7;
}

export const debutDeSemaine = (jour, premier = LUNDI) => ajouterJours(jour, -rangDansLaSemaine(jour, premier));

export function joursDeSemaine(jour, premier = LUNDI) {
  const debut = debutDeSemaine(jour, premier);
  return Array.from({ length: 7 }, (_, i) => ajouterJours(debut, i));
}

// Semaine ISO 8601 : celle de son jeudi ; la semaine 1 contient le 4 janvier. Les 29 à 31 décembre peuvent être en semaine 1, les 1er à 3 janvier en semaine 52 ou 53.
export function semaineIso(jour) {
  const jeudi = ajouterJours(jour, 3 - rangDansLaSemaine(jour, LUNDI));
  const annee = Number(jeudi.slice(0, 4));
  const rang = ecartEnJours(`${jeudi.slice(0, 4)}-01-01`, jeudi);
  return { annee, semaine: Math.floor(rang / 7) + 1 };
}

// Le numéro à afficher pour une ligne de sept jours (quel que soit le premier jour de la semaine, le jeudi de la ligne décide).
export function semaineDeLaLigne(jours) {
  const jeudi = jours.find(jour => rangDansLaSemaine(jour, LUNDI) === 3);
  return semaineIso(jeudi).semaine;
}

export const joursDuMois = (annee, mois) => dateUtc(annee, mois + 1, 0).getUTCDate();
export const premierDuMois = jour => `${jour.slice(0, 7)}-01`;

export function dernierDuMois(jour) {
  const [annee, mois] = [Number(jour.slice(0, 4)), Number(jour.slice(5, 7))];
  return `${jour.slice(0, 7)}-${deux(joursDuMois(annee, mois))}`;
}

// Un mois plus ou moins loin, le quantième ramené au dernier jour du mois d'arrivée (31 janvier + 1 mois = 28 ou 29 février).
export function ajouterMois(jour, n) {
  const total = Number(jour.slice(0, 4)) * 12 + (Number(jour.slice(5, 7)) - 1) + n;
  const [annee, mois] = [Math.floor(total / 12), (total % 12 + 12) % 12 + 1];
  const quantieme = Math.min(Number(jour.slice(8, 10)), joursDuMois(annee, mois));
  return `${String(annee).padStart(4, '0')}-${deux(mois)}-${deux(quantieme)}`;
}

// La grille d'un mois : des lignes de sept jours qui couvrent le mois (4 à 6 lignes), chaque jour dit s'il est dans le mois.
export function grilleDuMois(jour, premier = LUNDI) {
  const mois = jour.slice(0, 7);
  const lignes = [];
  let debut = debutDeSemaine(premierDuMois(jour), premier);
  const fin = dernierDuMois(jour);
  while (debut <= fin) {
    lignes.push(joursDeSemaine(debut, premier).map(j => ({ jour: j, dansLeMois: j.slice(0, 7) === mois })));
    debut = ajouterJours(debut, 7);
  }
  return lignes;
}
