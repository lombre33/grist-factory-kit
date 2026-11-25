// Charger un script par un CDN, et par la copie de GFS quand le CDN échoue ou tarde (contrats de GFS 5.2, point 14 ; choix du porteur, 25/11 : le secours est la copie figée de GFS, jamais un
// deuxième CDN). L'événement `error` d'une balise `<script>` ne dit rien de plus que « pas chargé » : un hôte mort, des octets que l'empreinte refuse et une adresse que la politique de sécurité
// de l'app ne nomme pas le lèvent de la même façon, et la copie de GFS (même version, sa propre empreinte, `'self'` suffit) les couvre tous. Un hôte qui ne répond jamais ne lève rien : une
// minuterie (3 s) décide alors. Le CDN qui répondrait après coup exécuterait à son tour ses octets, les mêmes que ceux de la copie (l'empreinte l'a prouvé) : pour une bibliothèque qui pose un
// nom global, sans effet. Sans secours, la balise attend le navigateur, sans minuterie : rien ne change pour une app qui n'a pas de secours à donner.
//   const lib = GfsLink.library('plotly');                       // ou { src, integrite, forme } de la liste de l'app pour une bibliothèque native
//   await loadScript(lib, { secours: GfsLink.secours('plotly', version) });

export const SECOURS_DELAI = 3000;

// Une balise, une tentative : résolue au `load`, rejetée à l'`error` ou, si `delai` > 0, quand il passe sans réponse.
function attempt(doc, lib, delay) {
  return new Promise((resolve, reject) => {
    const tag = doc.createElement('script');
    const integrity = lib.integrite || lib.integrity;
    if (lib.forme === 'module' || lib.type === 'module') tag.type = 'module';
    tag.src = lib.src;
    if (integrity) { tag.integrity = integrity; tag.crossOrigin = 'anonymous'; }
    const timer = delay > 0 ? setTimeout(() => reject(new Error(`pas de réponse en ${delay} ms : ${lib.src}`)), delay) : null;
    tag.onload = () => { clearTimeout(timer); resolve(); };
    tag.onerror = () => { clearTimeout(timer); reject(new Error(`chargement refusé ou en échec : ${lib.src}`)); };
    (doc.head || doc.documentElement).append(tag);
  });
}

// `lib` : { src, integrite, forme } (celui que rend `GfsLink.library`, ou l'adresse de l'app) ; `secours` : celui que rend `GfsLink.secours`, ou `null`. Rend { src, secours } : l'adresse qui a
// chargé et si c'est la copie de GFS. Rejette avec l'erreur du dernier essai : sans secours, celle du CDN ; avec, celle de la copie.
export async function loadScript(lib, { secours = null, delai = SECOURS_DELAI, doc = document } = {}) {
  try {
    await attempt(doc, lib, secours ? delai : 0);
    return { src: lib.src, secours: false };
  } catch (error) {
    if (!secours) throw error;
    console.warn(`[kit] ${error.message} : la copie de GFS prend le relais`);
    await attempt(doc, secours, 0);
    return { src: secours.src, secours: true };
  }
}
