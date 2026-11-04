// Les essais des gestes du calendrier, dans un vrai navigateur (Chromium, Playwright) au format du panneau de Grist (700 × 400), à la vraie souris et au vrai clavier : le rendu, la navigation,
// la saisie rapide, le glisser-déposer (un jour, une heure, le plateau « Sans date »), les refus de l'hôte, la lecture seule, les vues Semaine et Jour, la langue. Le module ne parle pas à
// Grist : l'hôte est la page navigateur/calendrier.html, qui garde les appels reçus. Portés des essais de Calendar+ (test/navigateur/essais.test.mjs, 31 essais), dont ils gardent le texte :
// chaque essai y est une vérification du kit, en échec avec le message de la première assertion qui tombe. Ajouts du kit : la casse du titre de la liste d'un jour, l'absence d'erreur de page après
// Échap (deux essais) et l'essai de la saisie que l'hôte redéfinit en cours de frappe.
import assert from 'node:assert/strict';
import { check, openPage } from './aide.mjs';

const MAINTENANT = new Date(2026, 10, 3, 10, 0, 0);   // mardi 3 novembre 2026

export const LIGNES = [
  { id: 1, titre: 'Rédiger le cahier', debut: '2026-10-30', fin: '2026-11-03', couleur: { fond: '#dff5e8', texte: '#146c48' } },
  { id: 2, titre: 'Choix de l\'hébergeur', debut: '2026-11-09' },
  { id: 3, titre: 'Maquettes', debut: '2026-11-13', fin: '2026-11-13' },
  { id: 4, titre: 'Atelier', debut: '2026-11-18T09:30', fin: '2026-11-18T11:00' },
  { id: 5, titre: 'Revue', debut: '2026-11-13' },
  { id: 6, titre: 'Bilan', debut: '2026-11-13' },
  { id: 7, titre: 'À planifier' },
  { id: 8, titre: 'Autre à planifier', modifiable: true },
  { id: 9, titre: 'Date cassée', debut: 'demain' },
];
export const HEURES = [
  { id: 20, titre: 'Point équipe', debut: '2026-11-03T09:30', fin: '2026-11-03T10:30' },
  { id: 21, titre: 'Atelier', debut: '2026-11-03T10:00', fin: '2026-11-03T12:00' },
  { id: 22, titre: 'Déjeuner', debut: '2026-11-05T12:00', fin: '2026-11-05T14:00' },
  { id: 23, titre: 'Sans heure', debut: '2026-11-04' },
  { id: 24, titre: 'À caser' },
];

// Une page neuve (contexte vide, 700 × 400 par défaut) avec le calendrier défini comme le ferait un hôte. `largeur` et `hauteur` changent le cadre ; `theme` pose data-theme ; `options` passent au
// module (la langue est celle de la page sauf si l'essai en demande une) ; `colorScheme` et `locale` sont ceux du navigateur. La page garde les erreurs et avertissements de sa console dans `page.erreurs`.
export async function ouvrirCalendrier(env, ouvertes, { options = {}, lignes = LIGNES, theme, largeur = 700, hauteur = 400, colorScheme, locale } = {}) {
  const { page } = await openPage(env, { path: 'calendrier.html', colorScheme, locale });
  ouvertes.push(page);
  const erreurs = [];
  page.on('pageerror', erreur => erreurs.push(String(erreur)));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) erreurs.push(message.text()); });
  if (largeur !== 700 || hauteur !== 400) await page.setViewportSize({ width: largeur, height: hauteur });
  if (theme) await page.evaluate(valeur => { document.documentElement.dataset.theme = valeur; }, theme);
  await page.evaluate(([l, h]) => { const cadre = document.getElementById('cadre'); cadre.style.width = `${l}px`; cadre.style.height = `${h}px`; }, [largeur, hauteur]);
  await page.evaluate(({ lignes: l, options: o, maintenant }) => {
    kit.calendrier.definir({ lignes: l, options: { maintenant: () => new Date(maintenant), langue: kit.I18n.language, ...o } });
  }, { lignes, options, maintenant: MAINTENANT.getTime() });
  page.erreurs = erreurs;
  return page;
}
const appels = (page, nom) => page.evaluate(n => kit.appels.filter(a => a.nom === n).map(a => a.valeur), nom);
const titre = page => page.locator('.cal-titre').innerText();
const boite = (page, selecteur) => page.locator(selecteur).boundingBox();

const ESSAIS = [
  ['le calendrier s\'ouvre sur aujourd\'hui, la semaine commence le lundi, les numéros de semaine sont là', async ({ ouvrir }) => {
    const page = await ouvrir();
    assert.equal(await titre(page), 'Novembre 2026');
    assert.deepEqual(await page.locator('.cal-nom').allInnerTexts(), ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']);
    assert.deepEqual(await page.locator('.cal-corps .cal-sem').allInnerTexts(), ['S44', 'S45', 'S46', 'S47', 'S48', 'S49']);
    assert.equal(await page.locator('.cal-fond').first().getAttribute('data-jour'), '2026-10-26');
    assert.equal(await page.locator('.cal-num-aujourdhui').innerText(), '3');
    assert.equal(await page.locator('.cal-num-aujourdhui').getAttribute('aria-current'), 'date');
    assert.deepEqual(page.erreurs, []);
  }],
  ['le nombre de barres suit la hauteur : une dans le panneau 700 × 400, davantage dans un cadre haut', async ({ ouvrir }) => {
    const petit = await ouvrir();
    const visibles = page => page.locator('.cal-evt[data-id="3"], .cal-evt[data-id="5"], .cal-evt[data-id="6"]').count();
    assert.equal(await visibles(petit), 1);
    assert.equal(await petit.locator('.cal-plus').innerText(), '+2');
    const grand = await ouvrir({ hauteur: 900 });
    assert.equal(await visibles(grand), 3);
    assert.equal(await grand.locator('.cal-plus').count(), 0);
  }],
  ['un jour demandé par l\'hôte remplace aujourd\'hui, une seule fois', async ({ ouvrir }) => {
    const page = await ouvrir({ options: { jourCourant: '2027-02-10' } });
    assert.equal(await titre(page), 'Février 2027');
    await page.getByRole('button', { name: 'Suivant' }).click();
    assert.equal(await titre(page), 'Mars 2027');
    await page.evaluate(() => kit.calendrier.definir({ lignes: [], options: { jourCourant: '2027-02-10' } }));
    assert.equal(await titre(page), 'Mars 2027');
    await page.evaluate(() => kit.calendrier.definir({ lignes: [], options: { jourCourant: '2028-01-05' } }));
    assert.equal(await titre(page), 'Janvier 2028');
  }],
  ['les événements : une barre à cheval sur deux semaines, la couleur de Grist, l\'heure', async ({ ouvrir }) => {
    const page = await ouvrir();
    assert.equal(await page.locator('.cal-evt[data-id="1"]').count(), 2);
    assert.equal(await page.locator('.cal-evt[data-id="1"]').first().evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(223, 245, 232)');
    assert.match(await page.locator('.cal-evt[data-id="4"]').innerText(), /09:30\s+Atelier/);
    assert.equal(await page.locator('.cal-evt[data-id="9"]').count(), 0);
    assert.match(await page.locator('.cal-avis').innerText(), /Une tâche écartée/);
  }],
  ['« +n » compte ce qui dépasse et ouvre la liste du jour ; Échap la ferme', async ({ ouvrir }) => {
    const page = await ouvrir({ options: { maxPistes: 2 } });
    const plus = page.locator('.cal-plus');
    assert.equal(await plus.count(), 1);
    assert.equal(await plus.innerText(), '+1');
    await plus.click();
    const liste = page.locator('.cal-liste');
    assert.equal(await liste.count(), 1);
    assert.deepEqual(await liste.locator('.cal-liste-ligne').allTextContents(), ['Bilan', 'Maquettes', 'Revue']);
    assert.equal(await liste.locator('.cal-liste-titre').evaluate(el => el.firstChild.textContent), 'Vendredi 13 novembre 2026');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.cal-liste').count(), 0);
    assert.deepEqual(page.erreurs, []);
  }],
  ['un clic sur un événement le dit à l\'hôte', async ({ ouvrir }) => {
    const page = await ouvrir({ options: { maxPistes: 2 } });
    await page.locator('.cal-evt[data-id="2"]').click();
    assert.deepEqual(await appels(page, 'ouvrir'), [2]);
    await page.locator('.cal-evt[data-id="3"]').focus();
    await page.keyboard.press('Enter');
    assert.deepEqual(await appels(page, 'ouvrir'), [2, 3]);
  }],
  ['ajouter par saisie rapide : Entrée envoie le titre, Échap annule, un titre vide n\'envoie rien', async ({ ouvrir }) => {
    const page = await ouvrir();
    await page.locator('.cal-fond[data-jour="2026-11-17"]').click();
    const champ = page.locator('.cal-saisie-champ');
    assert.equal(await champ.count(), 1);
    await page.keyboard.press('Enter');
    assert.deepEqual(await appels(page, 'ajouter'), []);
    await page.keyboard.type('Appeler le fournisseur');
    await page.keyboard.press('Enter');
    assert.deepEqual(await appels(page, 'ajouter'), [{ debut: '2026-11-17', titre: 'Appeler le fournisseur' }]);
    assert.equal(await page.locator('.cal-saisie').count(), 0);
    await page.locator('.cal-num[data-jour="2026-11-18"]').click();
    await page.keyboard.type('Brouillon');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.cal-saisie').count(), 0);
    assert.equal((await appels(page, 'ajouter')).length, 1);
    assert.deepEqual(page.erreurs, []);
  }],
  ['l\'hôte qui redéfinit les lignes pendant une saisie ferme la saisie sans erreur, le calendrier reste entier', async ({ ouvrir }) => {
    const page = await ouvrir();
    await page.locator('.cal-fond[data-jour="2026-11-17"]').click();
    await page.keyboard.type('Brouillon');
    await page.evaluate(() => kit.calendrier.definir({ lignes: [{ id: 1, titre: 'Nouvelle', debut: '2026-11-04' }], options: { maintenant: () => new Date(2026, 10, 3, 10), langue: 'fr' } }));
    await page.waitForFunction(() => !document.querySelector('.cal-saisie'));
    assert.equal(await page.locator('.cal-evt[data-id="1"]').count(), 1);
    assert.equal(await titre(page), 'Novembre 2026');
    assert.deepEqual(page.erreurs, []);
  }],
  ['une saisie refusée par l\'hôte reste ouverte avec son titre', async ({ ouvrir }) => {
    const page = await ouvrir();
    await page.evaluate(() => { kit.reponse = 'refus'; });
    await page.locator('.cal-fond[data-jour="2026-11-17"]').click();
    await page.keyboard.type('Refusée');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.cal-saisie-champ[aria-invalid="true"]');
    assert.equal(await page.locator('.cal-saisie-champ').inputValue(), 'Refusée');
  }],
  ['glisser un événement sur un autre jour : l\'écart est gardé, l\'hôte reçoit les dates', async ({ ouvrir }) => {
    const page = await ouvrir();
    await page.dragAndDrop('.cal-evt[data-id="2"]', '.cal-fond[data-jour="2026-11-11"]');
    assert.deepEqual(await appels(page, 'deplacer'), [{ id: 2, debut: '2026-11-11', fin: '2026-11-11' }]);
    assert.equal(await page.locator('.cal-fond[data-jour="2026-11-11"]').count(), 1);
  }],
  ['glisser une barre de plusieurs jours par son premier jour garde l\'écart', async ({ ouvrir }) => {
    const page = await ouvrir({ lignes: [{ id: 1, titre: 'Long', debut: '2026-11-03', fin: '2026-11-05' }] });
    const barre = page.locator('.cal-evt[data-id="1"]');
    const boite = await barre.boundingBox();
    const cible = await page.locator('.cal-fond[data-jour="2026-11-10"]').boundingBox();
    await page.mouse.move(boite.x + 8, boite.y + boite.height / 2);
    await page.mouse.down();
    await page.mouse.move(cible.x + cible.width / 2, cible.y + cible.height / 2, { steps: 8 });
    await page.mouse.up();
    assert.deepEqual(await appels(page, 'deplacer'), [{ id: 1, debut: '2026-11-10', fin: '2026-11-12' }]);
  }],
  ['un déplacement refusé par l\'hôte ramène l\'événement à sa place', async ({ ouvrir }) => {
    for (const reponse of ['refus', 'erreur']) {
      const page = await ouvrir();
      await page.evaluate(r => { kit.reponse = r; }, reponse);
      await page.dragAndDrop('.cal-evt[data-id="2"]', '.cal-fond[data-jour="2026-11-11"]');
      await page.waitForFunction(() => kit.appels.some(a => a.nom === 'deplacer'));
      await page.waitForFunction(() => document.querySelector('.cal-fond[data-jour="2026-11-09"]').closest('.cal-zone').querySelectorAll('.cal-evt[data-id="2"]').length === 1);
      assert.equal(await page.locator('.cal-fond[data-jour="2026-11-09"]').evaluate(f => f.closest('.cal-zone').querySelectorAll('.cal-evt[data-id="2"]').length), 1, reponse);
    }
  }],
  ['le plateau « Sans date » : le compte, l\'ouverture, un dépôt sur un jour donne une date', async ({ ouvrir }) => {
    const page = await ouvrir();
    const bouton = page.locator('.cal-plateau-bouton');
    assert.equal(await bouton.locator('.cal-compte').innerText(), '2');
    assert.equal(await page.locator('.cal-plateau').count(), 0);
    await bouton.click();
    assert.deepEqual(await page.locator('.cal-puce').allInnerTexts(), ['À planifier', 'Autre à planifier']);
    await page.dragAndDrop('.cal-puce[data-id="7"]', '.cal-fond[data-jour="2026-11-20"]');
    assert.deepEqual(await appels(page, 'deplacer'), [{ id: 7, debut: '2026-11-20', fin: '2026-11-20' }]);
    await page.waitForSelector('.cal-evt[data-id="7"]');
    assert.deepEqual(await page.locator('.cal-puce').allInnerTexts(), ['Autre à planifier']);
  }],
  ['sans tâche sans date, le bouton est grisé avec sa raison, jamais masqué', async ({ ouvrir }) => {
    const page = await ouvrir({ lignes: [{ id: 1, titre: 'A', debut: '2026-11-04' }] });
    const bouton = page.locator('.cal-plateau-bouton');
    assert.equal(await bouton.getAttribute('aria-disabled'), 'true');
    assert.equal(await bouton.getAttribute('title'), 'Aucune tâche sans date');
  }],
  ['lecture seule : rien ne glisse, rien ne s\'ajoute, les raisons sont dites', async ({ ouvrir }) => {
    const page = await ouvrir({ options: { lectureSeule: true } });
    assert.equal(await page.locator('.cal-evt[data-id="2"]').getAttribute('draggable'), null);
    assert.match(await page.locator('.cal-evt[data-id="2"]').getAttribute('title'), /Lecture seule/);
    await page.locator('.cal-fond[data-jour="2026-11-17"]').click();
    assert.equal(await page.locator('.cal-saisie').count(), 0);
    assert.equal(await page.locator('.cal-num[data-jour="2026-11-17"]').getAttribute('aria-disabled'), 'true');
  }],
  ['une ligne non modifiable est grisée et ne glisse pas', async ({ ouvrir }) => {
    const page = await ouvrir({ lignes: [{ id: 1, titre: 'Figée', debut: '2026-11-04', modifiable: false }] });
    assert.equal(await page.locator('.cal-evt[data-id="1"]').getAttribute('draggable'), null);
    assert.match(await page.locator('.cal-evt[data-id="1"]').getAttribute('title'), /ne peut pas être déplacée/);
  }],
  ['la vue Semaine : sept jours, le lundi d\'abord, un titre de période, la bande des jours entiers', async ({ ouvrir }) => {
    const page = await ouvrir();
    await page.getByRole('button', { name: 'Semaine' }).click();
    assert.equal(await page.locator('.cal-fond').first().getAttribute('data-jour'), '2026-11-02');
    assert.equal(await page.locator('.cal-fond').last().getAttribute('data-jour'), '2026-11-08');
    assert.equal(await page.locator('.cal-colonne').count(), 7);
    assert.match(await titre(page), /2.*8 nov.*2026/);
    assert.deepEqual((await appels(page, 'etat')).at(-1), { vue: 'semaine', jourCourant: '2026-11-03' });
    assert.equal(await page.locator('.cal-bande .cal-evt[data-id="1"]').count(), 1);
    await page.getByRole('button', { name: 'Suivant' }).click();
    assert.equal(await page.locator('.cal-fond').first().getAttribute('data-jour'), '2026-11-09');
  }],
  ['la vue Jour : une colonne, le jour en toutes lettres, précédent et suivant avancent d\'un jour', async ({ ouvrir }) => {
    const page = await ouvrir();
    await page.getByRole('button', { name: 'Jour', exact: true }).click();
    assert.equal(await titre(page), 'Mardi 3 novembre 2026');
    assert.equal(await page.locator('.cal-colonne').count(), 1);
    assert.equal(await page.locator('.cal-bande-jour .cal-evt[data-id="1"]').count(), 1);
    await page.getByRole('button', { name: 'Suivant' }).click();
    assert.equal(await titre(page), 'Mercredi 4 novembre 2026');
    assert.equal(await page.locator('.cal-colonne').getAttribute('data-jour'), '2026-11-04');
    assert.deepEqual((await appels(page, 'etat')).at(-1), { vue: 'jour', jourCourant: '2026-11-04' });
  }],
  ['les blocs horaires : à leur heure, de leur durée, côte à côte quand ils se chevauchent', async ({ ouvrir }) => {
    const page = await ouvrir({ lignes: HEURES, options: { vue: 'semaine' } });
    const colonne = await boite(page, '.cal-colonne[data-jour="2026-11-03"]');
    assert.equal(Math.round(colonne.height), 960);
    const [a, b, dejeuner] = [await boite(page, '.cal-bloc[data-id="20"]'), await boite(page, '.cal-bloc[data-id="21"]'), await boite(page, '.cal-bloc[data-id="22"]')];
    assert.equal(Math.round(a.y - colonne.y), 380);
    assert.equal(Math.round(a.height), 40);
    assert.equal(Math.round(b.y - colonne.y), 400);
    assert.equal(Math.round(b.height), 80);
    assert.ok(Math.abs(a.width - colonne.width / 2) < 2 && Math.abs(b.width - colonne.width / 2) < 2);
    assert.ok(b.x > a.x);
    const colonneJeudi = await boite(page, '.cal-colonne[data-jour="2026-11-05"]');
    assert.equal(Math.round(dejeuner.y - colonneJeudi.y), 480);
    assert.ok(Math.abs(dejeuner.width - colonneJeudi.width) < 2);
    assert.match(await page.locator('.cal-bloc[data-id="20"]').innerText(), /09:30\s*Point équipe/);
    assert.equal(await page.locator('.cal-bloc[data-id="23"]').count(), 0);
    assert.equal(await page.locator('.cal-bande .cal-evt[data-id="23"]').count(), 1);
  }],
  ['la grille horaire s\'ouvre vers 7 h et défile', async ({ ouvrir }) => {
    const page = await ouvrir({ lignes: HEURES, options: { vue: 'semaine' } });
    const defile = await page.locator('.cal-heures').evaluate(e => e.scrollTop);
    assert.ok(defile > 250 && defile < 290, String(defile));
  }],
  ['glisser un bloc : le jour et l\'heure changent, la durée est gardée, au quart d\'heure', async ({ ouvrir }) => {
    const page = await ouvrir({ lignes: HEURES, options: { vue: 'semaine' } });
    await page.dragAndDrop('.cal-bloc[data-id="22"]', '.cal-colonne[data-jour="2026-11-06"]', { sourcePosition: { x: 10, y: 20 }, targetPosition: { x: 20, y: 510 } });
    assert.deepEqual(await appels(page, 'deplacer'), [{ id: 22, debut: '2026-11-06T12:15', fin: '2026-11-06T14:15' }]);
    await page.waitForSelector('.cal-colonne[data-jour="2026-11-06"] .cal-bloc[data-id="22"]');
  }],
  ['glisser un bloc refusé par l\'hôte le ramène à sa place', async ({ ouvrir }) => {
    const page = await ouvrir({ lignes: HEURES, options: { vue: 'semaine' } });
    await page.evaluate(() => { kit.reponse = 'refus'; });
    await page.dragAndDrop('.cal-bloc[data-id="22"]', '.cal-colonne[data-jour="2026-11-06"]', { sourcePosition: { x: 10, y: 20 }, targetPosition: { x: 20, y: 500 } });
    await page.waitForFunction(() => kit.appels.some(a => a.nom === 'deplacer'));
    await page.waitForSelector('.cal-colonne[data-jour="2026-11-05"] .cal-bloc[data-id="22"]');
    assert.equal(await page.locator('.cal-colonne[data-jour="2026-11-06"] .cal-bloc').count(), 0);
  }],
  ['une tâche sans date déposée dans la grille reçoit l\'heure déposée et une heure de durée', async ({ ouvrir }) => {
    const page = await ouvrir({ lignes: HEURES, options: { vue: 'semaine' } });
    await page.locator('.cal-plateau-bouton').click();
    await page.dragAndDrop('.cal-puce[data-id="24"]', '.cal-colonne[data-jour="2026-11-04"]', { targetPosition: { x: 20, y: 440 } });
    assert.deepEqual(await appels(page, 'deplacer'), [{ id: 24, debut: '2026-11-04T11:00', fin: '2026-11-04T12:00' }]);
  }],
  ['un clic dans une colonne vide ajoute à cette heure', async ({ ouvrir }) => {
    const page = await ouvrir({ lignes: HEURES, options: { vue: 'semaine' } });
    await page.locator('.cal-colonne[data-jour="2026-11-04"]').click({ position: { x: 20, y: 14 * 40 + 5 } });
    await page.keyboard.type('Rappel client');
    await page.keyboard.press('Enter');
    assert.deepEqual(await appels(page, 'ajouter'), [{ debut: '2026-11-04T14:00', titre: 'Rappel client' }]);
  }],
  ['un clic sur un bloc ouvre la tâche ; en lecture seule le bloc est grisé et ne glisse pas', async ({ ouvrir }) => {
    const page = await ouvrir({ lignes: HEURES, options: { vue: 'semaine', lectureSeule: true } });
    await page.locator('.cal-bloc[data-id="22"]').click();
    assert.deepEqual(await appels(page, 'ouvrir'), [22]);
    assert.equal(await page.locator('.cal-bloc[data-id="22"]').getAttribute('draggable'), null);
    assert.match(await page.locator('.cal-bloc[data-id="22"]').getAttribute('title'), /Lecture seule/);
  }],
  ['en vue Jour, la bande des jours entiers reçoit un dépôt et un clic ajoute un jour entier', async ({ ouvrir }) => {
    const page = await ouvrir({ lignes: HEURES, options: { vue: 'jour', jourCourant: '2026-11-04' } });
    await page.locator('.cal-bande-jour').click({ position: { x: 300, y: 28 } });
    await page.keyboard.type('Toute la journée');
    await page.keyboard.press('Enter');
    assert.deepEqual(await appels(page, 'ajouter'), [{ debut: '2026-11-04', titre: 'Toute la journée' }]);
  }],
  ['« Aujourd\'hui » ramène sur aujourd\'hui ; précédent et suivant changent de mois', async ({ ouvrir }) => {
    const page = await ouvrir();
    await page.getByRole('button', { name: 'Précédent' }).click();
    assert.equal(await titre(page), 'Octobre 2026');
    await page.getByRole('button', { name: 'Aujourd\'hui' }).click();
    assert.equal(await titre(page), 'Novembre 2026');
    assert.deepEqual((await appels(page, 'etat')).at(-1), { vue: 'mois', jourCourant: '2026-11-03' });
  }],
  ['en anglais : les textes, les noms des jours et les numéros de semaine suivent', async ({ ouvrir }) => {
    const page = await ouvrir({ options: { langue: 'en' } });
    assert.equal(await titre(page), 'November 2026');
    assert.equal(await page.locator('.cal-aujourdhui').innerText(), 'Today');
    assert.equal((await page.locator('.cal-nom').allInnerTexts())[0], 'Mon');
    assert.equal((await page.locator('.cal-corps .cal-sem').allInnerTexts())[1], 'W45');
    assert.equal(await page.locator('.cal-plateau-bouton').evaluate(b => b.firstChild.textContent), 'No date');
  }],
  ['la semaine peut commencer le dimanche si l\'hôte le demande', async ({ ouvrir }) => {
    const page = await ouvrir({ options: { debutSemaine: 0 } });
    assert.equal((await page.locator('.cal-nom').allInnerTexts())[0], 'Dim');
    assert.equal(await page.locator('.cal-fond').first().getAttribute('data-jour'), '2026-11-01');
  }],
  ['clair et sombre : le fond et le texte suivent les jetons, rien n\'est écrit en dur', async ({ ouvrir }) => {
    const clair = await ouvrir({ theme: 'light' });
    const sombre = await ouvrir({ theme: 'dark' });
    const lire = page => page.locator('.cal').evaluate(e => ({ fond: getComputedStyle(e).backgroundColor, texte: getComputedStyle(e).color }));
    const [a, b] = [await lire(clair), await lire(sombre)];
    assert.notDeepEqual(a, b);
    assert.equal(a.fond, 'rgb(255, 255, 255)');
  }],
  ['la liste de lignes vides ou absentes ne casse rien', async ({ ouvrir }) => {
    const page = await ouvrir({ lignes: [] });
    assert.equal(await page.locator('.cal-evt').count(), 0);
    await page.evaluate(() => kit.calendrier.definir({}));
    await page.evaluate(() => kit.calendrier.definir({ lignes: null, options: null }));
    assert.equal(await page.locator('.cal-ligne').count(), 6);
    assert.deepEqual(page.erreurs, []);
  }],
  ['detruire retire le calendrier de la page', async ({ ouvrir }) => {
    const page = await ouvrir();
    await page.evaluate(() => kit.calendrier.detruire());
    assert.equal(await page.locator('.cal').count(), 0);
  }],
];

// Chaque essai rend sa propre page (les siennes sont fermées à la fin) ; un essai qui échoue dit où, et les suivants se jouent quand même.
export async function gestes(env) {
  for (const [nom, essai] of ESSAIS) {
    const ouvertes = [];
    try {
      await essai({ ouvrir: options => ouvrirCalendrier(env, ouvertes, options) });
      check(`calendrier : ${nom}`, true);
    } catch (erreur) {
      check(`calendrier : ${nom}`, false, String(erreur && erreur.message || erreur).slice(0, 700));
    }
    for (const page of ouvertes) await page.context().close();
  }
}
