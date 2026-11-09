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
    note: text(modal.querySelector('.mod-note')), other: (() => { const node = modal.querySelector('.drop .opt[aria-disabled="true"]'); return node ? { text: text(node), icon: Boolean(node.querySelector('svg')), initials: Boolean(node.querySelector('.who')) } : null; })(),
    confirmShown: confirmBox ? confirmBox.top >= head.bottom - 1 && confirmBox.bottom <= foot.top + 1 : null, locked: [...modal.querySelectorAll('.rr[data-share] .lvl[aria-disabled="true"]')].length,
  };
  return out;
}

// Ce que la page montre de « Gérer les partages » (js/manage-window.js).
function manageState() {
  const modal = document.querySelector('.mod.mg');
  const out = { modal: null, acts: window.__manageActs || [], menu: [...document.querySelectorAll('.menu .menu-item')].map(node => node.textContent.replace(/\s+/g, ' ').trim()) };
  if (!modal) return out;
  const box = modal.getBoundingClientRect();
  const head = modal.querySelector('.mod-head').getBoundingClientRect();
  const foot = modal.querySelector('.mod-foot').getBoundingClientRect();
  const active = document.activeElement;
  const outside = node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); };
  out.modal = {
    body: modal.querySelector('.sh-body').textContent.replace(/\s+/g, ' ').trim(), focus: active && active.dataset ? active.dataset.fk || null : null, inside: modal.contains(active),
    inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1, sticky: head.bottom <= foot.top + 1 && foot.bottom <= box.bottom + 1 && head.top >= box.top - 1,
    outside: [...modal.querySelectorAll('.sh-body *, .mod-foot *, .mod-head *')].filter(outside).map(node => node.className || node.tagName).slice(0, 5),
    tabs: [...modal.querySelectorAll('.mg-tab')].map(node => [node.textContent, node.getAttribute('aria-selected')]), groups: [...modal.querySelectorAll('.rr[data-group]')].length, spaces: [...modal.querySelectorAll('.rr[data-space]')].length, spaceGroups: [...modal.querySelectorAll('.rr[data-space-group]')].length, form: Boolean(modal.querySelector('.sg-new')),
    greyed: [...modal.querySelectorAll('[aria-disabled="true"]')].map(node => node.dataset.fk || node.className),
  };
  return out;
}

// Le centre, à l'écran, d'un élément de la page par son sélecteur (le premier), ou d'un article de menu par son texte.
const centerOf = selector => { const node = document.querySelector(selector); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };
const rowCenter = () => { const row = [...document.querySelectorAll('.ls-row:not(.folder):not(.lk)')][0]; row.scrollIntoView({ block: 'nearest' }); const box = row.getBoundingClientRect(); return [box.left + Math.min(60, box.width / 2), box.top + box.height / 2]; };
const itemCenter = label => { const node = [...document.querySelectorAll('.menu .menu-item')].find(item => item.textContent.trim().startsWith(label)); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };

// « Gérer les partages… » depuis la fenêtre « Partager » : la vraie souris ouvre la fenêtre, passe d'un onglet à l'autre, crée un groupe, change le droit d'une catégorie ; Échap ne ferme que la fenêtre du dessus.
async function manageFlow(page, run, t) {
  const kind = 'gérer';
  const seen = async (what, test) => {
    let now = await page.run(manageState);
    for (let i = 0; i < 40 && !test(now); i += 1) { await new Promise(resolve => setTimeout(resolve, 75)); now = await page.run(manageState); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify({ ...now, modal: now.modal && { ...now.modal, body: String(now.modal.body).slice(0, 100) } }).slice(0, 600)})`);
    return now;
  };
  if (!(await run.clickSelector('[data-fk="share-manage"]'))) return;
  const open = await seen('« Gérer les partages… » devait ouvrir la fenêtre sur « Options », le clavier dedans', s => s.modal && s.modal.body.includes(t('manage.options.structure')) && s.modal.tabs.length === 4);
  if (!open.modal) return;
  if (!open.modal.inPage) run.note(kind, 'la fenêtre devait tenir dans la page');
  if (!open.modal.sticky) run.note(kind, 'le titre et le bouton devaient rester en place');
  if (open.modal.outside.length) run.note(kind, `rien ne devait sortir de la fenêtre (sort : ${open.modal.outside.join(', ')})`);
  if (!open.modal.inside) run.note(kind, 'le clavier devait être dans la fenêtre');
  await run.clickSelector('[data-fk="manage-structure"]');
  await seen('le bouton de la structure devait demander le geste', s => JSON.stringify(s.acts) === '[["structure"]]');
  await run.clickSelector('[data-fk="manage-tab-groups"]');
  const groups = await seen('l\'onglet Groupes devait lister les deux groupes', s => s.modal && s.modal.groups === 2 && s.modal.body.includes('Achats'));
  if (groups.modal && (groups.modal.outside.length || !groups.modal.inPage)) run.note(kind, `la liste des groupes (nom très long) devait tenir (sort : ${groups.modal.outside.join(', ')})`);
  if (groups.modal && groups.modal.body.includes(t('manage.groups.edit') + ' ' + t('manage.groups.remove')) === false && !groups.modal.body.includes(t('manage.groups.remove'))) run.note(kind, 'chaque groupe devait avoir « Supprimer »');
  await run.clickSelector('[data-fk="manage-group-new"]');
  await seen('« Nouveau groupe » devait montrer le formulaire, le clavier sur le nom', s => s.modal && s.modal.form && s.modal.focus === 'manage-group-name');
  await page.press(...'Ventes'.split(''));
  await run.clickSelector('[data-fk="manage-group-save"]');
  await seen('« Créer le groupe » devait demander d\'écrire le groupe', s => JSON.stringify(s.acts.slice(1)) === '[["addGroup","Ventes",""]]');
  await run.clickSelector('[data-fk="manage-tab-spaces"]');
  const spaces = await seen('l\'onglet Espaces devait lister les deux espaces', s => s.modal && s.modal.spaces === 2);
  if (spaces.modal && (spaces.modal.outside.length || !spaces.modal.inPage)) run.note(kind, `la liste des espaces (nom très long) devait tenir (sort : ${spaces.modal.outside.join(', ')})`);
  await run.clickSelector('[data-fk="manage-space-new"]');
  await seen('« Nouvel espace » devait demander de créer', s => s.acts.some(act => act[0] === 'addSpace'));
  await run.clickSelector('[data-fk="manage-space-achats"]');
  await seen('« Ouvrir » devait montrer les groupes de l\'espace', s => s.modal && s.modal.spaceGroups === 1 && s.modal.body.includes(t('manage.spaces.addGroup')));
  await run.clickSelector('[data-fk="manage-space-group-Achats"]');
  const roles = await seen('le rôle du groupe devait ouvrir son menu', s => s.menu.length >= 3);
  const role = await page.run(label => { const node = [...document.querySelectorAll('.menu .menu-item')].find(item => item.textContent.trim().startsWith(label)); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; }, t('share.right.ecriture'));
  if (role) { await page.click(...role); await seen('le choix devait demander d\'écrire le rôle du groupe', s => s.acts.some(act => act[0] === 'spaceGroup' && act[2] === 'Achats' && act[3] === 'ecriture')); }
  else if (roles.menu.length) run.note(kind, 'le menu du rôle devait proposer « Écriture »');
  await run.clickSelector('[data-fk="manage-space-back"]');
  await seen('« Retour » devait revenir à la liste des espaces', s => s.modal && s.modal.spaces === 2);
  await run.clickSelector('[data-fk="manage-tab-cats"]');
  await seen('l\'onglet Catégories devait montrer les deux catégories', s => s.modal && s.modal.body.includes(t('share.cat.editeurs')) && s.modal.body.includes(t('share.cat.tous')));
  await run.clickSelector('[data-fk="manage-cat-tous"]');
  const menu = await seen('le droit d\'une catégorie devait ouvrir son menu', s => s.menu.length >= 3);
  if (menu.menu.length && !menu.menu.some(label => label.startsWith(t('share.right.lecture')))) run.note(kind, 'le menu devait proposer « Lecture seule »');
  const at = await page.run(label => { const node = [...document.querySelectorAll('.menu .menu-item')].find(item => item.textContent.trim().startsWith(label)); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; }, t('share.right.lecture'));
  if (at) { await page.click(...at); await seen('le choix devait demander d\'écrire le droit de la racine', s => s.acts.some(act => act[0] === 'root' && act[1] === '@tous' && act[2] === 'lecture')); }
  await page.press('Escape');
  await seen('Échap devait fermer « Gérer les partages » seul', s => s.modal === null);
  const back = await page.run(() => Boolean(document.querySelector('.mod.sh:not(.mg)')));
  if (!back) run.note(kind, 'la fenêtre « Partager » devait rester ouverte sous « Gérer les partages »');
}

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
    for (const [kind, needs] of [['inactif', [t('share.inactive.owner'), t('share.inactive.activate')]], ['etendre', [t('share.extend.owner'), t('share.extend.activate')]], ['upgrade', [t('share.upgrade.owner'), t('share.upgrade.activate')]], ['actif', [t('share.sec.access'), t('share.row.owners'), t('share.tag.expired'), t('share.tag.invalid'), t('share.row.download')]], ['lecture', [t('share.readonly'), t('share.row.owners')]]]) {
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
        if ((kind === 'inactif' || kind === 'etendre' || kind === 'upgrade') && !(open.modal.activate && !open.modal.add)) run.note(kind, 'le propriétaire devait voir le bouton d\'activation (« Activer… » ou « Étendre… ») et pas le champ d\'ajout');
        if (kind === 'lecture' && (open.modal.add || !open.modal.readonly)) run.note(kind, 'une personne qui ne peut rien changer ne devait voir ni le champ d\'ajout ni de geste');
        if (kind === 'actif' && (!open.modal.add || open.modal.rows !== 4)) run.note(kind, `le propriétaire devait voir le champ d'ajout et quatre lignes (il en voit ${open.modal.rows})`);
        if (kind === 'lecture' && open.modal.locked < 1) run.note(kind, 'les lignes devaient être grisées (cadenas) pour qui ne peut rien changer');
      }
      if (kind === 'actif') {
        // La vraie souris : la liste du champ, une catégorie, le formulaire (« Ajouter » visible sans défiler), puis « Ajouter » demande d'écrire.
        await run.clickSelector('[data-fk="share-add"]');
        const list = await expect(kind, 'le champ devait ouvrir la liste des personnes et des catégories', s => s.modal && s.modal.options.length >= 2);
        if (list.modal && !list.modal.options.some(label => label.includes(t('share.cat.editeurs')))) run.note(kind, `la liste devait proposer « ${t('share.cat.editeurs')} »`);
        // « Un autre document Grist… » : dans la liste, grisée (jamais masquée), avec une icône (et non les initiales d'une personne) ; un clic à la vraie souris dit pourquoi, sans rien écrire ni ouvrir de formulaire.
        if (!list.modal || !list.modal.other) run.note(kind, `la liste devait garder « ${t('share.other')} », grisée`);
        else {
          if (!list.modal.other.text.includes(t('share.other')) || !list.modal.other.text.includes(t('share.other.hint'))) run.note(kind, `la ligne grisée devait dire « ${t('share.other')} » et son explication (elle dit « ${list.modal.other.text} »)`);
          if (!list.modal.other.icon || list.modal.other.initials) run.note(kind, 'la ligne grisée devait porter une icône, pas les initiales d\'une personne');
          await page.run(() => document.querySelector('.sh .drop .opt[aria-disabled="true"]').scrollIntoView({ block: 'nearest' }));
          await run.clickSelector('.sh .drop .opt[aria-disabled="true"]');
          const said = await expect(kind, `un clic sur la ligne grisée devait dire « ${t('share.other.why')} »`, s => s.modal && s.modal.note === t('share.other.why'));
          if (said.modal && (said.modal.form || said.acts.length)) run.note(kind, 'la ligne grisée ne devait ni ouvrir de formulaire ni rien écrire');
          if (said.modal && !said.modal.options.some(label => label.includes(t('share.cat.editeurs')))) run.note(kind, 'la liste devait rester ouverte après le clic sur la ligne grisée');
        }
        const pick = await page.run(selector => { const node = document.querySelector(selector); if (!node) return null; node.scrollIntoView({ block: 'nearest' }); const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; }, '[data-fk="share-pick-@editeurs"]');
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
      if (kind === 'actif') await manageFlow(page, run, t);
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
