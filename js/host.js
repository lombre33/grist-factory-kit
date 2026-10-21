// Seule ou dans GFS : GFS donne au cadre de l'app le numéro de son contrat (`gfs=<n>` dans l'adresse, contrats de GFS 1.3), et l'app sait ainsi, tout de suite et sans rien
// demander, qu'elle est hébergée. Lu par la traduction (la langue que GFS donne au cadre) et par le lien avec GFS (js/gfs-link.js). Sans état.

// Le numéro de contrat de GFS dans `search` (la requête d'une adresse), ou null quand GFS n'héberge pas l'app.
export function hostContract(search) {
  const raw = new URLSearchParams(search || '').get('gfs');
  return /^\d{1,6}$/.test(raw || '') ? Number(raw) : null;
}
