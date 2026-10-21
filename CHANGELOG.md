# Changements

Une version = une étiquette Git (`v0.1.0`). Une app avance sa référence au kit quand elle le décide ; chaque ligne ci-dessous dit ce qui change pour elle.

## 0.2.0 : le lien avec GFS (21/10/2026)

Le dialogue d'une app avec GFS, le widget qui l'héberge, écrit une fois pour toutes les apps. Extrait de Publipostage+ (`js/gfs-link.js` à `487d66b`), avec la barre de GFS (contrats de GFS, 5.2 point 7) et les choix de la personne (5.3) en plus. Rien ne change pour une app qui ne l'importe pas.

- **Lien avec GFS** (`js/gfs-link.js`) : `GfsLink.ready`, `hosted`, `context`, `opening` et `onOpen` (répondre à « ouvrir »), `language` et `onLanguage`, `bar`, `onBar` et `hideBar`, `storageGet` et `storageSet`, `extensions`, `library`, `onExtensions` et `install`, `opensInNewTab`. Seule, l'app ne parle à personne et ses choix vont au navigateur, qui peut refuser sans rien casser ; hébergée, elle ne lit que les messages du cadre parent au contrat de GFS.
- **Le contrat de GFS dans l'adresse** (`js/host.js`) : `hostContract(search)`, que lisent la traduction et le lien.
- **Pour une app qui a déjà son propre lien** (Publipostage+) : un abonné du kit est rappelé à l'arrivée du contexte aussi, pas seulement aux événements qui suivent.
- **Essais** : 56 sous Node, dont 18 pour le lien ; dans Chromium, le cadre d'une app isolé comme chez GFS (`sandbox="allow-scripts"`, sans `allow-same-origin`) face à une page qui joue GFS : le contexte demandé une fois, un choix gardé envoyé à GFS, un cadre voisin qui n'est pas lu, l'événement de langue suivi, l'appel « ouvrir » et sa réponse (209 vérifications en tout). Le serveur des essais pose l'en-tête CORS ouvert, comme GitHub Pages : sans lui, un module ne se charge pas dans un cadre d'origine opaque.

## 0.1.0 : première version (21/10/2026)

Extraite de Publipostage+ (`7e454d2` : `css/style.css`, `css/modal-base.css`, `js/layers.js`, `js/modal-base.js`, `js/dialogs.js`) et du prototype de GFS (`8110d87` : `js/dom.js`, `js/i18n.js`), au périmètre de ce que demande le premier client, Form+.

- **Jetons de la charte** (`css/tokens.css`) : gris, un seul bleu d'accent, rouge et vert pour l'état, contrastes de 4,5:1 mesurés en clair et en sombre, couches `--z-*`, voile `--pp-scrim`. Le thème sombre suit, dans cet ordre : le choix de la personne (`data-theme`), le thème de Grist (`data-grist-appearance`), la préférence du système.
- **Thème** (`js/theme.js`) : `Theme.init`, `set`, `isDark`, `onChange` ; système, clair ou sombre, gardé par navigateur sous la clé de l'app, sans stockage si le navigateur le refuse.
- **Traduction** (`js/i18n.js`) : `I18n.add`, `init`, `t`, `setLanguage`, `store`, `translateDom`, `onChange` ; français et anglais côte à côte par clé, pluriels `{n|singulier|pluriel}`, langue de GFS (`gfs=<n>` et `language`) avant le choix gardé avant le navigateur.
- **Fenêtres** (`css/windows.css`, `js/modal-base.js`) : `ModalBase.create` ; titre et boutons fixes, seul le contenu défile, trois largeurs (400, 480, 960 plafonnés au panneau), clavier tenu pour la fenêtre du dessus, focus rendu à la fermeture.
- **Saisies et confirmations** (`js/dialogs.js`) : `Dialogs.prompt`, `confirm`, `choose`, `notice`, à la place de `prompt()`, `confirm()` et `alert()`.
- **Couches** (`js/layers.js`) : `Layers.raise` ; le dernier menu ouvert est au-dessus, un popup passe devant la fenêtre qui l'ouvre.
- **Outils** : `js/dom.js` (`h`, du DOM sans HTML par chaîne), `js/once.js` (un module du kit chargé par deux adresses est signalé).
- **Essais** : 38 sous Node (`npm test`) et plus de 200 vérifications dans Chromium au format du panneau de 700 × 400, à la vraie souris et au vrai clavier, en clair et en sombre, en français et en anglais, sous la politique de sécurité d'une app hébergée (`npm run test:navigateur`).

Pas encore dans le kit : voir « Pas encore dans le kit » du README.
