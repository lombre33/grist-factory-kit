// Les textes de la fenêtre de mise à jour des noms (js/names-update/window.js), français et anglais côte à côte, clés `kit.names.`. Vouvoiement. La fenêtre ajoute ces textes à ceux du
// kit (I18n.add) quand on la charge : une app qui n'en veut pas ne les porte pas. `{app}` : le nom de l'app ; `{names}` : une liste de noms de tables, séparés par des virgules.
export const NAMES_STRINGS = Object.freeze({
  'kit.names.title': { fr: 'Mise à jour des noms de vos tables', en: 'Updating the names of your tables' },
  'kit.names.intro': {
    fr: '{app} range désormais ses données sous des noms anglais. Vos données ne changent pas : mêmes lignes, même contenu, mêmes numéros. Seuls les noms des tables et des colonnes changent.',
    en: '{app} now stores its data under English names. Your data does not change: same rows, same content, same numbers. Only the names of tables and columns change.',
  },
  'kit.names.list': {
    fr: 'Voir les noms qui changent ({tables} {tables|table|tables}, {columns} {columns|colonne|colonnes})',
    en: 'See the names that change ({tables} {tables|table|tables}, {columns} {columns|column|columns})',
  },
  'kit.names.becomes': { fr: 'devient', en: 'becomes' },
  'kit.names.more': { fr: '… et {n} {n|autre|autres}', en: '… and {n} more' },
  'kit.names.quick': { fr: 'C’est l’affaire de quelques secondes : ne fermez pas la page.', en: 'It takes a few seconds: please do not close the page.' },
  'kit.names.follow': {
    fr: 'Vos règles d’accès et vos formules suivent toutes seules. Si un outil extérieur (script, flux automatisé) appelle ces tables par leur nom, il faudra y mettre les nouveaux noms.',
    en: 'Your access rules and formulas follow on their own. If an outside tool (script, automated flow) calls these tables by name, it will need the new names.',
  },
  'kit.names.held': {
    fr: '{n|Une table garde son ancien nom|{n} tables gardent leurs anciens noms} (un partage Sync+ s’en sert) : {names}. {n|Elle sera renommée|Elles seront renommées} quand ce partage sera retiré.',
    en: '{n|One table keeps its old name|{n} tables keep their old names} (a Sync+ share uses {n|it|them}): {names}. {n|It|They} will be renamed once that share is removed.',
  },
  'kit.names.start': { fr: 'Mettre à jour', en: 'Update' },
  'kit.names.working': { fr: 'Mise à jour…', en: 'Updating…' },
  'kit.names.workingText': { fr: 'Mise à jour en cours : quelques secondes. Ne fermez pas la page.', en: 'Updating: a few seconds. Please do not close the page.' },
  'kit.names.continue': { fr: 'Continuer', en: 'Continue' },
  'kit.names.skip': { fr: 'Continuer sans mettre à jour', en: 'Continue without updating' },
  'kit.names.retry': { fr: 'Réessayer', en: 'Try again' },
  'kit.names.check': { fr: 'Vérifier', en: 'Check' },
  'kit.names.done': {
    fr: 'Terminé : {tables} {tables|table mise à jour|tables mises à jour}, {rows} {rows|ligne vérifiée|lignes vérifiées} avant et après, aucune modifiée.',
    en: 'Done: {tables} {tables|table|tables} updated, {rows} {rows|row|rows} checked before and after, none changed.',
  },
  'kit.names.doneNoCount': {
    fr: 'Terminé : {tables} {tables|table mise à jour|tables mises à jour}. Vos données n’ont pas été touchées.',
    en: 'Done: {tables} {tables|table|tables} updated. Your data was not touched.',
  },
  'kit.names.mismatch': {
    fr: 'Le nombre de lignes diffère pour : {names}. Utilisez « Annuler » (Ctrl+Z) dans Grist pour revenir en arrière, puis prévenez l’équipe de l’app.',
    en: 'The number of rows differs for: {names}. Use “Undo” (Ctrl+Z) in Grist to go back, then tell the app’s team.',
  },
  'kit.names.already': { fr: 'C’est déjà fait : les noms sont à jour.', en: 'Already done: the names are up to date.' },
  'kit.names.refused': {
    fr: 'Rien n’a changé dans vos données. Grist a refusé la mise à jour. Un propriétaire du document doit ouvrir l’app pour mettre à jour les noms.',
    en: 'Nothing changed in your data. Grist refused the update. An owner of the document needs to open the app to update the names.',
  },
  'kit.names.blocked': {
    fr: 'Rien n’a été renommé : un nom prévu existe déjà ({names}). Vos données n’ont pas changé.',
    en: 'Nothing was renamed: a planned name already exists ({names}). Your data did not change.',
  },
  'kit.names.unknown': {
    fr: 'Le résultat n’est pas encore connu (la mise à jour est peut-être encore en cours). Vos données ne sont pas perdues. Cliquez sur « Vérifier » dans un instant, ou rechargez la page.',
    en: 'The result is not known yet (the update may still be running). Your data is not lost. Click “Check” in a moment, or reload the page.',
  },
  'kit.names.detail': { fr: 'Détail : {detail}', en: 'Detail: {detail}' },
});
