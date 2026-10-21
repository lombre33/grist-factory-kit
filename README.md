# Grist Factory Kit

Le kit commun des apps Grist Factory (Publipostage+, Form+, Automation+, Grist-BI…) : les jetons de la charte, le thème, la traduction français / anglais, les fenêtres, les saisies et confirmations, et l'empilement des couches. Des modules ES pour le navigateur et deux feuilles de style, **aucune bibliothèque tierce**, aucune adresse externe.

Une app ne copie pas le kit : elle le **référence**, en sous-module Git (`kit/`), à une étiquette. Un changement du kit est une nouvelle étiquette ; l'app avance sa référence quand elle le décide (Dependabot le propose). Version actuelle : **0.1.0** ([CHANGELOG](CHANGELOG.md)).

Le kit est la couche du bas : il n'importe rien (ni app, ni GFS, ni bibliothèque). Une app importe le kit, jamais une autre app ; une extension importe son app et le kit, jamais une autre extension.

## L'utiliser

Référencer le kit à une étiquette (un commit à part dans l'app, relu) :

```sh
git submodule add https://github.com/lombre33/grist-factory-kit.git kit
git -C kit checkout v0.1.0
git add kit && git commit -m "Kit v0.1.0"
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

## Ce que contient la V0.1

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
| `js/once.js` | Garde interne : un module du kit chargé par deux adresses est signalé dans la console. |

Les textes du kit lui-même (« Annuler », « Valider », « Fermer ») sont les clés `kit.*` ; une app prend le préfixe de l'app pour les siennes.

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

Prévu au plan de GFS (cahier, 4.5), pas dans la V0.1, parce que le premier client n'en a pas besoin : `ModalBase.adopt` (fenêtres écrites dans le HTML de la page, que Publipostage+ emploie), la liste avec recherche, les icônes, l'accès à Grist et le client du courtier (contexte, stockage, actions « ouvrir », « choisir », « insérer »), le consentement à la création des tables, le rappel « Enregistrer » des réglages de la vue, le registre des extensions et le dessin du grisé, la garde « préserver l'inconnu », le gabarit de CSP et l'outil de la carte d'importation.

## Contrôles

```sh
npm test                    # 38 essais sous Node : traduction, jetons et contrastes, hygiène du code
npm run test:navigateur     # Chromium (Playwright), 700 × 400, souris et clavier, clair et sombre, français et anglais
```

Les essais du navigateur ouvrent `navigateur/page.html` sous la politique de sécurité d'une app hébergée et rangent leurs captures dans `navigateur/captures/` (ou `KIT_CAPTURES`). Playwright est celui du dossier du dépôt (`npm i -D playwright`) ou, à défaut, celui du conteneur du cloud.

Le kit passe l'outil d'audit des widgets (`gwaudit`) sur ses seuils de code : 600 lignes de code par fichier au plus, moins de 81 lignes par fonction, complexité 15 au plus.

## Licence

GPL 3.0 : GNU General Public License version 3, le texte officiel est dans [LICENSE](LICENSE), le même que dans GFS et dans chaque app. Le code d'un tiers garde sa licence.
