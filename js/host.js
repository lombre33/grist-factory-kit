// Seule ou dans GFS : GFS donne au cadre de l'app le numéro de son contrat (`gfs=<n>` dans l'adresse, contrats de GFS 1.3), et l'app sait ainsi, tout de suite et sans rien
// demander, qu'elle est hébergée. Lu par la traduction (la langue que GFS donne au cadre) et par le lien avec GFS (js/gfs-link.js). Sans état.

// Le numéro de contrat de GFS dans `search` (la requête d'une adresse), ou null quand GFS n'héberge pas l'app.
export function hostContract(search) {
  const raw = new URLSearchParams(search || '').get('gfs');
  return /^\d{1,6}$/.test(raw || '') ? Number(raw) : null;
}

// Les fonctions de bibliothèques natives dont la personne a choisi la copie figée **rangée dans l'app** (`copie=editeur,…` dans l'adresse, contrats de GFS 2.6 point 14 et 1.3) : l'app doit
// le savoir avant d'écrire sa carte d'importation, donc tout de suite et sans rien demander. Une liste d'identifiants, vide quand GFS n'héberge pas l'app ou n'en dit rien.
export function hostCopies(search) {
  if (hostContract(search) === null) return [];
  return (new URLSearchParams(search || '').get('copie') || '').split(',').filter(id => /^[a-z][a-z0-9_-]{0,63}$/.test(id));
}

