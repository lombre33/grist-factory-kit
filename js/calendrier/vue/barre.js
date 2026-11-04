// La barre du haut : précédent / suivant, le titre de la période, « Aujourd'hui », le choix de la vue, le plateau « Sans date ».
import { h } from '../lien-kit.js';
import { libelleJour, majuscule, titreDeSemaine, titreDuMois } from '../noyau/format.js';

function bouton(classe, texte, { aria, actif, desactive, titre, action, pressed }) {
  return h('button', {
    type: 'button', class: classe, 'aria-label': aria, title: titre, 'aria-pressed': pressed === undefined ? undefined : String(pressed),
    'aria-disabled': desactive ? 'true' : undefined, 'data-actif': actif ? '1' : undefined, on: { click: () => { if (!desactive) action(); } },
  }, texte);
}

function fleche(sens, ctx) {
  const precedent = sens < 0;
  return bouton('cal-fleche', h('span', { class: 'cal-pictogramme', 'aria-hidden': 'true' }, precedent ? '‹' : '›'), {
    aria: ctx.t(precedent ? 'cal.precedent' : 'cal.suivant'), action: () => ctx.naviguer(sens),
  });
}

function choixDeVue(ctx) {
  const vue = nom => bouton('cal-vue', ctx.t(`cal.${nom}`), { actif: ctx.etat.vue === nom, pressed: ctx.etat.vue === nom, action: () => ctx.changerVue(nom) });
  return h('div', { class: 'cal-vues', role: 'group', 'aria-label': ctx.t('cal.vues') }, vue('mois'), vue('semaine'), vue('jour'));
}

export function construireBarre(ctx, { jours }) {
  const titres = { semaine: () => titreDeSemaine(jours, ctx.langue), jour: () => majuscule(libelleJour(ctx.etat.jour, ctx.langue)), mois: () => titreDuMois(ctx.etat.jour, ctx.langue) };
  const titre = titres[ctx.etat.vue]();
  const nombre = ctx.modele.sansDate.length;
  return h('div', { class: 'cal-barre' },
    fleche(-1, ctx),
    h('h2', { class: 'cal-titre', 'aria-live': 'polite' }, titre),
    fleche(1, ctx),
    bouton('cal-aujourdhui', ctx.t('cal.aujourdhui'), { action: () => ctx.aller(ctx.aujourdhui()) }),
    h('span', { class: 'cal-ressort' }),
    choixDeVue(ctx),
    bouton('cal-plateau-bouton', [ctx.t('cal.sansDate'), h('span', { class: 'cal-compte' }, String(nombre))], {
      pressed: ctx.etat.plateau, desactive: nombre === 0, titre: nombre === 0 ? ctx.t('cal.sansDateVide') : ctx.t('cal.sansDateTitre'), action: () => ctx.basculerPlateau(),
    }),
  );
}
