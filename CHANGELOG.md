# Changements

Une version = une étiquette Git (`v0.1.0`). Une app avance sa référence au kit quand elle le décide ; chaque ligne ci-dessous dit ce qui change pour elle.

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
