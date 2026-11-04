// Le panneau « Permissions » et son mot dans le pied de l'explorateur sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; contrats 11.4 point 7).
// Le vrai panneau (js/rights-window.js) s'ouvre sur quatre états que le lecteur des droits aurait rendus (test/pages/explorateur.js, `window.__rights`) : rien posé avec un lien public qui ouvre une table
// protégée, Encadré partout structure fermée, des règles à la main, une personne qui n'est pas propriétaire. À chaque largeur de l'essai : le mot du pied (icône et mot ensemble, dans le pied, sans
// le faire déborder), le panneau tient dans la page, son titre et son bouton restent en place, seul le contenu défile, rien n'en sort, le clavier est sur « Fermer », Tab reste dedans, Échap le ferme et
// le clavier revient sur le mot du pied ; la vraie souris ouvre le panneau depuis le mot du pied et le ferme par « Fermer ».
import { createI18n } from '../js/i18n.js';
import { Run } from './corbeille-firefox.mjs';

// Ce que la page montre du panneau et du mot du pied.
function state() {
  const modal = document.querySelector('.mod.rt');
  const chip = document.querySelector('.rights-chip');
  const foot = document.querySelector('.ex-foot');
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const within = (node, box) => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); };
  const chipBox = chip ? chip.getBoundingClientRect() : null;
  const footBox = foot ? foot.getBoundingClientRect() : null;
  const out = { chip: chip ? { word: chip.dataset.word, text: text(chip), icon: Boolean(chip.querySelector('svg')), inFoot: chipBox.right <= footBox.right + 1 && chipBox.left >= footBox.left - 1, height: Math.round(chipBox.height), visible: chipBox.width > 0 } : null, footOverflow: foot ? foot.scrollWidth > foot.clientWidth + 1 : null, modal: null };
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
    for (const [kind, word, needs] of [['pas', 'pas', [t('rights.lead.pas'), t('rights.level.ouvert'), t('rights.link.protected', { n: 1, tables: 'FormPlus_Pub_3' })]],
      ['protege', 'protege', [t('rights.lead.protege'), t('rights.level.encadre'), t('rights.structure.closed')]], ['autre', 'autre', [t('rights.lead.autre'), t('rights.level.autre')]],
      ['proprietaire-seul', 'none', [t('rights.lead.ownerOnly'), t('rights.role.false'), t('rights.links.owner-only')]]]) {
      await run.reset();
      await page.run(name => { window.__rightsKind = name; window.__rightsState(name); }, kind);
      const chip = await expect(kind, 'le mot du pied devait dire l\'état, avec son icône, dans le pied, sans le faire déborder', s => s.chip && s.chip.word === word && s.chip.icon && s.chip.inFoot && !s.footOverflow && s.chip.visible);
      if (chip.chip && word !== 'none' && !chip.chip.text.includes(t(`rights.chip.${word}`))) run.note(kind, `le mot du pied devait être « ${t(`rights.chip.${word}`)} » (il dit « ${chip.chip.text} »)`);
      await run.clickSelector('.rights-chip');
      const open = await expect(kind, 'le panneau devait s\'ouvrir à la souris, le clavier sur « Fermer »', s => s.modal && s.modal.focus === 'rights-close');
      const body = open.modal ? open.modal.body : '';
      for (const part of [t('rights.title'), ...needs]) if (!body.includes(part) && !(open.modal && open.modal.title === part)) run.note(kind, `le panneau devait dire « ${part} » (il dit « ${String(body).slice(0, 160)} »)`);
      if (open.modal) {
        if (!open.modal.inPage) run.note(kind, 'le panneau devait tenir dans la page');
        if (!open.modal.sticky) run.note(kind, 'le titre et le bouton devaient rester en place (le titre au-dessus du contenu, le pied sous lui)');
        if (open.modal.outside.length) run.note(kind, `rien ne devait sortir du panneau (sort : ${open.modal.outside.join(', ')})`);
        if (kind === 'protege' && open.modal.level.some(level => level !== t('rights.level.encadre'))) run.note(kind, 'chaque table devait dire « Encadré »');
      }
      // Tab reste dans le panneau ; Échap le ferme et rend le clavier au mot du pied ; la souris le rouvre, « Fermer » le ferme.
      for (let i = 0; i < 3; i += 1) { await page.press('Tab'); const inside = await snap(); if (!inside.modal || !inside.modal.inside) run.note(kind, 'Tab devait rester dans le panneau'); }
      await page.press('Escape');
      await expect(kind, 'Échap devait fermer le panneau', s => s.modal === null);
      await run.clickSelector('.rights-chip');
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
