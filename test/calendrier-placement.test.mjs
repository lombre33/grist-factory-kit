import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placerSemaine, evenementsDuJour } from '../js/calendrier/noyau/placement.js';
import { joursDeSemaine } from '../js/calendrier/noyau/dates.js';
import { normaliser } from '../js/calendrier/noyau/evenements.js';

const semaine = joursDeSemaine('2026-11-02');   // lundi 2 au dimanche 8
const evenements = lignes => normaliser(lignes).evenements;
const resume = r => r.segments.map(s => [s.id, s.colDebut, s.colFin, s.piste]);

test('un événement d\'un jour tient dans sa colonne', () => {
  const r = placerSemaine(evenements([{ id: 1, debut: '2026-11-04' }]), semaine);
  assert.deepEqual(resume(r), [[1, 2, 2, 0]]);
  assert.deepEqual(r.caches, [0, 0, 0, 0, 0, 0, 0]);
});

test('un événement de plusieurs jours est une seule barre', () => {
  assert.deepEqual(resume(placerSemaine(evenements([{ id: 1, debut: '2026-11-03', fin: '2026-11-06' }]), semaine)), [[1, 1, 4, 0]]);
});

test('un événement hors de la semaine n\'y est pas, y compris le jour d\'avant et le jour d\'après', () => {
  const r = placerSemaine(evenements([{ id: 1, debut: '2026-11-01' }, { id: 2, debut: '2026-11-09' }, { id: 3, debut: '2026-10-01', fin: '2026-10-31' }]), semaine);
  assert.deepEqual(r.segments, []);
});

test('un événement à cheval sur deux semaines est coupé, avec ses marques de continuité', () => {
  const e = evenements([{ id: 1, debut: '2026-10-30', fin: '2026-11-04' }]);
  const avant = placerSemaine(e, joursDeSemaine('2026-10-26')).segments[0];
  const apres = placerSemaine(e, semaine).segments[0];
  assert.deepEqual([avant.colDebut, avant.colFin, avant.prolongeAvant, avant.prolongeApres], [4, 6, false, true]);
  assert.deepEqual([apres.colDebut, apres.colFin, apres.prolongeAvant, apres.prolongeApres], [0, 2, true, false]);
});

test('un événement qui couvre plus d\'une semaine remplit la semaine du milieu', () => {
  const s = placerSemaine(evenements([{ id: 1, debut: '2026-10-20', fin: '2026-11-20' }]), semaine).segments[0];
  assert.deepEqual([s.colDebut, s.colFin, s.prolongeAvant, s.prolongeApres], [0, 6, true, true]);
});

test('les pistes : deux événements qui se chevauchent sont l\'un sous l\'autre, sinon sur la même piste', () => {
  const r = placerSemaine(evenements([
    { id: 'a', debut: '2026-11-02', fin: '2026-11-04' }, { id: 'b', debut: '2026-11-03', fin: '2026-11-03' }, { id: 'c', debut: '2026-11-05', fin: '2026-11-06' },
  ]), semaine);
  assert.deepEqual(resume(r), [['a', 0, 2, 0], ['b', 1, 1, 1], ['c', 3, 4, 0]]);
});

test('l\'ordre est stable : les barres qui continuent d\'abord, puis les plus longues, puis l\'heure, le titre, l\'identifiant', () => {
  const r = placerSemaine(evenements([
    { id: 4, titre: 'B', debut: '2026-11-02' }, { id: 3, titre: 'A', debut: '2026-11-02' }, { id: 2, titre: 'Z', debut: '2026-11-02', fin: '2026-11-03' },
    { id: 1, titre: 'Z', debut: '2026-10-30', fin: '2026-11-02' }, { id: 5, titre: 'C', debut: '2026-11-02T08:00' },
  ]), semaine);
  assert.deepEqual(r.segments.map(s => s.id), [1, 2, 3, 4, 5]);
  const encore = placerSemaine(evenements([
    { id: 5, titre: 'C', debut: '2026-11-02T08:00' }, { id: 1, titre: 'Z', debut: '2026-10-30', fin: '2026-11-02' }, { id: 2, titre: 'Z', debut: '2026-11-02', fin: '2026-11-03' },
    { id: 3, titre: 'A', debut: '2026-11-02' }, { id: 4, titre: 'B', debut: '2026-11-02' },
  ]), semaine);
  assert.deepEqual(encore.segments.map(s => [s.id, s.piste]), r.segments.map(s => [s.id, s.piste]));
});

test('maxPistes : ce qui dépasse est caché et compté dans « +n » pour chaque jour couvert', () => {
  const r = placerSemaine(evenements([
    { id: 1, titre: 'a', debut: '2026-11-03' }, { id: 2, titre: 'b', debut: '2026-11-03' }, { id: 3, titre: 'c', debut: '2026-11-03' },
    { id: 4, titre: 'd', debut: '2026-11-03', fin: '2026-11-05' }, { id: 5, titre: 'e', debut: '2026-11-08' },
  ]), semaine, { maxPistes: 2 });
  assert.deepEqual(r.segments.map(s => s.id), [4, 1, 5]);
  assert.deepEqual(r.caches, [0, 2, 0, 0, 0, 0, 0]);
  assert.equal(r.pistes, 2);
});

test('maxPistes : une barre de plusieurs jours cachée compte sur chacun de ses jours', () => {
  const r = placerSemaine(evenements([
    { id: 'x', debut: '2026-11-02', fin: '2026-11-06' }, { id: 'y', debut: '2026-11-02', fin: '2026-11-06' }, { id: 'z', debut: '2026-11-03', fin: '2026-11-04' },
  ]), semaine, { maxPistes: 2 });
  assert.deepEqual(r.segments.map(s => s.id), ['x', 'y']);
  assert.deepEqual(r.caches, [0, 1, 1, 0, 0, 0, 0]);
});

test('maxPistes : sans dépassement, rien n\'est caché', () => {
  const r = placerSemaine(evenements([{ id: 1, debut: '2026-11-03' }, { id: 2, debut: '2026-11-03' }]), semaine, { maxPistes: 2 });
  assert.equal(r.segments.length, 2);
  assert.deepEqual(r.caches, [0, 0, 0, 0, 0, 0, 0]);
});

test('le plateau « Sans date » n\'est jamais placé', () => {
  const sansDate = normaliser([{ id: 1 }]).sansDate;
  assert.deepEqual(placerSemaine(sansDate, semaine).segments, []);
  assert.deepEqual(evenementsDuJour(sansDate, '2026-11-03'), []);
});

test('une semaine qui change d\'année et une semaine vide', () => {
  const fin = joursDeSemaine('2026-12-28');
  assert.deepEqual(resume(placerSemaine(evenements([{ id: 1, debut: '2026-12-31', fin: '2027-01-02' }]), fin)), [[1, 3, 5, 0]]);
  assert.deepEqual(placerSemaine([], semaine), { segments: [], caches: [0, 0, 0, 0, 0, 0, 0], pistes: 0 });
});

test('evenementsDuJour : les longs d\'abord, puis l\'heure, puis le titre', () => {
  const e = evenements([
    { id: 1, titre: 'b', debut: '2026-11-03' }, { id: 2, titre: 'a', debut: '2026-11-03T10:00' }, { id: 3, titre: 'z', debut: '2026-11-02', fin: '2026-11-04' },
    { id: 4, titre: 'c', debut: '2026-11-03T09:00' }, { id: 5, titre: 'x', debut: '2026-11-05' },
  ]);
  assert.deepEqual(evenementsDuJour(e, '2026-11-03').map(x => x.id), [3, 1, 4, 2]);
  assert.deepEqual(evenementsDuJour(e, '2026-11-02').map(x => x.id), [3]);
  assert.deepEqual(evenementsDuJour(e, '2026-11-06'), []);
});
