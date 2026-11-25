// Les essais de la fenêtre de mise à jour des noms, dans un vrai navigateur au format du panneau de Grist (700 × 400), à la vraie souris et au vrai clavier, en clair et en sombre, en
// français et en anglais : qui la voit, ce qu'elle dit, ce que font Échap, Tab et un clic à côté (rien : elle est bloquante), chaque fin (terminé, refusé, déjà fait, nom pris, pas de
// réponse) et les contrastes tels que le navigateur les rend. Le document est un faux qui se comporte comme le vrai Grist (test/names-update-fake.mjs).
import { join } from 'node:path';
import { check, click, press, rect, focused, openPage, visibleTexts } from './aide.mjs';
import { ratio } from '../test/jetons.mjs';

const WORDS = {
  fr: { title: 'Mise à jour des noms de vos tables', start: 'Mettre à jour', working: 'Mise à jour…', next: 'Continuer', skip: 'Continuer sans mettre à jour', retry: 'Réessayer', verify: 'Vérifier',
    done7: 'Terminé : 7 tables mises à jour, 56 lignes vérifiées avant et après, aucune modifiée.', already: 'C’est déjà fait : les noms sont à jour.', more: '… et 2 autres', held: 'Une table garde son ancien nom', list: 'Voir les noms qui changent' },
  en: { title: 'Updating the names of your tables', start: 'Update', working: 'Updating…', next: 'Continue', skip: 'Continue without updating', retry: 'Try again', verify: 'Check',
    done7: 'Done: 7 tables updated, 56 rows checked before and after, none changed.', already: 'Already done: the names are up to date.', more: '… and 2 more', held: 'One table keeps its old name', list: 'See the names that change' },
};
const MODAL = '#nu-modal';
const BOX = `${MODAL} .pp-modal-box`;
const inside = (box, gap = 12) => box.x >= gap - 0.5 && box.y >= gap - 0.5 && box.right <= 700 - gap + 0.5 && box.bottom <= 400 - gap + 0.5;
const isOpen = page => page.evaluate(selector => { const el = document.querySelector(selector); return Boolean(el) && getComputedStyle(el).display !== 'none'; }, MODAL);
const buttons = page => page.$$eval(`${MODAL} .pp-modal-actions button:not([hidden])`, list => list.map(button => button.textContent));
const bodyText = page => page.$eval(`${MODAL} .nu-body`, el => el.textContent);
const outcomeOf = page => page.evaluate(() => window.kit.outcome);
async function clickButton(page, text) {
  const box = await page.locator(`${MODAL} .pp-modal-actions button:not([hidden])`).filter({ hasText: text }).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const open = async (env, tag, caseName, system, locale, shots) => {
  const { page, warnings } = await openPage(env, { colorScheme: system, locale, path: 'noms.html', search: `?case=${caseName}` });
  await page.waitForFunction(() => window.kit.outcome || document.querySelector('#nu-modal'));
  if (shots) await page.screenshot({ path: join(env.shots, `noms-${caseName}-${tag.replace(/ /g, '-')}.png`) });
  return { page, warnings };
};

// Le texte et son fond, tels que le navigateur les rend : 4,5:1 au moins.
async function contrasts(page, tag, what, selectors) {
  const texts = await visibleTexts(page, selectors);
  check(`[${tag}] ${what} : des textes à mesurer`, texts.length >= 1, texts);
  for (const text of texts) {
    const value = ratio(text.color, text.background);
    check(`[${tag}] contraste de « ${text.text} » (${text.selector}) : ${value.toFixed(2)}:1`, value >= 4.5);
  }
}

// La fenêtre avant le clic : ce qu'elle dit, où elle tient, qui a le focus, et le fait qu'elle ne se ferme pas sans qu'on ait cliqué.
async function ready(env, tag, system, locale, words) {
  const { page, warnings } = await open(env, tag, 'ready', system, locale, true);
  check(`[${tag}] la fenêtre s'ouvre toute seule pour un propriétaire, titre « ${words.title} »`, (await isOpen(page)) && (await page.$eval(`${BOX} h3`, el => el.textContent)) === words.title);
  check(`[${tag}] elle tient dans le panneau de 700 × 400, 12 px de marge, titre et bouton visibles`, inside(await rect(page, BOX)) && (await rect(page, `${BOX} .pp-modal-actions`)).bottom <= 388.5, await rect(page, BOX));
  check(`[${tag}] un seul bouton, « ${words.start} » (pas d'Annuler : la fenêtre est bloquante), et le focus dessus`, (await buttons(page)).join() === words.start && (await focused(page)) === words.start, await buttons(page));
  const text = await bodyText(page);
  check(`[${tag}] elle dit : données inchangées, quelques secondes, « ${words.more} » après cinq paires`, /Publipostage_Modeles/.test(text) && text.includes(words.more) && (await page.$$eval('.nu-pairs li', items => items.length)) === 6, text.slice(0, 200));
  check(`[${tag}] le bandeau Sync+ n'apparaît pas quand aucune table n'est gardée`, !text.includes(words.held));
  check(`[${tag}] elle dit : données inchangées et quelques secondes`, /(mêmes lignes|same rows)/.test(text) && /(quelques secondes|a few seconds)/.test(text), text.slice(0, 160));
  check(`[${tag}] le dialogue est modal et nommé par son titre`, await page.$eval(BOX, el => el.getAttribute('role') === 'dialog' && el.getAttribute('aria-modal') === 'true' && document.getElementById(el.getAttribute('aria-labelledby')).textContent.length > 0));
  const unseen = await page.evaluate(() => window.kit.doc.applied.length);
  await press(page, 'Escape');
  check(`[${tag}] Échap ne ferme rien`, (await isOpen(page)) && (await outcomeOf(page)) === null);
  await page.mouse.click(5, 5);
  check(`[${tag}] un clic sur le voile ne ferme rien`, await isOpen(page));
  const opened = () => page.$eval('.nu-details', el => el.open);
  const above = async selector => (await rect(page, selector)).bottom <= (await rect(page, `${BOX} .pp-modal-actions`)).y;
  check(`[${tag}] le plus important est visible sans défiler : « quelques secondes » et les données inchangées, au-dessus du bouton`, (await above('.nu-strong')) && (await above('.nu-details summary')));
  check(`[${tag}] la liste des noms est fermée : elle s'ouvre sous « ${words.list} »`, !(await opened()) && (await page.$eval('.nu-details summary', el => el.textContent)).startsWith(words.list), await page.$eval('.nu-details summary', el => el.textContent));
  await press(page, 'Tab');
  check(`[${tag}] Tab va au titre de la liste, puis revient au bouton (le tour reste dans la fenêtre)`, (await focused(page)).startsWith(words.list) && (await press(page, 'Tab'), (await focused(page))) === words.start);
  await press(page, 'Shift+Tab');
  await press(page, 'Enter');
  check(`[${tag}] Entrée sur le titre ouvre la liste : cinq paires et « ${words.more} »`, (await opened()) && (await page.$$eval('.nu-pairs li', items => items.length)) === 6 && (await bodyText(page)).includes(words.more));
  await contrasts(page, tag, 'liste ouverte', ['.nu-pairs code', '.nu-details summary']);
  await page.screenshot({ path: join(env.shots, `noms-liste-${tag.replace(/ /g, '-')}.png`) });
  await press(page, 'Enter');
  check(`[${tag}] Entrée referme la liste`, !(await opened()));
  await press(page, 'Tab');
  check(`[${tag}] rien n'est écrit dans le document tant qu'on n'a pas cliqué`, unseen === 0);
  await contrasts(page, tag, 'avant le clic', ['.nu-box h3', '.nu-text', '.nu-pairs code', '.pp-modal-primary']);
  check(`[${tag}] aucun avertissement de la console (clé de traduction inconnue…)`, warnings.length === 0, warnings);

  await clickButton(page, words.start);
  await page.waitForFunction(() => /^(Terminé|Done)/.test(document.querySelector('#nu-modal .nu-body').textContent));
  check(`[${tag}] le résultat : « ${words.done7} »`, (await bodyText(page)) === words.done7, await bodyText(page));
  check(`[${tag}] le bouton devient « ${words.next} », seul, avec le focus`, (await buttons(page)).join() === words.next && (await focused(page)) === words.next, await buttons(page));
  await contrasts(page, tag, 'après la mise à jour', ['.nu-ok', '.pp-modal-primary']);
  const tables = await page.evaluate(() => window.kit.doc.tables());
  check(`[${tag}] les 7 tables sont renommées, la colonne aussi ; la table de la personne n'a pas bougé`,
    Object.keys(tables).includes('Publipostage_Templates') && !Object.keys(tables).some(name => /Modeles|Jetons|Journal/.test(name)) && tables.Publipostage_Templates.includes('Name') && tables.Clients.join() === 'Nom,Ville', tables);
  check(`[${tag}] un seul lot a été envoyé`, (await page.evaluate(() => window.kit.doc.applied.length)) === 1);
  await clickButton(page, words.next);
  const outcome = await outcomeOf(page);
  check(`[${tag}] « ${words.next} » ferme la fenêtre et rend « done » à l'app`, !(await isOpen(page)) && outcome.state === 'done' && outcome.result.tables === 7 && outcome.result.rows === 56, outcome);
  check(`[${tag}] le voile est retiré de la page (rien ne reste derrière)`, (await page.$$('.pp-modal')).length === 0);
}

// Une table que Sync+ utilise garde son nom, et la fenêtre le dit.
async function withSync(env, tag, system, locale, words) {
  const { page } = await open(env, tag, 'sync', system, locale, true);
  const text = await bodyText(page);
  check(`[${tag}] le bandeau dit qu'une table garde son ancien nom (Sync+) et laquelle`, text.includes(words.held) && text.includes('Publipostage_Modeles'), text.slice(-260));
  check(`[${tag}] la table gardée n'est pas dans la liste de ce qui sera renommé`, (await page.$$eval('.nu-pairs code', codes => codes.map(code => code.textContent))).every(name => name !== 'Publipostage_Modeles'));
  check(`[${tag}] le bandeau Sync+ est visible sans défiler`, (await rect(page, '.nu-held')).bottom <= (await rect(page, `${BOX} .pp-modal-actions`)).y, await rect(page, '.nu-held'));
  await contrasts(page, tag, 'bandeau Sync+', ['.nu-held']);
  await clickButton(page, words.start);
  await page.waitForFunction(() => window.kit.outcome === null && /^(Terminé|Done)/.test(document.querySelector('#nu-modal .nu-body').textContent));
  const tables = await page.evaluate(() => window.kit.doc.tables());
  check(`[${tag}] la table de Sync+ garde son nom ET ses colonnes (id_sync comprise) ; les autres sont renommées`, tables.Publipostage_Modeles && tables.Publipostage_Modeles.includes('id_sync') && tables.Publipostage_Modeles.includes('Nom') && tables.Publipostage_TemplatePreferences && !tables.Publipostage_PreferencesModeles, tables);
  await clickButton(page, words.next);
  check(`[${tag}] l'app est prévenue des tables gardées (held)`, JSON.stringify((await outcomeOf(page)).held) === JSON.stringify(['Publipostage_Modeles']), await outcomeOf(page));
}

// Grist refuse : rien n'a changé, on peut réessayer ou continuer sans.
async function refused(env, tag, system, locale, words) {
  const { page } = await open(env, tag, 'refuse', system, locale);
  await clickButton(page, words.start);
  await page.waitForFunction(() => /Rien n’a changé|Nothing changed/.test(document.querySelector('#nu-modal .nu-body').textContent));
  check(`[${tag}] refus : « Rien n'a changé dans vos données », le détail de Grist, et deux boutons`, (await buttons(page)).join() === [words.skip, words.retry].join() && /access rules/.test(await bodyText(page)), { buttons: await buttons(page), text: await bodyText(page) });
  check(`[${tag}] refus : le focus est sur « ${words.retry} », et la fenêtre tient dans le panneau`, (await focused(page)) === words.retry && inside(await rect(page, BOX)));
  check(`[${tag}] refus : rien n'a été renommé`, (await page.evaluate(() => Object.keys(window.kit.doc.tables()))).includes('Publipostage_Modeles'));
  await contrasts(page, tag, 'refus', ['.nu-alert', '.nu-muted']);
  await clickButton(page, words.retry);
  await page.waitForFunction(() => /^(Terminé|Done)/.test(document.querySelector('#nu-modal .nu-body').textContent));
  check(`[${tag}] « ${words.retry} » : la cause a disparu, la mise à jour passe`, (await page.evaluate(() => Object.keys(window.kit.doc.tables()))).includes('Publipostage_Templates'));
  await clickButton(page, words.next);

  const second = await open(env, tag, 'refuse', system, locale);
  await clickButton(second.page, words.start);
  await second.page.waitForFunction(() => /Rien n’a changé|Nothing changed/.test(document.querySelector('#nu-modal .nu-body').textContent));
  await press(second.page, 'Escape');
  const outcome = await outcomeOf(second.page);
  check(`[${tag}] après un refus, Échap vaut « ${words.skip} » : la fenêtre se ferme, l'app reçoit « skipped »`, !(await isOpen(second.page)) && outcome.state === 'skipped', outcome);
}

// Pendant la mise à jour : bouton grisé, Échap sans effet ; puis la fin.
async function slow(env, tag, system, locale, words) {
  const { page } = await open(env, tag, 'slow', system, locale);
  await clickButton(page, words.start);
  await page.waitForFunction(() => document.querySelector('#nu-modal .pp-modal-primary').disabled);
  check(`[${tag}] pendant la mise à jour : « ${words.working} », bouton grisé, un seul bouton`, (await buttons(page)).join() === words.working, await buttons(page));
  await press(page, 'Escape');
  await page.mouse.click(5, 5);
  check(`[${tag}] pendant la mise à jour, Échap et le voile ne ferment rien`, await isOpen(page));
  await page.waitForFunction(() => /^(Terminé|Done)/.test(document.querySelector('#nu-modal .nu-body').textContent), null, { timeout: 8000 });
  check(`[${tag}] la fin arrive : « ${words.next} » avec le focus`, (await focused(page)) === words.next);
}

// Les fins que la personne ne provoque pas : un autre onglet est passé avant, un nom a été pris, pas de réponse.
async function others(env, tag, system, locale, words) {
  const first = await open(env, tag, 'few', system, locale);
  await first.page.evaluate(() => window.kit.doc.port.apply(window.kit.plan({ tables: window.kit.doc.tables() })));
  await clickButton(first.page, words.start);
  await first.page.waitForFunction(() => document.querySelector('#nu-modal .nu-body').textContent.length < 80);
  check(`[${tag}] un autre onglet est passé avant : « ${words.already} »`, (await bodyText(first.page)) === words.already && (await page_applied(first.page)) === 1, await bodyText(first.page));
  await clickButton(first.page, words.next);
  check(`[${tag}] l'app reçoit « already »`, (await outcomeOf(first.page)).state === 'already');

  const taken = await open(env, tag, 'few', system, locale);
  await taken.page.evaluate(() => window.kit.doc.add('Publipostage_Templates', ['Name'], 1));
  await clickButton(taken.page, words.start);
  await taken.page.waitForFunction(() => /existe déjà|already exists/.test(document.querySelector('#nu-modal .nu-body').textContent));
  check(`[${tag}] un nom d'arrivée est pris entre-temps : rien n'est envoyé, un seul bouton « ${words.next} »`, (await page_applied(taken.page)) === 0 && (await buttons(taken.page)).join() === words.next, await bodyText(taken.page));
  await clickButton(taken.page, words.next);
  check(`[${tag}] l'app reçoit « blocked »`, (await outcomeOf(taken.page)).state === 'blocked');

  const hang = await open(env, tag, 'hang', system, locale);
  await clickButton(hang.page, words.start);
  await hang.page.waitForFunction(() => /pas encore connu|not known yet/.test(document.querySelector('#nu-modal .nu-body').textContent), null, { timeout: 8000 });
  check(`[${tag}] pas de réponse : le résultat n'est « pas encore connu », « ${words.skip} » ou « ${words.verify} »`, (await buttons(hang.page)).join() === [words.skip, words.verify].join(), await buttons(hang.page));
  await clickButton(hang.page, words.verify);
  await hang.page.waitForFunction(() => /^(Terminé|Done)/.test(document.querySelector('#nu-modal .nu-body').textContent));
  check(`[${tag}] « ${words.verify} » relit les noms et relance : terminé`, (await page_tables(hang.page)).includes('Publipostage_Templates'));
}
const page_applied = page => page.evaluate(() => window.kit.doc.applied.length);
const page_tables = page => page.evaluate(() => Object.keys(window.kit.doc.tables()));

// Ceux qui ne voient rien : un lecteur, un document déjà aux noms anglais, les deux jeux de noms.
async function silent(env, tag, system, locale) {
  for (const [name, state, why] of [['viewer', 'wait', 'pas propriétaire'], ['none', 'none', 'déjà aux noms anglais'], ['both', 'blocked', 'les deux jeux de noms']]) {
    const { page } = await open(env, tag, name, system, locale);
    await page.waitForFunction(() => window.kit.outcome);
    const outcome = await outcomeOf(page);
    check(`[${tag}] ${why} : aucune fenêtre, l'app reçoit « ${state} »`, outcome.state === state && (await page.$$('.pp-modal')).length === 0 && (await page_applied(page)) === 0, outcome);
  }
}

export async function namesUpdate(env, system, locale) {
  const lang = locale.startsWith('fr') ? 'fr' : 'en';
  const tag = `${system === 'dark' ? 'sombre' : 'clair'} ${lang}`;
  const words = WORDS[lang];
  await ready(env, tag, system, locale, words);
  await withSync(env, tag, system, locale, words);
  await refused(env, tag, system, locale, words);
  await slow(env, tag, system, locale, words);
  await others(env, tag, system, locale, words);
  await silent(env, tag, system, locale);
}
