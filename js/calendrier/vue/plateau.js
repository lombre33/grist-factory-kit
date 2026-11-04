// Le plateau « Sans date » : les tâches à planifier, à glisser sur un jour.
import { h } from '../lien-kit.js';
import { rendreGlissable } from './glisser.js';

export function construirePlateau(ctx) {
  const peutGlisser = !ctx.lectureSeule;
  const puces = ctx.modele.sansDate.map(evenement => {
    const modifiable = peutGlisser && evenement.modifiable;
    const puce = h('div', {
      class: `cal-puce${modifiable ? '' : ' cal-grise'}`, role: 'button', tabindex: '0', title: modifiable ? undefined : ctx.t(peutGlisser ? 'cal.nonModifiable' : 'cal.lectureSeule'),
      'aria-disabled': modifiable ? undefined : 'true', dataset: { id: String(evenement.id) },
      on: { click: () => ctx.ouvrir(evenement.id), keydown: touche => { if (touche.key === 'Enter' || touche.key === ' ') { touche.preventDefault(); ctx.ouvrir(evenement.id); } } },
    }, evenement.titre || ctx.t('cal.sansTitre'));
    if (modifiable) rendreGlissable(puce, { id: evenement.id, jours: null, zone: null, glisse: ctx.glisse });
    ctx.appliquerCouleur(puce, evenement);
    return puce;
  });
  return h('aside', { class: 'cal-plateau', 'aria-label': ctx.t('cal.sansDateTitre') }, h('p', { class: 'cal-plateau-aide' }, ctx.t('cal.sansDateAide')), h('div', { class: 'cal-puces' }, puces));
}
