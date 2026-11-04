# Grist Factory Kit

Le kit commun des apps Grist Factory (Publipostage+, Form+, Automation+, Grist-BI…) : les jetons de la charte, le thème, la traduction français / anglais, les fenêtres, les saisies et confirmations, l'empilement des couches, le sélecteur de couleur, le lien avec GFS, le widget qui héberge les apps (les liens entre apps, les fichiers qu'il leur passe, les exports qu'il range), l'ambiance qu'il leur donne, et le calendrier (mois, semaine, jour) qu'une app monte dans sa page. Des modules ES pour le navigateur et quatre feuilles de style, **aucune bibliothèque tierce**, aucune adresse externe.

Une app ne copie pas le kit : elle le **référence**, en sous-module Git (`kit/`), à une étiquette. Un changement du kit est une nouvelle étiquette ; l'app avance sa référence quand elle le décide (Dependabot le propose). Version actuelle : **0.8.0** ([CHANGELOG](CHANGELOG.md)).

Le kit est la couche du bas : il n'importe rien (ni app, ni GFS, ni bibliothèque). Une app importe le kit, jamais une autre app ; une extension importe son app et le kit, jamais une autre extension.

## L'utiliser

Référencer le kit à une étiquette (un commit à part dans l'app, relu) :

```sh
git submodule add https://github.com/lombre33/grist-factory-kit.git kit
git -C kit checkout v0.9.0
git add kit && git commit -m "Kit v0.9.0"
```

Dans la page, les deux feuilles avant celle de l'app :

```html
<link rel="stylesheet" href="kit/css/tokens.css">
<link rel="stylesheet" href="kit/css/windows.css">
```

Dans le module d'entrée, le thème et la langue d'abord (sinon la page s'affiche en clair, en français, puis bascule) :

```js
import { I18n } from './kit/js/i18n.js';
import { Theme } from './kit/js/theme.js';
import { Dialogs } from './kit/js/dialogs.js';

Theme.init({ storageKey: 'monapp_theme' });
I18n.add({
  'monapp.delete': { fr: 'Supprimer « {name} » ?', en: 'Delete "{name}"?' },
  'monapp.deleteVerb': { fr: 'Supprimer', en: 'Delete' },
});
I18n.init({ storageKey: 'monapp_lang' });
I18n.translateDom();

if (await Dialogs.confirm({ title: I18n.t('monapp.delete', { name }), confirmLabel: I18n.t('monapp.deleteVerb'), danger: true })) { /* … */ }
```

## Le lien avec GFS

Quand Grist Factory Suite (GFS) héberge l'app, il lui donne `gfs=<n>` dans l'adresse de son cadre ; seule, l'app ne parle à personne. `GfsLink` porte tout le dialogue (les contrats de GFS, section 5) :

```js
import { GfsLink } from './kit/js/gfs-link.js';

await GfsLink.ready;                                   // le contexte est arrivé, ou ses 5 secondes sont passées ; tout de suite seule
const wanted = GfsLink.opening();                      // ce que GFS demande d'ouvrir au démarrage, ou null ; avec `importation` ou `lecture` quand GFS passe un fichier
GfsLink.onOpen(async ({ fichier, type }) => openFile(fichier, type));   // le double-clic sur un autre fichier, l'app déjà ouverte : rendre vrai une fois ouvert
GfsLink.onClose(async ({ raison }) => saveOrAsk(raison));   // GFS va remplacer l'app par une autre : enregistrer (ou poser sa question), puis rendre vrai si l'app peut partir, faux si la personne reste
GfsLink.onLanguage(language => I18n.setLanguage(language));
GfsLink.onBar(bar => keepClear(bar));                  // ce que la barre de GFS recouvre : { bord, epaisseur, zone } ou null
GfsLink.onIdentity(person => showMine(person));        // l'adresse e-mail de la personne : { email } ou null (GFS ne la donne qu'à l'app qui l'a déclarée)
GfsLink.storageSet('monapp_zoom', '1.2');              // les choix de la personne : chez GFS, ou dans le navigateur seule
const lien = await GfsLink.choose({ types: ['document', 'grille'], titre: I18n.t('monapp.pick') });   // un fichier d'une autre app : { app, id, nom, type }, ou null si la personne annule
await GfsLink.openFile({ app: lien.app, id: lien.id, type: lien.type });                             // GFS l'ouvre dans son app, plus tard, par la clé gardée
const stored = await GfsLink.deposit({ fichier: pdf, nom: 'Facture.pdf', lot: 'export-3', suivants: 11, dossier: 'Factures' });   // GFS garde l'export : { statut, id, nom }
```

- **Le contexte** (`GfsLink.context()`) garde ses champs connus (document, page, accès, lecture seule…) et rien d'autre ; chaque `on…` rappelle son abonné quand la valeur change vraiment, avec sa propre copie, et rend de quoi se désabonner.
- **Le départ de l'app** : quand la personne ouvre un fichier d'une autre app, GFS appelle `fermer` avant de détruire le cadre. `onClose(fn)` rappelle `fn({ raison })` (`raison` : `app`, `explorateur`, `nouveau`, `importer`, `lire` ou `lien`, au plus 40 signes, vide si GFS n'en donne pas) ; `fn` enregistre ce qui attend ou pose sa question (Enregistrer, Abandonner, Annuler), puis rend vrai si l'app peut partir ou faux si la personne reste. Seul `true` ferme ; une erreur part chez GFS avec son texte (≤ 200 signes) et c'est la personne qui décide. Un seul abonné à la fois, `onClose` rend de quoi se désabonner. Sans abonné, l'app répond `GFS_INCONNU` et part sans question, comme avant la 0.9.0 ; une app qui ne répond à rien fait attendre GFS 10 secondes. L'enregistrement automatique allumé enregistre et rend vrai sans poser de question (contrats de GFS, 5.4 point 3).
- **Les choix de la personne** : dans GFS, le cadre de l'app n'a pas de stockage à lui ; `storageGet` lit la copie que le contexte a rendue, `storageSet` la change et l'envoie à GFS (`valeur` null retire la clé). Une clé fait 1 à 64 caractères parmi lettres, chiffres, `_ . : -`, une valeur est un texte. Seule, les deux passent par le navigateur, qui peut refuser sans rien casser.
- **La barre de GFS** se pose par-dessus le cadre de l'app : l'app écarte de `zone` ce qu'elle met à ce bord, sans réserver de bande. `GfsLink.hideBar(true)` la retire pour un diaporama plein cadre, qui offre alors sa propre sortie (Échap), puis `hideBar(false)`.
- **L'ambiance** : `ambiance()` rend le message d'ambiance que la personne a choisi pour GFS et ses apps (`{ id, couleur, ajustee, clair, sombre, forme }`, jetons connus et valeurs vérifiées seulement), ou `null` : rien n'est choisi, l'app garde ses couleurs. `Ambiance.start()` (ci-dessous) la pose.
- **L'identité** : `identity()` rend `{ email }`, l'adresse e-mail de la personne connectée, ou `null`. GFS ne la donne qu'à l'app qui l'a déclarée dans son manifeste (`permissions.identite`, avec sa raison en français et en anglais) et seulement quand il la connaît ; `null` veut donc dire « pas déclarée », « GFS ne la connaît pas » ou « app seule », sans que l'app puisse le distinguer : elle fait alors comme seule (sa propre table d'essai, avec l'accord de la personne, ou un choix de la personne gardé par `storageSet`). `onIdentity(fn)` rappelle l'abonné quand GFS l'apprend après le contexte. L'adresse montre et retrouve ses données, elle ne décide d'aucun droit : c'est Grist qui accepte ou refuse.
- **Les extensions** : `extensions()`, `library(id)` (la source de chaque bibliothèque, avec son empreinte), `onExtensions(fn)`, et `install(id)`, qui ouvre la fenêtre d'installation de GFS à la ligne de l'extension (le clic sur une fonction grisée).
- **Les liens entre apps** : `choose({ types, apps?, titre? })` fait désigner un fichier d'une autre app dans l'explorateur de GFS (`types` : ceux que les apps offrent à choisir ; `titre` : le texte que GFS montre, déjà traduit) et rend `{ app, id, nom, type }`, ou `null` si la personne annule. L'app garde la clé `{ app, id, type }` (le nom n'est qu'une étiquette) et la rend à `openFile(clé)`, qui rend `true` quand l'app visée a ouvert le fichier ; dans une autre app que la sienne, celle-ci prend sa place (une seule à la fois) et la promesse ne se règle pas. Un fichier disparu rejette avec `GFS_INTROUVABLE`, une app que la personne ne débloque pas avec `GFS_ANNULE`, une demande mal formée ou un second choix en même temps avec `GFS_REFUSE` : l'app ne supprime jamais un lien d'elle-même. Seule, les deux rejettent (`GFS absent`) : l'app grise « Lier un fichier ».
- **Les fichiers que GFS passe** : à l'ouverture (`opening()`, ou l'argument de `onOpen`), `importation: { valeur, fichier }` quand la personne a choisi un fichier à importer dans le menu « Nouveau » de GFS (`valeur` : celle du format de `actions.importer`), `lecture: { id, fichier }` quand elle ouvre en lecture un fichier que GFS garde (`id` : l'identifiant du fichier chez GFS, texte, la clé où l'app accroche ce qu'elle garde, des commentaires par exemple). `fichier` est le `File` tel que le cadre l'a reçu (ses octets, son nom, son type) : l'app le lit comme tout fichier choisi et ne le renvoie jamais à GFS. Ces deux clés n'existent que si GFS les a passées avec un vrai `File` ; sans elles, l'ouverture garde ses quatre champs (`fichier`, `type`, `dossier`, `raison`).
- **Ranger un export** : `deposit({ fichier, nom, type?, lot?, suivants?, dossier? })` demande à GFS de garder un fichier que l'app vient de fabriquer, un export en PDF (`fichier` : un `File` ou un `Blob`, `type` : `pdf`, le seul que GFS garde, `nom` : le nom pour GFS, un `.pdf` manquant est ajouté ; `dossier` : le dossier de la personne où va un fichier nouveau). L'app donne les octets, jamais un jeton : GFS seul écrit ce qu'il garde, et pose lui-même à la personne la question « Ce nom est déjà pris » (remplacer, garder les deux, ne rien ranger). Pour un export en lot, tous les fichiers portent le même `lot` (un texte de 64 signes au plus) et chacun le nombre de `suivants` à ranger encore (0 pour le dernier) : la personne peut alors répondre une fois pour tous. Rend `{ statut, id, nom }` : `statut` vaut `ajoute`, `remplace`, `copie` (le nom était pris, `nom` est celui que GFS a donné) ou `ignore` (la personne n'en veut pas : `id` et `nom` sont `null`). GFS ne dit rien par-dessus l'app : un refus rejette avec son `code` (`GFS_REFUSE` : demande hors règle ou type que le manifeste de l'app ne déclare pas dans `actions.ranger` ; `GFS_ACCES`, `GFS_LECTURE_SEULE`, `GFS_ANNULE` : la personne refuse de créer la table des fichiers ; `GFS_ECHEC` : Grist ou le transfert ; `GFS_INACTIF` : l'app n'est plus l'app active ; `GFS_INCONNU` : un GFS qui ne sait pas encore ranger) et sa phrase, que l'app écrit dans son coin d'état. Chaque appel est un fichier de plus (pas de partage entre deux demandes), GFS les prend l'un après l'autre et la personne a tout son temps : aucun délai. Seule, `deposit` rejette (`GFS absent`) : l'app grise « Ranger dans GFS ».
- `opensInNewTab(href)` : un lien `mailto:` ou `tel:` suivi dans le cadre isolé de GFS le ferait mourir ; hébergée, l'app l'ouvre dans un nouvel onglet.
- L'écoute passe par `addEventListener('message')` et ne lit que le cadre parent, jamais `window.onmessage =` (qui remplacerait celle du script d'API de Grist). `createGfsLink({ host, timeoutMs })` fait un lien de plus pour un essai.

## Le sélecteur de couleur

Le menu de couleur et la fenêtre « Couleur personnalisée » de Publipostage+ (repris à `134d043`, avec la rangée « Couleurs du thème » de `35fc21a`), pour que toutes les apps aient les mêmes, et que GFS s'en serve pour la couleur libre de son thème. Le menu est du **contenu**, pas un panneau : l'app le pose dans son menu flottant (le fond, le liseré et l'ombre sont à elle) ; la fenêtre est celle du kit.

```html
<link rel="stylesheet" href="kit/css/tokens.css">
<link rel="stylesheet" href="kit/css/windows.css">          <!-- pour la fenêtre -->
<link rel="stylesheet" href="kit/css/color-picker.css">
```

```js
import { createColorPalette } from './kit/js/color-palette.js';
import { ColorDialog } from './kit/js/color-dialog.js';

const palette = createColorPalette({
  current: '#1e8449',                          // la couleur du moment (#rrggbb ou rgb(…)) : sa pastille est marquée ; absente, c'est « sans couleur »
  noneLabel: I18n.t('monapp.noColor'),         // le texte du bouton qui retire la couleur ; sans lui, pas de bouton
  saved: [                                     // les rangées que l'app a gardées, dans l'ordre
    { id: 'theme', label: I18n.t('monapp.themeColors'), colors: ['#ffffff', '#1b2430'], names: ['Fond', 'Texte'], readonly: true },
    { id: 'model', label: I18n.t('monapp.modelColors'), hint: I18n.t('monapp.modelHint'), colors: ['#1e8449'] },
  ],
  onPick: color => apply(color),               // une pastille, de la palette ou d'une rangée
  onNone: () => apply(null),
  onCustom: () => ColorDialog.open({ initial: current, scopes: [{ id: 'model', label: I18n.t('monapp.modelColors'), checked: true }], onApply: ({ color, scopes }) => apply(color, scopes) }),
  onForget: (rowId, color) => { forget(rowId, color); palette.setSaved(rows()); },   // la croix ou Suppr : l'app retire la couleur et redonne ses rangées
});
menu.append(palette.element);
palette.focus();                               // le clavier sur la pastille marquée
```

- **Le menu** : 50 pastilles de 20 px (dix colonnes, cinq rangées : les gris, puis quatre tons). Une rangée gardée a un nom (`hint` : son infobulle) et dix couleurs au plus ; vide, elle dit « Aucune ». Dans un panneau court et large (`max-height: 480px` et `min-width: 480px`, le 700 × 400 de Grist), les rangées passent à droite de la palette et le menu mesure ~170 px ; ailleurs elles sont dessous. `palette.mark(couleur)` marque la pastille d'une couleur que l'app lit ailleurs (écrite `#rrggbb` ou `rgb(…)`), « Personnalisé… » quand elle n'est dans aucune.
- **Au clavier** : une étape de Tab par rangée (la pastille marquée), les flèches et Début / Fin d'une pastille à l'autre sans boucler, Suppr (ou Retour arrière) retire une couleur gardée, la croix au survol ou au focus aussi. Une rangée `readonly` (celle du thème de l'app) n'a ni croix ni Suppr ; `names` donne le nom de chaque réglage (« Accent 1 »), devant son code dans l'infobulle.
- **La fenêtre** : `ColorDialog.open({ initial, scopes, onApply({ color, scopes }), onClose })` : le carré saturation-luminosité, la teinte, l'aperçu face à la couleur de départ, le code et les trois canaux ; un code illisible marque son champ, dit ce qu'on attend et grise « Appliquer ». Sans `scopes`, pas de cases « garder » ; avec, la fenêtre se souvient des dernières cases cochées. Une app qui veut l'éditeur dans sa propre fenêtre (GFS) prend `new ColorEditor({ initial, scopes, onValidity, onSubmit })` : `element`, `color()`, `valid()`, `scopes()`, `focus()`.
- **Le calcul** (`ColorMath`) : `parseHex`, `parseCss`, `toHex`, `toRgb`, `rgbToHsv`, `hsvToRgb`, `luminance`, `contrast`, `inkOn`, ceux de Publipostage+ : une app n'a plus à garder les siens.
- **Les textes** : les clés `kit.color.*` du kit, en français et en anglais ; `t` (option du menu, de la fenêtre et de l'éditeur) prend un traducteur à soi (`createI18n`). Les noms des rangées et celui de « sans couleur » sont ceux de l'app.
- **Aucun style en ligne** : la couleur d'une pastille passe par le CSSOM, et la feuille n'a de couleur à elle que pour le carré, la teinte et leurs curseurs (celles qu'on choisit).

## L'ambiance de GFS

La personne choisit dans GFS une ambiance (Grist Factory, Pop, Papier, Brut, Néon) et, si elle veut, sa propre couleur : un seul choix, pour GFS et pour toutes ses apps (contrats de GFS, 5.2 point 10). `Ambiance.start()` le pose sur la page de l'app :

```js
import { Ambiance } from './kit/js/ambiance.js';

const ambiance = Ambiance.start();   // une fois, au démarrage de l'app (le module d'entrée) ; deux appels rendent le même
await ambiance.ready;                // facultatif : le contexte est arrivé et l'ambiance est posée, l'app s'affiche sans repeindre
```

- **Ce qu'elle pose** : sur `<html>`, par le CSSOM, les dix-neuf jetons de couleur du mode que l'app affiche (`--bg`, `--surface`, `--accent`… et quatre de décor : `--accent-2`, `--accent-3`, `--accent-end`, `--hard`) et les jetons de forme (arrondis `--radius-*`, traits, ombres, polices, fonds). Les feuilles du kit et celles de l'app qui lisent ces jetons suivent sans rien changer ; une app qui n'en lit pas un garde sa forme et prend les couleurs.
- **Ce qu'elle suit** : GFS (un événement par geste de la personne) et le mode de l'app (son thème, puis celui de Grist, puis le système : `js/theme.js`) sans que GFS dise rien. Un mode qui change autrement (une classe) se redit par `ambiance.repaint()`.
- **Ce qu'elle retire** : quand GFS dit `null` (rien n'est choisi), tout ce qu'elle avait posé, et rien d'autre ; `ambiance.stop()` fait de même.
- **Ce qu'elle refuse** : un jeton qu'elle ne connaît pas (les listes `COLOR_TOKENS` et `SHAPE_TOKENS` de `js/ambiance-message.js`), une couleur qui n'est pas un `#rrggbb`, une valeur de forme qui porte `;`, `{`, `}`, `url(` ou `@import`.
- **Seule**, l'app n'a pas d'ambiance : rien n'est posé. Et l'ambiance ne vaut que pour ce que l'app affiche à la personne, **jamais pour ce qu'elle produit** (un e-mail, un PDF, un document, un formulaire public).
- `GfsLink.ambiance()` et `GfsLink.onAmbiance(fn)` donnent le message lu, pour une app qui veut en faire autre chose (la couleur libre de la personne, `couleur`, pour un graphique).
- **Une app qui a son propre lien avec GFS** (Publipostage+) n'importe pas `js/ambiance.js` : il démarrerait le lien du kit à côté du sien, et deux liens dans un même cadre numérotent chacun leurs appels depuis 1 et se prendraient les réponses (retrouvées par leur seul `id`). Elle donne le sien à `js/ambiance-pose.js` (qui n'importe ni le lien ni le thème du kit) :

```js
import { normalizeAmbiance } from './kit/js/ambiance-message.js';   // dans son lien : lire `contexte.ambiance` et l'événement `ambiance` par cette fonction
import { createAmbiance } from './kit/js/ambiance-pose.js';

// link : { ambiance() → message lu par normalizeAmbiance, ou null ; onAmbiance(fn) → de quoi se désabonner ; ready : le contexte de GFS est arrivé }, isDark() → l'app affiche son mode sombre
const ambiance = createAmbiance({ link: monLien, isDark: () => monThemeEstSombre() }).start();
```

`createAmbiance({ link, isDark, doc, win })` demande `link` et `isDark` (une erreur sinon) ; `doc` et `win` sont la page, pour un essai.

## Le calendrier

Un calendrier que Tuesday et Calendar+ montent chacun chez eux : un mois, une semaine ou un jour, des événements qui s'étendent sur plusieurs jours ou ont une heure, le glisser-déposer pour changer le jour ou l'heure, un plateau « Sans date », une saisie rapide du titre. Écrit dans le dépôt de Calendar+ (`grist-widget-calendar-plus`), rangé ici par GFS : une app qui n'en veut pas ne le charge pas, et rien d'autre dans `js/` ne l'importe.

```html
<link rel="stylesheet" href="kit/css/tokens.css">
<link rel="stylesheet" href="kit/css/calendrier.css">   <!-- après tokens.css -->
```

```js
import { creerCalendrier } from './kit/js/calendrier/index.js';

const calendrier = creerCalendrier({ onOuvrir, onDeplacer, onAjouter, onEtat });
conteneur.append(calendrier.element);        // le module rend son élément, l'hôte le pose (le cadre donne la hauteur : l'élément remplit son parent)
calendrier.definir({ lignes, options });     // à rappeler à chaque changement de données
```

`creerCalendrier(rappels)` rend `{ element, definir({ lignes, options }), aller(jour), aujourdhui(), detruire() }`.

- **Les lignes** : `{ id, titre, debut, fin, avecHeure, statut, couleur, responsables, modifiable }`. `debut` et `fin` sont des **jours civils en texte**, `AAAA-MM-JJ` ou `AAAA-MM-JJTHH:mm`, **sans fuseau** (l'hôte convertit les secondes de Grist) ; `fin` est inclusive pour un jour sans heure ; un début seul ou une fin seule est un événement d'un jour ; ni l'un ni l'autre : le plateau « Sans date ». Une date illisible ou une fin avant le début n'est jamais réparée en silence : la ligne est écartée et un avis le dit. `couleur` est `{ fond, texte }` tels que Grist les donne (une donnée de la personne, posée par le CSSOM : `--cal-fond` et `--cal-texte`) ; absente, un jeton du kit. `modifiable: false` grise le glisser, avec sa raison.
- **Les options** : `debutSemaine` (1 = lundi, par défaut), `vue` (`mois`, `semaine` ou `jour`), `jourCourant`, `langue` (`fr` ou `en`, celle que l'hôte affiche : le module n'a pas de réglage de langue à lui), `maintenant` (une horloge injectée), `lectureSeule`, `maxPistes`. Une vue ou un jour demandés ne comptent qu'à la première fois et quand la demande change : le calendrier s'ouvre sur aujourd'hui, jamais sur la date de la première ligne.
- **Les rappels** : `onOuvrir(id)` ; `onDeplacer({ id, debut, fin })` rend une promesse (refusée, ou `false` : l'événement **revient à sa place**) ; `onAjouter({ debut, titre })` rend une promesse (refusée, le champ garde son titre) ; `onEtat({ vue, jourCourant })`, pour que l'hôte retienne la vue. Un rappel absent grise le geste (pas de `onDeplacer` : lecture seule).
- **Le module ne parle jamais à Grist**, ni à la fenêtre : l'hôte écrit, et garde Annuler / Rétablir. Il ne prend au kit que `h` et `createI18n` (`js/calendrier/lien-kit.js`).
- **Les événements qui glissent sont des `<div role="button" draggable="true">`**, jamais des `<button>` : un `<button draggable>` ne glisse pas sous Firefox avant la 147.
- **La feuille** ne porte que des jetons (couleurs, formes avec leur valeur d'origine en repli, `--z-menu`) : l'ambiance de GFS la suit, en clair et en sombre.

## Ce que contient le kit

| Fichier | Ce qu'il donne |
| --- | --- |
| `css/tokens.css` | Les jetons de la charte (section 1) : `--bg`, `--surface`, `--text`, `--accent`… en clair et en sombre, `--font-ui` (police du système), `--pp-scrim`, les couches `--z-*`. Le sombre suit le choix de la personne (`data-theme`), puis le thème de Grist (`data-grist-appearance`), puis le système. |
| `css/windows.css` | Le voile, le cadre et ses trois zones, les trois largeurs (400, 480, 960 plafonnés au panneau), les boutons des fenêtres, la saisie. À charger après `tokens.css`. |
| `js/theme.js` | `Theme.init({ storageKey })`, `Theme.set('system' \| 'light' \| 'dark')`, `Theme.isDark()`, `Theme.choice`, `Theme.onChange(fn)`. Gardé par navigateur, jamais dans le document. |
| `js/i18n.js` | `I18n.add(textes)`, `I18n.init({ storageKey })`, `I18n.t(clé, variables)`, `I18n.setLanguage`, `I18n.store`, `I18n.translateDom()`, `I18n.onChange`. Pluriels `{n\|singulier\|pluriel}` (0 et 1 au singulier en français). `createI18n` pour une instance à soi. |
| `js/modal-base.js` | `ModalBase.create({ id, titleId, size, onEscape, restoreFocus, boxClass, actionsClass })` : titre, contenu, boutons ; Tab et Échap tenus pour la fenêtre du dessus ; focus rendu à la fermeture. |
| `js/dialogs.js` | `Dialogs.prompt`, `confirm`, `choose`, `notice` : des fenêtres à la place de `prompt()`, `confirm()` et `alert()`. À appeler avec `await`. |
| `js/layers.js` | `Layers.raise(élément, fenêtre?)` : le dernier menu ouvert est au-dessus ; avec `fenêtre`, un popup passe devant celle qui l'ouvre. |
| `js/dom.js` | `h(balise, propriétés, …enfants)` : du DOM sans jamais interpréter du texte comme du HTML (les noms viennent du document). |
| `css/color-picker.css` | Le menu et la fenêtre de couleur : pastilles, rangées gardées, carré, teinte, aperçu, champs. À charger après `tokens.css` ; le panneau qui porte le menu est à l'app. |
| `js/color-palette.js` | `createColorPalette({ current, noneLabel, saved, onPick, onCustom, onNone, onForget })` : le menu de couleur (ci-dessus), et `COLOR_ROWS`. |
| `js/color-dialog.js` | `ColorDialog.open({ initial, scopes, onApply, onClose })` : « Couleur personnalisée » ; `ColorEditor` : le même contenu, sans fenêtre autour. |
| `js/color-math.js` | `ColorMath` : conversions (`#rrggbb`, rgb, teinte-saturation-luminosité), luminance, contraste WCAG, encre lisible sur une couleur. |
| `js/color-strings.js` | Les textes `kit.color.*` du sélecteur, que `js/i18n.js` ajoute à ceux du kit. |
| `js/gfs-link.js` | `GfsLink` : le lien avec GFS (ci-dessus). `createGfsLink` pour un lien à soi. |
| `js/ambiance.js` | `Ambiance.start()` : pose l'ambiance de GFS sur la page de l'app et la suit, avec le lien et le thème du kit (ci-dessus). |
| `js/ambiance-pose.js` | `createAmbiance({ link, isDark })` : la même pose avec le lien et le mode qu'on lui donne (une app qui a son propre lien avec GFS) ; `paintAmbiance` pour un essai. N'importe ni le lien ni le thème du kit. |
| `js/ambiance-message.js` | `normalizeAmbiance(message)` : le message d'ambiance lu avec méfiance ; `COLOR_TOKENS` et `SHAPE_TOKENS` : les jetons que l'app connaît. |
| `css/calendrier.css` | La feuille du calendrier : des jetons seulement, aucune couleur ni `z-index` en dur. À charger après `tokens.css`. |
| `js/calendrier/index.js` | `creerCalendrier(rappels)` : le calendrier (ci-dessus). Son noyau (`noyau/` : dates civiles, événements, placement des barres, blocs horaires, déplacement) ne connaît ni le DOM ni Grist ; ses vues sont dans `vue/`, ses textes dans `textes.js`. |
| `js/calendrier/lien-kit.js` | Le seul fichier du calendrier qui importe le reste du kit : `h` et `createI18n`. |
| `js/host.js` | `hostContract(search)` : le contrat de GFS dans l'adresse du cadre (`gfs=<n>`), ou null seule. |
| `js/once.js` | Garde interne : un module du kit chargé par deux adresses est signalé dans la console. |

Les textes du kit lui-même (« Annuler », « Valider », « Fermer », et ceux du sélecteur de couleur) sont les clés `kit.*` ; une app prend le préfixe de l'app pour les siennes.

## Règles à connaître

- **Une seule adresse par module du kit.** `I18n`, `Theme`, `Layers` et la pile des fenêtres n'existent qu'une fois par page. Les charger par deux adresses (un `?v=` sur l'un des imports et pas sur l'autre) en ferait deux, chacun avec son état : le kit le dit dans la console (« chargé deux fois »). GitHub Pages met tout en cache 10 minutes et un `?v=` ne se propage pas aux imports qui suivent : l'app (ou GFS) versionne les adresses par une carte d'importation, la même pour toutes.
- **Politique de sécurité du contenu stricte, rien à ajouter.** Le kit ne pose aucun style en ligne (le CSSOM suffit, que `style-src 'self'` laisse passer), n'évalue rien, ne charge ni police ni script ni image d'un autre site. Les essais tournent sous `default-src 'none'; script-src 'self'; style-src 'self'`.
- **Aucune couleur ni aucun `z-index` en dur** dans une feuille d'app : un jeton. Un texte rouge prend `--danger-ink`, un bouton plein à texte blanc `--accent-solid` et `--on-accent`, un texte d'accent sur fond teinté `--accent-ink` (l'en-tête de `tokens.css` dit pourquoi, chiffres à l'appui).
- **Recolorer une zone** (la couleur qu'une personne choisit pour son formulaire) : poser `--accent`, `--accent-solid`, `--accent-ink`, `--accent-soft` et `--on-accent` sur l'élément de la zone, avec le CSSOM (`el.style.setProperty`), **jamais sur `<html>`**. Sur `<html>`, les écrans de l'app et les fenêtres du kit prendraient aussi cette couleur (mesuré sur Form+ : le bouton principal du concepteur et celui d'une fenêtre du kit passent au rouge d'un formulaire rouge). Un fond plein prend `--accent-solid` sous `--on-accent`.
- **Le thème est un confort par navigateur** : refusé, le stockage ne casse rien, `Theme.set` et `I18n.store` rendent `false` et le choix vaut pour la page seulement.
- **Les noms `pp-modal…` et `--pp-scrim`** viennent de Publipostage+, d'où le kit est extrait, et sont ceux de la charte : une app les garde tels quels.
- **Un niveau de fenêtre en plus** (une fenêtre qui s'ouvre par-dessus une autre) se règle dans la feuille de l'app, avec un `z-index` pris entre `--z-window` et `--z-dialog` ; une couche flottante appelle `Layers.raise` à l'ouverture.
- Les clés de stockage sont celles de l'app (`monapp_theme`, `monapp_lang`) : le kit n'en impose aucune.

## Pas encore dans le kit

Prévu au plan de GFS (cahier, 4.5), pas encore dans le kit, parce que le premier client n'en a pas besoin : `ModalBase.adopt` (fenêtres écrites dans le HTML de la page, que Publipostage+ emploie), la liste avec recherche, les icônes, l'accès à Grist, les actions « choisir » et « insérer » du courtier, le consentement à la création des tables, le rappel « Enregistrer » des réglages de la vue, le registre des extensions et le dessin du grisé, la garde « préserver l'inconnu », le gabarit de CSP et l'outil de la carte d'importation.

## Contrôles

```sh
npm test                    # 187 essais sous Node : traduction, jetons et contrastes, lien avec GFS, sélecteur de couleur, ambiance, calendrier, hygiène du code
npm run test:fuseaux        # les essais du calendrier sous trois fuseaux (Paris, Los Angeles, Auckland) : un changement d'heure ne décale jamais un jour
npm run test:navigateur     # Chromium (Playwright), 700 × 400, souris et clavier, clair et sombre, français et anglais
KIT_ONLY=couleur npm run test:navigateur   # seulement les essais dont le nom contient « couleur » (ou « calendrier »)
```

Les essais du navigateur ouvrent `navigateur/page.html`, pour le sélecteur de couleur `navigateur/couleur.html`, pour le calendrier `navigateur/calendrier.html` et pour le lien avec GFS `navigateur/gfs-hote.html` (le cadre de l'app isolé comme chez GFS), sous la politique de sécurité d'une app hébergée et rangent leurs captures dans `navigateur/captures/` (ou `KIT_CAPTURES`). Playwright est celui du dossier du dépôt (`npm i -D playwright`) ou, à défaut, celui du conteneur du cloud.

Le kit tient les seuils de code de l'outil d'audit des widgets (`gwaudit`) : 600 lignes de code par fichier au plus, moins de 81 lignes par fonction, complexité 15 au plus. L'outil juge la surface qu'exécute `navigateur/page.html` ; pour le reste de `js/` (le calendrier, par exemple), la mesure par fonction de l'outil (`src/moteur/fonctions.js`) est passée sur tout `js/` : 496 fonctions, aucune au-dessus des seuils.

## Licence

GPL 3.0 : GNU General Public License version 3, le texte officiel est dans [LICENSE](LICENSE), le même que dans GFS et dans chaque app. Le code d'un tiers garde sa licence.
