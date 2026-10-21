// Les modules du kit qui gardent un état (la langue, la pile des fenêtres, les rangs des couches) n'existent qu'une fois par page. Les charger par deux adresses (un `?v=` posé
// sur l'un et pas sur l'autre) en ferait deux, chacun avec son état : la langue de l'un ne serait pas celle de l'autre, et le clavier tenu par deux piles. Le deuxième le dit au lieu
// de s'écarter sans bruit ; la correction est côté app : importer chaque module du kit par une seule adresse (carte d'importation).
export function once(name, url) {
  const key = Symbol.for(`grist-factory-kit/${name}`);
  if (globalThis[key]) console.warn(`Kit : ${name} est chargé deux fois (${globalThis[key]} et ${url}). Importer le kit par une seule adresse par module.`);
  else globalThis[key] = url;
}
