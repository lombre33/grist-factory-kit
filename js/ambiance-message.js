// Le message d'ambiance de GFS tel qu'une app le lit (contrats de GFS 5.2, point 10) : un seul choix d'ambiance et de couleur par personne, que GFS donne à toutes ses apps, par le contexte puis par
// l'événement `ambiance`. `{ id, couleur, ajustee, clair, sombre, forme }` : `clair` et `sombre` portent les jetons de couleur de chaque mode (des `#rrggbb`), `forme` ceux de forme (arrondis, traits, ombres,
// polices, fonds : des textes de CSS écrits en termes des jetons de couleur). `null` : rien n'est choisi, l'app garde ses couleurs.
// L'app ne pose que les jetons qu'elle connaît, ceux des deux listes ci-dessous (test/ambiance.test.mjs de GFS les accorde avec celles du moteur de GFS), après avoir vérifié la valeur : une couleur est un
// `#rrggbb`, une valeur de forme ne porte ni `;`, `{`, `}`, `url(` ni `@import`. Tout le reste est ignoré, et une forme inconnue vaut null (l'app garde ses couleurs plutôt que de croire n'importe quoi).

// Les dix-neuf jetons de couleur de chaque mode : les quinze de la charte (css/tokens.css) et quatre de décor (le filet, le bout du dégradé du bouton et de l'avatar, l'ombre dure).
export const COLOR_TOKENS = Object.freeze([
  '--bg', '--surface', '--surface-sunken', '--border', '--border-strong', '--text', '--text-muted',
  '--accent', '--accent-hover', '--accent-solid', '--accent-solid-hover', '--on-accent', '--accent-ink', '--accent-soft', '--accent-soft-border',
  '--accent-2', '--accent-3', '--accent-end', '--hard',
]);

// Les jetons de forme qu'une ambiance peut redire. Une app qui n'en lit pas un garde sa forme et prend les couleurs.
export const SHAPE_TOKENS = Object.freeze([
  '--avatar-bg', '--avatar-fg', '--avatar-line', '--bar-w', '--bw', '--divider', '--divider-w', '--ex-bg', '--fill', '--fill-hover', '--fill-line',
  '--font-head', '--font-label', '--font-ui', '--fs-head', '--fw-head', '--gap', '--ls-head', '--ls-label', '--main-bg', '--main-overflow',
  '--radius-btn', '--radius-input', '--radius-lg', '--radius-md', '--radius-panel', '--radius-pill', '--radius-sm', '--radius-xs',
  '--shadow-ctl', '--shadow-float', '--shadow-panel', '--stripe', '--stripe-h', '--tt-head', '--wash', '--wash-size',
]);

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const UNSAFE = /[;{}]|url\(|@import/i;
const MAX_LENGTH = 600; // la plus longue valeur de GFS en fait 225 (le fond de Pop)

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Les jetons de couleur d'un mode, en minuscules ; ceux qui manquent ou ne sont pas un `#rrggbb` n'y sont pas.
function colors(raw) {
  const found = {};
  if (!isObject(raw)) return found;
  for (const name of COLOR_TOKENS) if (typeof raw[name] === 'string' && HEX.test(raw[name])) found[name] = raw[name].toLowerCase();
  return found;
}

// Les jetons de forme : le texte tel que GFS l'a écrit, s'il ne sort pas de sa déclaration.
function shapes(raw) {
  const found = {};
  if (!isObject(raw)) return found;
  for (const name of SHAPE_TOKENS) {
    const value = raw[name];
    if (typeof value === 'string' && value.trim() !== '' && value.length <= MAX_LENGTH && !UNSAFE.test(value)) found[name] = value.trim();
  }
  return found;
}

// Le message que l'app peut poser, ou null : ce qui n'est pas un objet, n'a pas d'`id` de la forme attendue, ou ne porte aucun jeton de couleur valable. `couleur` : la couleur libre de la personne
// (`#rrggbb`), ou null ; `ajustee` : GFS l'a éclaircie ou assombrie pour que le texte reste lisible.
export function normalizeAmbiance(raw) {
  if (!isObject(raw) || typeof raw.id !== 'string' || !ID.test(raw.id)) return null;
  const light = colors(raw.clair);
  const dark = colors(raw.sombre);
  if (Object.keys(light).length === 0 && Object.keys(dark).length === 0) return null;
  return { id: raw.id, couleur: typeof raw.couleur === 'string' && HEX.test(raw.couleur) ? raw.couleur.toLowerCase() : null, ajustee: raw.ajustee === true, clair: light, sombre: dark, forme: shapes(raw.forme) };
}
