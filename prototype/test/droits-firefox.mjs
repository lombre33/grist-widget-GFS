// Le panneau « Permissions » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; contrats 11.4 point 7). Depuis le 12/11 la pastille du pied n'existe
// plus (choix du porteur) : le panneau n'a plus de porte dans l'explorateur, l'essai l'ouvre par la page d'essai (`window.__rights`). Le vrai panneau (js/rights/rights-window.js) s'ouvre sur quatre états que le
// lecteur des droits aurait rendus (test/pages/explorateur.js) : rien posé avec un lien public qui ouvre une table protégée, Encadré partout structure fermée, des règles à la main, une personne qui n'est pas
// propriétaire. À chaque largeur de l'essai : le panneau tient dans la page, son titre et son bouton restent en place, seul le contenu défile, rien n'en sort, le clavier est sur « Fermer », Tab reste dedans,
// Échap le ferme ; le pied de l'explorateur ne porte plus de pastille et ne déborde pas.
import { createI18n } from '../js/i18n/i18n.js';
import { Run, delay } from './corbeille-firefox.mjs';

// Ce que la page montre du panneau et du pied (qui ne porte plus de pastille).

function state() {
  const modal = document.querySelector('.mod.rt');
  const foot = document.querySelector('.ex-foot');
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const within = (node, box) => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); };
  const out = { chip: document.querySelector('.rights-chip') !== null, footOverflow: foot ? foot.scrollWidth > foot.clientWidth + 1 : null, modal: null };
  if (modal) {
    const box = modal.getBoundingClientRect();
    const head = modal.querySelector('.mod-head').getBoundingClientRect();
    const foot2 = modal.querySelector('.mod-foot').getBoundingClientRect();
    const body = modal.querySelector('.rt-body');
    const active = document.activeElement;
    out.modal = {
      title: text(modal.querySelector('.mod-head h2')), body: text(body), focus: active && active.dataset ? active.dataset.fk || null : null, inside: modal.contains(active),
      inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1,
      sticky: head.bottom <= foot2.top + 1 && foot2.bottom <= box.bottom + 1 && head.top >= box.top - 1,
      outside: [...modal.querySelectorAll('.rt-body *, .mod-foot *, .mod-head *')].filter(node => within(node, box)).map(node => node.className || node.tagName).slice(0, 5),
      scrolls: body.scrollHeight > body.clientHeight + 1, level: [...modal.querySelectorAll('.rt-level')].map(node => text(node)),
    };
  }
  return out;
}

export async function droitsProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'permissions');
  const snap = () => page.run(state);
  const expect = async (kind, what, test) => {
    let now = await snap();
    for (let i = 0; i < 40 && !test(now); i += 1) { await new Promise(resolve => setTimeout(resolve, 75)); now = await snap(); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify(now).slice(0, 500)})`);
    return now;
  };
  try {
    for (const [kind, , needs] of [['pas', 'pas', [t('rights.lead.pas'), t('rights.level.ouvert'), t('rights.link.protected', { n: 1, tables: 'FormPlus_Pub_3' }), t('rights.act.title'), t('rights.act.shared'), t('rights.act.close')]],
      ['protege', 'protege', [t('rights.lead.protege'), t('rights.level.encadre'), t('rights.structure.closed'), t('rights.act.remove'), t('rights.act.open')]], ['autre', 'autre', [t('rights.lead.autre'), t('rights.level.autre'), t('rights.act.why.foreign'), t('rights.act.why.already')]],
      ['proprietaire-seul', 'none', [t('rights.lead.ownerOnly'), t('rights.role.false'), t('rights.links.owner-only')]]]) {
      await run.reset();
      await page.run(name => { window.__rightsKind = name; }, kind);
      await expect(kind, 'le pied ne devait porter aucune pastille des droits ni déborder', s => !s.chip && !s.footOverflow);
      await page.run(name => { void window.__rights(name); }, kind);
      const open = await expect(kind, 'le panneau devait s\'ouvrir, le clavier sur « Fermer »', s => s.modal && s.modal.focus === 'rights-close');
      const body = open.modal ? open.modal.body : '';
      for (const part of [t('rights.title'), ...needs]) if (!body.includes(part) && !(open.modal && open.modal.title === part)) run.note(kind, `le panneau devait dire « ${part} » (il dit « ${String(body).slice(0, 160)} »)`);
      if (open.modal) {
        if (!open.modal.inPage) run.note(kind, 'le panneau devait tenir dans la page');
        if (!open.modal.sticky) run.note(kind, 'le titre et le bouton devaient rester en place (le titre au-dessus du contenu, le pied sous lui)');
        if (open.modal.outside.length) run.note(kind, `rien ne devait sortir du panneau (sort : ${open.modal.outside.join(', ')})`);
        if (kind === 'protege' && open.modal.level.some(level => level !== t('rights.level.encadre'))) run.note(kind, 'chaque table devait dire « Encadré »');
      }
      if (kind === 'proprietaire-seul' && body.includes(t('rights.act.title'))) run.note(kind, 'une personne qui n\'est pas propriétaire ne devait pas voir le bloc « Poser des règles »');
      if (kind === 'pas' || kind === 'autre') {
        const disabled = await page.run(() => [...document.querySelectorAll('.rt-act .btn:not([data-fk="rights-act-manage"])')].map(node => [node.dataset.fk, node.getAttribute('aria-disabled')]));
        const manage = await page.run(() => { const node = document.querySelector('[data-fk="rights-act-manage"]'); return node ? node.getAttribute('aria-disabled') : 'absent'; });
        if (manage !== null) run.note(kind, `« Gérer les partages… » devait être là et possible (état : ${manage})`);
        const wanted = kind === 'pas' ? [['rights-act-shared', null], ['rights-act-close', null], ['rights-act-sharing', null]] : [['rights-act-off', 'true'], ['rights-act-off', 'true'], ['rights-act-off', 'true']];
        if (JSON.stringify(disabled) !== JSON.stringify(wanted)) run.note(kind, `les trois gestes devaient être ${kind === 'pas' ? 'possibles' : 'grisés'} (ils sont : ${JSON.stringify(disabled)})`);
      }
      if (kind === 'pas') {
        // La vraie souris sur « Poser » : la question s'ouvre par-dessus le panneau, Échap la ferme sans fermer le panneau, et le geste a bien été demandé.
        await run.clickSelector('[data-fk="rights-act-shared"]');
        await expect(kind, 'la question devait s\'ouvrir par-dessus le panneau', s => s.modal !== null);
        const asked = await page.run(() => ({ acts: window.__rightsActs, ask: Boolean(document.querySelector('.mod.ask')) }));
        if (!asked.ask || JSON.stringify(asked.acts) !== '["shared"]') run.note(kind, `« Poser » devait ouvrir une question (reçu : ${JSON.stringify(asked)})`);
        await page.press('Escape');
        const after = await page.run(() => ({ ask: Boolean(document.querySelector('.mod.ask')), panel: Boolean(document.querySelector('.mod.rt')) }));
        if (after.ask || !after.panel) run.note(kind, `Échap devait fermer la question et laisser le panneau (état : ${JSON.stringify(after)})`);
        // « Gérer les partages… » prend la place du panneau (une seule fenêtre à lire, un seul voile) : le panneau est caché pendant qu'elle est ouverte, et revient avec le clavier sur le même bouton.
        await page.run(() => { document.querySelector('[data-fk="rights-act-manage"]').scrollIntoView({ block: 'center' }); });
        await run.clickSelector('[data-fk="rights-act-manage"]');
        await delay(200);
        const during = await page.run(() => ({ ask: Boolean(document.querySelector('.mod.ask')), panel: getComputedStyle(document.querySelector('.mod.rt').closest('.mod-scrim')).visibility }));
        if (!during.ask || during.panel !== 'hidden') run.note(kind, `« Gérer les partages… » devait cacher le panneau pendant que sa fenêtre est ouverte (état : ${JSON.stringify(during)})`);
        await page.press('Escape');
        let back = null;
        for (let i = 0; i < 40; i += 1) {
          back = await page.run(() => ({ panel: getComputedStyle(document.querySelector('.mod.rt').closest('.mod-scrim')).visibility, key: document.activeElement.dataset ? document.activeElement.dataset.fk || null : null }));
          if (back.panel === 'visible' && back.key === 'rights-act-manage') break;
          await delay(75);
        }
        if (back.panel !== 'visible' || back.key !== 'rights-act-manage') run.note(kind, `le panneau devait revenir à la fermeture, le clavier sur « Gérer les partages… » (état : ${JSON.stringify(back)})`);
      }
      // Tab reste dans le panneau ; Échap le ferme ; il se rouvre, « Fermer » le ferme à la souris.
      for (let i = 0; i < 3; i += 1) { await page.press('Tab'); const inside = await snap(); if (!inside.modal || !inside.modal.inside) run.note(kind, 'Tab devait rester dans le panneau'); }
      await page.press('Escape');
      await expect(kind, 'Échap devait fermer le panneau', s => s.modal === null);
      await page.run(name => { void window.__rights(name); }, kind);
      await expect(kind, 'le panneau devait se rouvrir', s => s.modal !== null);
      await run.clickSelector('[data-fk="rights-close"]');
      await expect(kind, '« Fermer » devait fermer le panneau', s => s.modal === null);
    }
  } catch (error) {
    run.note('geste impossible', String(error.message).slice(0, 200));
    await page.press('Escape').catch(() => {});
  }
  await run.reset();
  return found;
}
