import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enMinutes, enHeure, arrondir, blocDuJour, toutesLaJournee, blocsDuJour, deplacerHoraire, PAS } from '../js/calendrier/noyau/horaire.js';
import { normaliser } from '../js/calendrier/noyau/evenements.js';

const evenements = lignes => normaliser(lignes).evenements;
const un = ligne => evenements([ligne])[0];

test('minutes et heures : aller et retour sur les 1440 minutes d\'une journée', () => {
  assert.equal(enMinutes('00:00'), 0);
  assert.equal(enMinutes('09:30'), 570);
  assert.equal(enMinutes('23:59'), 1439);
  assert.equal(enHeure(0), '00:00');
  assert.equal(enHeure(570), '09:30');
  assert.equal(enHeure(1439), '23:59');
  for (let m = 0; m < 1440; m += 1) assert.equal(enMinutes(enHeure(m)), m);
});

test('arrondir : au quart d\'heure le plus proche, vers le haut à la moitié', () => {
  assert.equal(PAS, 15);
  assert.deepEqual([0, 6, 7, 8, 14, 15, 22, 23, 37].map(m => arrondir(m)), [0, 0, 0, 15, 15, 15, 15, 30, 30]);
  assert.equal(arrondir(-8), -15);
  assert.equal(arrondir(100, 30), 90);
});

test('blocDuJour : début et fin dans le jour', () => {
  assert.deepEqual(blocDuJour(un({ id: 1, debut: '2026-11-03T09:30', fin: '2026-11-03T11:00' }), '2026-11-03'), { debut: 570, fin: 660, evenement: un({ id: 1, debut: '2026-11-03T09:30', fin: '2026-11-03T11:00' }) });
});

test('blocDuJour : sans fin, une heure ; jamais moins d\'un pas ; jamais hors de la journée', () => {
  assert.equal(blocDuJour(un({ id: 1, debut: '2026-11-03T09:30' }), '2026-11-03').fin, 630);
  assert.equal(blocDuJour(un({ id: 1, debut: '2026-11-03T23:30' }), '2026-11-03').fin, 1440);
  const court = blocDuJour(un({ id: 1, debut: '2026-11-03T09:00', fin: '2026-11-03T09:05' }), '2026-11-03');
  assert.equal(court.fin - court.debut, PAS);
  const nul = blocDuJour(un({ id: 1, debut: '2026-11-03T09:00', fin: '2026-11-03T09:00' }), '2026-11-03');
  assert.equal(nul.fin - nul.debut, 60);
});

test('blocDuJour : un événement sur plusieurs jours est un bloc de la journée entière entre les deux', () => {
  const e = un({ id: 1, debut: '2026-11-03T18:00', fin: '2026-11-05T10:00' });
  assert.deepEqual([blocDuJour(e, '2026-11-03').debut, blocDuJour(e, '2026-11-03').fin], [1080, 1440]);
  assert.deepEqual([blocDuJour(e, '2026-11-04').debut, blocDuJour(e, '2026-11-04').fin], [0, 1440]);
  assert.deepEqual([blocDuJour(e, '2026-11-05').debut, blocDuJour(e, '2026-11-05').fin], [0, 600]);
  assert.equal(blocDuJour(e, '2026-11-02'), null);
  assert.equal(blocDuJour(e, '2026-11-06'), null);
});

test('blocDuJour : une fin sans heure sur un autre jour couvre ce jour entier', () => {
  const e = un({ id: 1, debut: '2026-11-03T09:00', fin: '2026-11-05' });
  assert.deepEqual([blocDuJour(e, '2026-11-05').debut, blocDuJour(e, '2026-11-05').fin], [0, 1440]);
});

test('blocDuJour : pas de bloc pour un jour entier ni pour une ligne sans date', () => {
  assert.equal(blocDuJour(un({ id: 1, debut: '2026-11-03' }), '2026-11-03'), null);
  assert.equal(blocDuJour(normaliser([{ id: 1 }]).sansDate[0], '2026-11-03'), null);
});

test('toutesLaJournee : les jours entiers du jour, y compris ceux qui durent plusieurs jours', () => {
  const e = evenements([{ id: 1, debut: '2026-11-03' }, { id: 2, debut: '2026-11-02', fin: '2026-11-04' }, { id: 3, debut: '2026-11-03T10:00' }, { id: 4, debut: '2026-11-05' }]);
  assert.deepEqual(toutesLaJournee(e, '2026-11-03').map(x => x.id), [1, 2]);
});

test('blocsDuJour : des blocs qui ne se touchent pas ont chacun toute la largeur', () => {
  const blocs = blocsDuJour(evenements([{ id: 1, debut: '2026-11-03T09:00', fin: '2026-11-03T10:00' }, { id: 2, debut: '2026-11-03T10:00', fin: '2026-11-03T11:00' }]), '2026-11-03');
  assert.deepEqual(blocs.map(b => [b.id, b.colonne, b.colonnes]), [[1, 0, 1], [2, 0, 1]]);
});

test('blocsDuJour : deux blocs qui se chevauchent se partagent la largeur', () => {
  const blocs = blocsDuJour(evenements([{ id: 1, debut: '2026-11-03T09:00', fin: '2026-11-03T11:00' }, { id: 2, debut: '2026-11-03T10:00', fin: '2026-11-03T12:00' }]), '2026-11-03');
  assert.deepEqual(blocs.map(b => [b.id, b.colonne, b.colonnes]), [[1, 0, 2], [2, 1, 2]]);
});

test('blocsDuJour : un bloc libère sa colonne dès qu\'il finit, le groupe garde son nombre de colonnes', () => {
  const blocs = blocsDuJour(evenements([
    { id: 'a', debut: '2026-11-03T09:00', fin: '2026-11-03T12:00' }, { id: 'b', debut: '2026-11-03T09:30', fin: '2026-11-03T10:30' }, { id: 'c', debut: '2026-11-03T10:30', fin: '2026-11-03T11:30' },
    { id: 'd', debut: '2026-11-03T14:00', fin: '2026-11-03T15:00' },
  ]), '2026-11-03');
  assert.deepEqual(blocs.map(b => [b.id, b.colonne, b.colonnes]), [['a', 0, 2], ['b', 1, 2], ['c', 1, 2], ['d', 0, 1]]);
});

test('blocsDuJour : trois blocs en même temps, ordre stable (début, plus long, titre, identifiant)', () => {
  const lignes = [
    { id: 3, titre: 'C', debut: '2026-11-03T09:00', fin: '2026-11-03T10:00' }, { id: 1, titre: 'A', debut: '2026-11-03T09:00', fin: '2026-11-03T10:00' },
    { id: 2, titre: 'B', debut: '2026-11-03T09:00', fin: '2026-11-03T11:00' },
  ];
  const lu = blocsDuJour(evenements(lignes), '2026-11-03').map(b => [b.id, b.colonne, b.colonnes]);
  assert.deepEqual(lu, [[2, 0, 3], [1, 1, 3], [3, 2, 3]]);
  assert.deepEqual(blocsDuJour(evenements([...lignes].reverse()), '2026-11-03').map(b => [b.id, b.colonne, b.colonnes]), lu);
});

test('blocsDuJour : un jour vide, des jours entiers seulement', () => {
  assert.deepEqual(blocsDuJour([], '2026-11-03'), []);
  assert.deepEqual(blocsDuJour(evenements([{ id: 1, debut: '2026-11-03' }]), '2026-11-03'), []);
});

const e = ligne => un(ligne);
const saisi = (jour, minute) => ({ jour, minute });

test('deplacerHoraire : le même jour, plus tard ; la durée est gardée, au quart d\'heure', () => {
  const evt = e({ id: 1, debut: '2026-11-03T09:00', fin: '2026-11-03T10:30' });
  assert.deepEqual(deplacerHoraire(evt, saisi('2026-11-03', 540), saisi('2026-11-03', 600)), { id: 1, debut: '2026-11-03T10:00', fin: '2026-11-03T11:30' });
  assert.deepEqual(deplacerHoraire(evt, saisi('2026-11-03', 545), saisi('2026-11-03', 607)), { id: 1, debut: '2026-11-03T10:00', fin: '2026-11-03T11:30' });
  assert.equal(deplacerHoraire(evt, saisi('2026-11-03', 545), saisi('2026-11-03', 551)), null);
});

test('deplacerHoraire : un autre jour, et à cheval sur minuit', () => {
  const evt = e({ id: 1, debut: '2026-11-03T22:00', fin: '2026-11-03T23:00' });
  assert.deepEqual(deplacerHoraire(evt, saisi('2026-11-03', 1320), saisi('2026-11-04', 1320)), { id: 1, debut: '2026-11-04T22:00', fin: '2026-11-04T23:00' });
  assert.deepEqual(deplacerHoraire(evt, saisi('2026-11-03', 1320), saisi('2026-11-03', 1380)), { id: 1, debut: '2026-11-03T23:00', fin: '2026-11-04T00:00' });
  assert.deepEqual(deplacerHoraire(evt, saisi('2026-11-03', 1320), saisi('2026-11-03', 0)), { id: 1, debut: '2026-11-03T00:00', fin: '2026-11-03T01:00' });
});

test('deplacerHoraire : fin de mois et d\'année, jours d\'écart et heure d\'écart ensemble', () => {
  const evt = e({ id: 1, debut: '2026-12-31T23:00', fin: '2027-01-01T01:00' });
  assert.deepEqual(deplacerHoraire(evt, saisi('2026-12-31', 1380), saisi('2027-01-02', 1320)), { id: 1, debut: '2027-01-02T22:00', fin: '2027-01-03T00:00' });
});

test('deplacerHoraire : sans fin, une heure de durée est écrite ; sans heure ou sans date, l\'heure déposée est donnée', () => {
  assert.deepEqual(deplacerHoraire(e({ id: 1, debut: '2026-11-03T09:00' }), saisi('2026-11-03', 540), saisi('2026-11-03', 600)), { id: 1, debut: '2026-11-03T10:00', fin: '2026-11-03T11:00' });
  assert.deepEqual(deplacerHoraire(e({ id: 2, debut: '2026-11-03' }), saisi('2026-11-03', 0), saisi('2026-11-05', 487)), { id: 2, debut: '2026-11-05T08:00', fin: '2026-11-05T09:00' });
  assert.deepEqual(deplacerHoraire(normaliser([{ id: 3 }]).sansDate[0], saisi(null, 0), saisi('2026-11-05', 600)), { id: 3, debut: '2026-11-05T10:00', fin: '2026-11-05T11:00' });
});

test('deplacerHoraire : une ligne non modifiable ne bouge pas', () => {
  assert.equal(deplacerHoraire(e({ id: 1, debut: '2026-11-03T09:00', modifiable: false }), saisi('2026-11-03', 540), saisi('2026-11-03', 600)), null);
});
