// La fenêtre « Partager » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; contrats 11.7, point 13).
// La vraie fenêtre (js/share-window.js) s'ouvre par le vrai menu d'une ligne de l'explorateur (clic droit, puis « Partager… »), sur trois états que le contrôleur aurait lus (test/pages/explorateur.js,
// `window.__share`) : le partage n'est pas activé (une personne propriétaire), activé (propriétaire : adresse très longue, catégories, fin d'accès, accès échu, partage invalide), une personne qui ne
// peut rien changer. À chaque largeur de l'essai : la fenêtre tient dans la page, son titre et son bouton restent en place, seul le contenu défile, rien n'en sort, le clavier est sur « Terminé », Tab reste
// dedans, Échap la ferme ; sur l'état « activé », la vraie souris ouvre la liste du champ, choisit une catégorie, le formulaire se montre avec « Ajouter » sans défiler, et « Ajouter » demande bien d'écrire.
import { createI18n } from '../js/i18n.js';
import { Run } from './corbeille-firefox.mjs';

// Ce que la page montre de la fenêtre.
function state() {
  const modal = document.querySelector('.mod.sh');
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const out = { modal: null, acts: window.__shareActs || [] };
  if (!modal) return out;
  const box = modal.getBoundingClientRect();
  const head = modal.querySelector('.mod-head').getBoundingClientRect();
  const foot = modal.querySelector('.mod-foot').getBoundingClientRect();
  const body = modal.querySelector('.sh-body');
  const active = document.activeElement;
  const outside = node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); };
  const confirm = modal.querySelector('[data-fk="share-confirm"]');
  const confirmBox = confirm ? confirm.getBoundingClientRect() : null;
  out.modal = {
    title: text(modal.querySelector('.mod-head h2')), body: text(body), focus: active && active.dataset ? active.dataset.fk || null : null, inside: modal.contains(active),
    inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1,
    sticky: head.bottom <= foot.top + 1 && foot.bottom <= box.bottom + 1 && head.top >= box.top - 1,
    outside: [...modal.querySelectorAll('.sh-body *, .mod-foot *, .mod-head *')].filter(outside).map(node => node.className || node.tagName).slice(0, 5),
    add: Boolean(modal.querySelector('[data-fk="share-add"]')), activate: Boolean(modal.querySelector('[data-fk="share-activate"]')), readonly: Boolean(modal.querySelector('[data-fk="share-readonly"]')),
    options: [...modal.querySelectorAll('.drop .opt')].map(node => text(node)), rows: [...modal.querySelectorAll('.rr[data-share]')].length, form: Boolean(modal.querySelector('.sg-new')),
    confirmShown: confirmBox ? confirmBox.top >= head.bottom - 1 && confirmBox.bottom <= foot.top + 1 : null, locked: [...modal.querySelectorAll('.rr[data-share] .lvl[aria-disabled="true"]')].length,
  };
  return out;
}

// Le centre, à l'écran, d'un élément de la page par son sélecteur (le premier), ou d'un article de menu par son texte.
const centerOf = selector => { const node = document.querySelector(selector); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };
const rowCenter = () => { const row = [...document.querySelectorAll('.ls-row:not(.folder):not(.lk)')][0]; row.scrollIntoView({ block: 'nearest' }); const box = row.getBoundingClientRect(); return [box.left + Math.min(60, box.width / 2), box.top + box.height / 2]; };
const itemCenter = label => { const node = [...document.querySelectorAll('.menu .menu-item')].find(item => item.textContent.trim().startsWith(label)); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };

export async function partagerProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'partager');
  const snap = () => page.run(state);
  const expect = async (kind, what, test) => {
    let now = await snap();
    for (let i = 0; i < 40 && !test(now); i += 1) { await new Promise(resolve => setTimeout(resolve, 75)); now = await snap(); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify({ ...now, modal: now.modal && { ...now.modal, body: String(now.modal.body).slice(0, 80) } }).slice(0, 700)})`);
    return now;
  };
  try {
    for (const [kind, needs] of [['inactif', [t('share.inactive.owner'), t('share.inactive.activate')]], ['actif', [t('share.sec.access'), t('share.row.owners'), t('share.tag.expired'), t('share.tag.invalid'), t('share.row.download')]], ['lecture', [t('share.readonly'), t('share.row.owners')]]]) {
      await run.reset();
      await page.run(name => { window.__shareKind = name; }, kind);
      const at = await page.run(rowCenter);
      await page.rightClick(...at);
      const entry = await page.run(itemCenter, t('share.menu'));
      if (!entry) { run.note(kind, `le menu d'une ligne devait proposer « ${t('share.menu')} »`); continue; }
      await page.click(...entry);
      const open = await expect(kind, 'la fenêtre devait s\'ouvrir à la souris, le clavier sur « Terminé »', s => s.modal && s.modal.focus === 'share-close' && s.modal.body && !s.modal.body.includes(t('share.loading')));
      const body = open.modal ? open.modal.body : '';
      for (const part of needs) if (!body.includes(part)) run.note(kind, `la fenêtre devait dire « ${part} » (elle dit « ${String(body).slice(0, 160)} »)`);
      if (open.modal) {
        if (!open.modal.inPage) run.note(kind, 'la fenêtre devait tenir dans la page');
        if (!open.modal.sticky) run.note(kind, 'le titre et le bouton devaient rester en place');
        if (open.modal.outside.length) run.note(kind, `rien ne devait sortir de la fenêtre (sort : ${open.modal.outside.join(', ')})`);
        if (kind === 'inactif' && !(open.modal.activate && !open.modal.add)) run.note(kind, 'le propriétaire devait voir « Activer le partage… » et pas le champ d\'ajout');
        if (kind === 'lecture' && (open.modal.add || !open.modal.readonly)) run.note(kind, 'une personne qui ne peut rien changer ne devait voir ni le champ d\'ajout ni de geste');
        if (kind === 'actif' && (!open.modal.add || open.modal.rows !== 4)) run.note(kind, `le propriétaire devait voir le champ d'ajout et quatre lignes (il en voit ${open.modal.rows})`);
        if (kind === 'lecture' && open.modal.locked < 1) run.note(kind, 'les lignes devaient être grisées (cadenas) pour qui ne peut rien changer');
      }
      if (kind === 'actif') {
        // La vraie souris : la liste du champ, une catégorie, le formulaire (« Ajouter » visible sans défiler), puis « Ajouter » demande d'écrire.
        await run.clickSelector('[data-fk="share-add"]');
        const list = await expect(kind, 'le champ devait ouvrir la liste des personnes et des catégories', s => s.modal && s.modal.options.length >= 2);
        if (list.modal && !list.modal.options.some(label => label.includes(t('share.cat.editeurs')))) run.note(kind, `la liste devait proposer « ${t('share.cat.editeurs')} »`);
        const pick = await page.run(selector => { const node = document.querySelector(selector); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; }, '[data-fk="share-pick-@editeurs"]');
        if (!pick) run.note(kind, 'la liste devait proposer « les éditeurs »');
        else {
          await page.click(...pick);
          const form = await expect(kind, 'le formulaire devait se montrer avec « Ajouter » visible sans défiler, le clavier sur le droit', s => s.modal && s.modal.form && s.modal.confirmShown === true && s.modal.focus === 'share-new-level');
          if (form.modal && form.modal.form) {
            await run.clickSelector('[data-fk="share-confirm"]');
            await expect(kind, '« Ajouter » devait demander d\'écrire la ligne', s => JSON.stringify(s.acts) === '[["add","@editeurs","lecture"]]');
          }
        }
      }
      for (let i = 0; i < 3; i += 1) { await page.press('Tab'); const inside = await snap(); if (!inside.modal || !inside.modal.inside) run.note(kind, 'Tab devait rester dans la fenêtre'); }
      await page.press('Escape');
      await expect(kind, 'Échap devait fermer la fenêtre', s => s.modal === null);
    }
  } catch (error) {
    run.note('geste impossible', String(error.message).slice(0, 200));
    await page.press('Escape').catch(() => {});
  }
  await run.reset();
  return found;
}
