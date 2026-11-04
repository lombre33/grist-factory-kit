// Le rendu du calendrier, en clair et en sombre, en français et en anglais, à 700 × 400 et à la vraie souris : la langue des textes, les fonds de la page et du calendrier (les jetons), le
// contraste de chaque texte tel que le navigateur le rend (4,5:1 au moins, sur les fonds empilés derrière lui), dans le mois, la liste d'un jour, la saisie rapide, la semaine et le jour.
// Les couleurs d'un événement que Grist colore sont une donnée de la personne : elles ne sont pas mesurées ici (elles sont vérifiées par les essais de gestes).
import { join } from 'node:path';
import { check, click, visibleTexts } from './aide.mjs';
import { light, dark, cssRgb, ratio } from '../test/jetons.mjs';
import { HEURES, LIGNES, ouvrirCalendrier } from './scenarios-calendrier-gestes.mjs';

const MOTS = {
  fr: { titre: 'Novembre 2026', jours: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], semaine: 'S44', aujourdhui: 'Aujourd\'hui', sansDate: 'Sans date', mois: 'Mois', ecartee: 'Une tâche écartée', titreJour: 'Mardi 3 novembre 2026', listeJour: 'Tâches du', jourListe: 'Vendredi 13 novembre 2026' },
  en: { titre: 'November 2026', jours: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], semaine: 'W44', aujourdhui: 'Today', sansDate: 'No date', mois: 'Month', ecartee: 'One task left out', titreJour: 'Tuesday, November 3, 2026', listeJour: 'Tasks of', jourListe: 'Friday, November 13, 2026' },
};
const PLEIN = ['.cal-titre', '.cal-fleche', '.cal-aujourdhui', '.cal-vue', '.cal-plateau-bouton', '.cal-compte', '.cal-nom', '.cal-sem', '.cal-num', '.cal-evt:not([data-id="1"])', '.cal-plus', '.cal-avis',
  '.cal-plateau-aide', '.cal-puce'];
const HORAIRE = ['.cal-titre', '.cal-vue', '.cal-nom', '.cal-sem', '.cal-num', '.cal-etiquette', '.cal-bloc', '.cal-evt', '.cal-heure'];
const shot = (env, page, system, lang, name) => page.screenshot({ path: join(env.shots, `calendrier-${name}-${system === 'dark' ? 'sombre' : 'clair'}-${lang}.png`) });

// Le contraste de chaque texte visible qui répond à `selectors` : la liste de ceux qui tiennent moins de 4,5:1, et combien ont été mesurés (un essai qui ne mesure rien ne prouve rien).
async function contrastes(page, selectors) {
  const lus = await visibleTexts(page, selectors);
  const trop = lus.map(lu => ({ ...lu, rapport: Number(ratio(lu.color, lu.background).toFixed(2)) })).filter(lu => lu.rapport < 4.5);
  return { mesures: lus.length, trop };
}

async function mois(env, page, tag, lang, system) {
  const mots = MOTS[lang];
  const jetons = system === 'dark' ? dark : light;
  const texte = selecteur => page.locator(selecteur).allInnerTexts();
  check(`[${tag}] le titre du mois et les noms des jours suivent la langue : ${mots.titre}`, (await page.locator('.cal-titre').innerText()) === mots.titre && (await texte('.cal-nom')).join() === mots.jours.join(), await texte('.cal-nom'));
  check(`[${tag}] le numéro de semaine, « ${mots.aujourdhui} » et « ${mots.sansDate} » aussi`, (await texte('.cal-corps .cal-sem'))[0] === mots.semaine && (await texte('.cal-aujourdhui'))[0] === mots.aujourdhui
    && (await page.locator('.cal-plateau-bouton').evaluate(b => b.firstChild.textContent)) === mots.sansDate, await texte('.cal-corps .cal-sem'));
  check(`[${tag}] l'avis dit la tâche écartée dans la langue de la page`, (await page.locator('.cal-avis').innerText()).startsWith(mots.ecartee), await page.locator('.cal-avis').innerText());
  check(`[${tag}] le fond de la page est --bg et celui du calendrier --surface`, (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === cssRgb(jetons['--bg'])
    && (await page.locator('.cal').evaluate(el => getComputedStyle(el).backgroundColor)) === cssRgb(jetons['--surface']));
  await click(page, '.cal-plateau-bouton');
  await page.waitForSelector('.cal-plateau');
  const { mesures, trop } = await contrastes(page, PLEIN);
  check(`[${tag}] contraste des textes du mois, du plateau et de la barre : 4,5:1 au moins (${mesures} textes mesurés)`, mesures >= 40 && trop.length === 0, trop.length ? trop : `${mesures} mesurés`);
  await shot(env, page, system, lang, 'mois');
}

async function listeEtSaisie(env, page, tag, lang, system) {
  await click(page, '.cal-plus');
  await page.waitForSelector('.cal-liste');
  const liste = await contrastes(page, ['.cal-liste-titre', '.cal-liste-ligne', '.cal-liste-fermer']);
  check(`[${tag}] la liste du jour : « ${MOTS[lang].jourListe} », nommée « ${MOTS[lang].listeJour} … », trois tâches, 4,5:1 au moins (${liste.mesures} mesurés)`, (await page.locator('.cal-liste-titre').evaluate(el => el.firstChild.textContent)) === MOTS[lang].jourListe
    && (await page.locator('.cal-liste').getAttribute('aria-label')).startsWith(MOTS[lang].listeJour) && (await page.locator('.cal-liste-ligne').count()) === 3 && liste.mesures >= 4 && liste.trop.length === 0,
  liste.trop.length ? liste.trop : await page.locator('.cal-liste-titre').evaluate(el => el.firstChild.textContent));
  await shot(env, page, system, lang, 'liste');
  await page.keyboard.press('Escape');
  await click(page, '.cal-num[data-jour="2026-11-17"]');
  await page.keyboard.type('Rappeler');
  const saisie = await contrastes(page, ['.cal-saisie-champ']);
  check(`[${tag}] la saisie rapide s'ouvre sur le jour et son texte tient 4,5:1 (${saisie.mesures} mesuré)`, saisie.mesures === 1 && saisie.trop.length === 0, saisie.trop);
  await page.keyboard.press('Escape');
}

async function semaineOuJour(env, page, tag, lang, system, vue) {
  const bouton = page.locator('.cal-vue').nth(vue === 'semaine' ? 1 : 2);
  await bouton.click();
  await page.waitForSelector(`.cal-vue-${vue}`);
  const colonnes = await page.locator('.cal-colonne').count();
  const { mesures, trop } = await contrastes(page, HORAIRE);
  check(`[${tag}] vue ${vue} : ${vue === 'semaine' ? 'sept colonnes' : 'une colonne'}, les heures et les blocs tiennent 4,5:1 (${mesures} textes mesurés)`, colonnes === (vue === 'semaine' ? 7 : 1)
    && mesures >= 8 && trop.length === 0, trop.length ? trop : { colonnes, mesures });
  if (vue === 'jour') check(`[${tag}] le titre de la vue Jour est le jour en toutes lettres`, (await page.locator('.cal-titre').innerText()).replace(/,/g, '') === MOTS[lang].titreJour.replace(/,/g, ''), await page.locator('.cal-titre').innerText());
  await shot(env, page, system, lang, vue);
}

export async function rendu(env, system, locale) {
  const lang = locale.startsWith('fr') ? 'fr' : 'en';
  const tag = `${system === 'dark' ? 'sombre' : 'clair'} ${lang}`;
  const ouvertes = [];
  const base = { colorScheme: system, locale };
  const page = await ouvrirCalendrier(env, ouvertes, { ...base, lignes: LIGNES });
  await mois(env, page, tag, lang, system);
  const liste = await ouvrirCalendrier(env, ouvertes, { ...base, lignes: LIGNES });
  await listeEtSaisie(env, liste, tag, lang, system);
  for (const vue of ['semaine', 'jour']) {
    const horaire = await ouvrirCalendrier(env, ouvertes, { ...base, lignes: HEURES });
    await semaineOuJour(env, horaire, tag, lang, system, vue);
  }
  check(`[${tag}] aucune erreur ni avertissement de console dans les quatre vues`, ouvertes.every(ouverte => (ouverte.erreurs || []).length === 0), ouvertes.map(ouverte => ouverte.erreurs));
  for (const ouverte of ouvertes) await ouverte.context().close();
}
