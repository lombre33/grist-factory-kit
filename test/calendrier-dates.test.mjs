import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  numeroDeJour, estJour, jourDepuisNumero, ajouterJours, ecartEnJours, jourLocal, aujourdhui, lireMoment, ecrireMoment, rangDansLaSemaine, debutDeSemaine,
  joursDeSemaine, semaineIso, semaineDeLaLigne, joursDuMois, premierDuMois, dernierDuMois, ajouterMois, grilleDuMois,
} from '../js/calendrier/noyau/dates.js';

test('numeroDeJour : le 1er janvier 1970 est le jour 0, les dates impossibles sont refusées', () => {
  assert.equal(numeroDeJour('1970-01-01'), 0);
  assert.equal(numeroDeJour('1970-01-02'), 1);
  assert.equal(numeroDeJour('1969-12-31'), -1);
  assert.equal(numeroDeJour('2024-02-29'), 19782);
  for (const faux of ['2023-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-1-1', '26-01-01', '2026-01-01T10:00', '', null, undefined, 20260101, {}]) {
    assert.equal(numeroDeJour(faux), null, String(faux));
    assert.equal(estJour(faux), false);
  }
  assert.equal(estJour('2100-02-28'), true);
  assert.equal(estJour('2100-02-29'), false);
  assert.equal(estJour('2000-02-29'), true);
});

test('jourDepuisNumero retrouve le jour de chaque numéro, de 1900 à 2100', () => {
  for (let n = numeroDeJour('1900-01-01'); n <= numeroDeJour('2100-12-31'); n += 1) assert.equal(numeroDeJour(jourDepuisNumero(n)), n);
  assert.equal(jourDepuisNumero(0), '1970-01-01');
  assert.equal(jourDepuisNumero(-1), '1969-12-31');
});

test('ajouterJours et ecartEnJours : fins de mois, d\'année et années bissextiles', () => {
  assert.equal(ajouterJours('2026-01-31', 1), '2026-02-01');
  assert.equal(ajouterJours('2024-02-28', 1), '2024-02-29');
  assert.equal(ajouterJours('2023-02-28', 1), '2023-03-01');
  assert.equal(ajouterJours('2026-12-31', 1), '2027-01-01');
  assert.equal(ajouterJours('2027-01-01', -1), '2026-12-31');
  assert.equal(ajouterJours('2026-11-03', 0), '2026-11-03');
  assert.equal(ecartEnJours('2026-11-03', '2026-11-10'), 7);
  assert.equal(ecartEnJours('2026-11-10', '2026-11-03'), -7);
  assert.equal(ecartEnJours('2024-01-01', '2025-01-01'), 366);
});

test('un changement d\'heure ne décale jamais un jour (printemps et automne, Europe et États-Unis)', () => {
  for (const [avant, apres] of [['2026-03-28', '2026-03-29'], ['2026-03-29', '2026-03-30'], ['2026-10-24', '2026-10-25'], ['2026-10-25', '2026-10-26'], ['2026-03-07', '2026-03-08'], ['2026-11-01', '2026-11-02']]) {
    assert.equal(ajouterJours(avant, 1), apres);
    assert.equal(ecartEnJours(avant, apres), 1);
  }
  assert.equal(ecartEnJours('2026-03-01', '2026-04-01'), 31);
});

test('jourLocal lit l\'heure locale de la personne, pas l\'UTC', () => {
  assert.equal(jourLocal(new Date(2026, 10, 3, 23, 59, 59)), '2026-11-03');
  assert.equal(jourLocal(new Date(2026, 10, 3, 0, 0, 1)), '2026-11-03');
  assert.equal(jourLocal(new Date(2026, 0, 1)), '2026-01-01');
});

test('aujourdhui : une date, une horloge injectée, ou l\'horloge du navigateur', () => {
  assert.equal(aujourdhui(new Date(2026, 10, 3, 12)), '2026-11-03');
  assert.equal(aujourdhui(() => new Date(2027, 1, 28, 8)), '2027-02-28');
  assert.match(aujourdhui(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(aujourdhui('n\'importe quoi'), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(aujourdhui(undefined), jourLocal(new Date()));
});

test('lireMoment et ecrireMoment : un jour, ou un jour avec une heure', () => {
  assert.deepEqual(lireMoment('2026-11-03'), { jour: '2026-11-03', heure: null });
  assert.deepEqual(lireMoment('2026-11-03T09:30'), { jour: '2026-11-03', heure: '09:30' });
  assert.deepEqual(lireMoment('2026-11-03T23:59'), { jour: '2026-11-03', heure: '23:59' });
  for (const faux of ['2026-11-03T24:00', '2026-11-03T09:60', '2026-11-03T9:00', '2026-02-30', '2026-11-03T09:30:00', '2026-11-03 09:30', '', null, 5]) assert.equal(lireMoment(faux), null, String(faux));
  assert.equal(ecrireMoment('2026-11-03', null), '2026-11-03');
  assert.equal(ecrireMoment('2026-11-03', '09:30'), '2026-11-03T09:30');
});

test('rangDansLaSemaine : le lundi est le premier jour par défaut', () => {
  assert.equal(rangDansLaSemaine('2026-11-02'), 0);
  assert.equal(rangDansLaSemaine('2026-11-03'), 1);
  assert.equal(rangDansLaSemaine('2026-11-08'), 6);
  assert.equal(rangDansLaSemaine('2026-11-01'), 6);
  assert.equal(rangDansLaSemaine('1970-01-01'), 3);
  assert.equal(rangDansLaSemaine('1969-12-28'), 6);
});

test('rangDansLaSemaine : avec le dimanche ou le samedi pour premier jour', () => {
  assert.equal(rangDansLaSemaine('2026-11-01', 0), 0);
  assert.equal(rangDansLaSemaine('2026-11-02', 0), 1);
  assert.equal(rangDansLaSemaine('2026-11-07', 0), 6);
  assert.equal(rangDansLaSemaine('2026-10-31', 6), 0);
  assert.equal(rangDansLaSemaine('2026-11-02', 6), 2);
});

test('debutDeSemaine et joursDeSemaine', () => {
  assert.equal(debutDeSemaine('2026-11-04'), '2026-11-02');
  assert.equal(debutDeSemaine('2026-11-02'), '2026-11-02');
  assert.equal(debutDeSemaine('2026-11-08'), '2026-11-02');
  assert.equal(debutDeSemaine('2026-11-04', 0), '2026-11-01');
  assert.deepEqual(joursDeSemaine('2026-11-04'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.equal(joursDeSemaine('2026-12-30')[6], '2027-01-03');
});

test('semaineIso : les bornes de l\'année (S1 dès le 29 décembre, S52 ou S53 en janvier)', () => {
  const cas = [
    ['2026-11-02', 2026, 45], ['2026-01-01', 2026, 1], ['2025-12-29', 2026, 1], ['2025-12-28', 2025, 52], ['2026-12-31', 2026, 53], ['2027-01-03', 2026, 53],
    ['2027-01-04', 2027, 1], ['2020-12-31', 2020, 53], ['2021-01-03', 2020, 53], ['2021-01-04', 2021, 1], ['2024-12-30', 2025, 1], ['2024-12-29', 2024, 52],
    ['2016-01-03', 2015, 53], ['2016-01-04', 2016, 1], ['2024-02-29', 2024, 9], ['2023-01-01', 2022, 52], ['2023-01-02', 2023, 1], ['2018-12-31', 2019, 1],
  ];
  for (const [jour, annee, semaine] of cas) assert.deepEqual(semaineIso(jour), { annee, semaine }, jour);
});

test('semaineIso : sept jours d\'une semaine ont le même numéro, et la semaine 1 contient le 4 janvier (2000 à 2040)', () => {
  let precedent = null;
  for (let lundi = '1999-12-27'; lundi < '2040-12-31'; lundi = ajouterJours(lundi, 7)) {
    const numeros = joursDeSemaine(lundi).map(semaineIso);
    for (const numero of numeros) assert.deepEqual(numero, numeros[0], lundi);
    if (precedent) {
      const suite = numeros[0].semaine === 1 ? [52, 53].includes(precedent.semaine) : numeros[0].semaine === precedent.semaine + 1;
      assert.ok(suite, `${lundi} : ${precedent.semaine} puis ${numeros[0].semaine}`);
    }
    if (numeros[0].semaine === 1) assert.ok(joursDeSemaine(lundi).includes(`${numeros[0].annee}-01-04`), lundi);
    precedent = numeros[0];
  }
});

test('semaineDeLaLigne : le jeudi de la ligne décide, quel que soit le premier jour', () => {
  assert.equal(semaineDeLaLigne(joursDeSemaine('2026-11-02')), 45);
  assert.equal(semaineDeLaLigne(joursDeSemaine('2026-11-01', 0)), 45);
  assert.equal(semaineDeLaLigne(joursDeSemaine('2025-12-29')), 1);
  assert.equal(semaineDeLaLigne(joursDeSemaine('2025-12-28', 0)), 1);
  assert.equal(semaineDeLaLigne(joursDeSemaine('2026-12-28')), 53);
});

test('longueur des mois, premier et dernier jour', () => {
  assert.equal(joursDuMois(2026, 2), 28);
  assert.equal(joursDuMois(2024, 2), 29);
  assert.equal(joursDuMois(2100, 2), 28);
  assert.equal(joursDuMois(2000, 2), 29);
  assert.equal(joursDuMois(2026, 4), 30);
  assert.equal(joursDuMois(2026, 12), 31);
  assert.equal(premierDuMois('2026-11-17'), '2026-11-01');
  assert.equal(dernierDuMois('2026-11-17'), '2026-11-30');
  assert.equal(dernierDuMois('2024-02-10'), '2024-02-29');
  assert.equal(dernierDuMois('2026-12-01'), '2026-12-31');
});

test('ajouterMois : le quantième est ramené au dernier jour du mois d\'arrivée', () => {
  const cas = [
    ['2026-01-31', 1, '2026-02-28'], ['2024-01-31', 1, '2024-02-29'], ['2026-12-15', 1, '2027-01-15'], ['2026-01-15', -1, '2025-12-15'], ['2026-03-31', -1, '2026-02-28'],
    ['2026-05-31', 1, '2026-06-30'], ['2026-11-03', 12, '2027-11-03'], ['2026-11-03', -13, '2025-10-03'], ['2026-11-03', 0, '2026-11-03'], ['2024-02-29', 12, '2025-02-28'],
  ];
  for (const [jour, n, attendu] of cas) assert.equal(ajouterMois(jour, n), attendu, `${jour} ${n}`);
});

test('grilleDuMois : 4, 5 ou 6 lignes de sept jours qui se suivent et couvrent le mois', () => {
  const lignes = (jour, premier) => grilleDuMois(jour, premier).length;
  assert.equal(lignes('2027-02-10'), 4);
  assert.equal(lignes('2026-02-10'), 5);
  assert.equal(lignes('2026-04-10'), 5);
  assert.equal(lignes('2026-03-10'), 6);
  assert.equal(lignes('2026-11-10'), 6);
  assert.equal(lignes('2026-11-10', 0), 5);
  assert.equal(lignes('2024-02-10'), 5);
  const grille = grilleDuMois('2026-11-10');
  assert.equal(grille[0][0].jour, '2026-10-26');
  assert.equal(grille[0][0].dansLeMois, false);
  assert.equal(grille[0][6].jour, '2026-11-01');
  assert.equal(grille[0][6].dansLeMois, true);
  assert.equal(grille[5][0].jour, '2026-11-30');
  assert.equal(grille[5][6].jour, '2026-12-06');
});

test('grilleDuMois : chaque mois de 2024 à 2028, pour les trois premiers jours de semaine possibles', () => {
  for (const premier of [0, 1, 6]) {
    for (let annee = 2024; annee <= 2028; annee += 1) {
      for (let mois = 1; mois <= 12; mois += 1) {
        const jour = `${annee}-${String(mois).padStart(2, '0')}-15`;
        const grille = grilleDuMois(jour, premier);
        const tous = grille.flat();
        assert.ok(grille.length >= 4 && grille.length <= 6, jour);
        assert.ok(grille.every(ligne => ligne.length === 7 && rangDansLaSemaine(ligne[0].jour, premier) === 0), jour);
        tous.forEach((cellule, i) => i && assert.equal(cellule.jour, ajouterJours(tous[i - 1].jour, 1)));
        assert.equal(tous.filter(c => c.dansLeMois).length, joursDuMois(annee, mois), jour);
        assert.equal(tous.find(c => c.dansLeMois).jour, premierDuMois(jour));
      }
    }
  }
});
