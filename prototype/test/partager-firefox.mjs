// La fenêtre « Partager » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; contrats 11.7, point 13).
// La vraie fenêtre (js/sharing/share-window.js) s'ouvre par le vrai menu d'une ligne de l'explorateur (clic droit, puis « Partager… »), sur trois états que le contrôleur aurait lus (test/pages/explorateur.js,
// `window.__share`) : le partage n'est pas activé (une personne propriétaire), activé (propriétaire : adresse très longue, catégories, fin d'accès, accès échu, partage invalide), une personne qui ne
// peut rien changer. À chaque largeur de l'essai : la fenêtre tient dans la page, son titre et son bouton restent en place, seul le contenu défile, rien n'en sort, le clavier est sur « Terminé », Tab reste
// dedans, Échap la ferme ; sur l'état « activé », la vraie souris ouvre la liste du champ, choisit une catégorie, le formulaire se montre avec « Ajouter » sans défiler, et « Ajouter » demande bien d'écrire.
import { createI18n } from '../js/i18n/i18n.js';
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
    centered: (() => { const need = modal.querySelector('[data-fk="share-need"] [data-fk="share-activate"]'); if (!need) return null; const at = need.getBoundingClientRect(); const area = body.getBoundingClientRect(); return Math.abs((at.left + at.right) / 2 - (area.left + body.clientWidth / 2)) <= 6; })(), // le milieu de la zone qui défile (sans sa barre)
    add: Boolean(modal.querySelector('[data-fk="share-add"]')), activate: Boolean(modal.querySelector('[data-fk="share-activate"]')), readonly: Boolean(modal.querySelector('[data-fk="share-readonly"]')),
    options: [...modal.querySelectorAll('.drop .opt')].map(node => text(node)), rows: [...modal.querySelectorAll('.rr[data-share]')].length, form: Boolean(modal.querySelector('.sg-new')),
    note: text(modal.querySelector('.mod-note')), tabs: [...modal.querySelectorAll('.mg-tab')].length,
    confirmShown: confirmBox ? confirmBox.top >= head.bottom - 1 && confirmBox.bottom <= foot.top + 1 : null, locked: [...modal.querySelectorAll('.rr[data-share] .lvl[aria-disabled="true"]')].length,
  };
  return out;
}

// Ce que la page montre de « Gérer les partages » (js/sharing/manage-window.js).
function manageState() {
  const modal = document.querySelector('.mod.mg');
  // La fenêtre « Partager » dessous : cachée (visibilité) tant que « Gérer les partages » est ouverte ; et où est le clavier, fenêtre ou non.
  const under = document.querySelector('.mod.sh:not(.mg)');
  const where = document.activeElement;
  const out = { modal: null, under: under ? getComputedStyle(under.closest('.mod-scrim')).visibility : null, key: where && where.dataset ? where.dataset.fk || null : null, acts: window.__manageActs || [], menu: [...document.querySelectorAll('.menu .menu-item')].map(node => node.textContent.replace(/\s+/g, ' ').trim()) };
  if (!modal) return out;
  const box = modal.getBoundingClientRect();
  const head = modal.querySelector('.mod-head').getBoundingClientRect();
  const foot = modal.querySelector('.mod-foot').getBoundingClientRect();
  const active = document.activeElement;
  const outside = node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); };
  out.modal = {
    height: Math.round(box.height), top: Math.round(box.top), width: Math.round(box.width),
    body: modal.querySelector('.sh-body').textContent.replace(/\s+/g, ' ').trim(), focus: active && active.dataset ? active.dataset.fk || null : null, inside: modal.contains(active),
    inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1, sticky: head.bottom <= foot.top + 1 && foot.bottom <= box.bottom + 1 && head.top >= box.top - 1,
    outside: [...modal.querySelectorAll('.sh-body *, .mod-foot *, .mod-head *')].filter(outside).map(node => node.className || node.tagName).slice(0, 5),
    tabs: [...modal.querySelectorAll('.mg-tab')].map(node => [node.textContent, node.getAttribute('aria-selected')]), groups: [...modal.querySelectorAll('.rr[data-group]')].length, links: [...modal.querySelectorAll('.rr[data-link]')].length, spaces: [...modal.querySelectorAll('.rr[data-space]')].length, spaceGroups: [...modal.querySelectorAll('.rr[data-space-group]')].length, foot: (modal.querySelector('.mod-foot .mod-note') || {}).textContent || '', people: (modal.querySelector('[data-fk="manage-group-people"]') || {}).value || '', form: Boolean(modal.querySelector('.sg-new')),
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
  const open = await seen('« Gérer les partages… » devait ouvrir la fenêtre sur « Options », le clavier dedans', s => s.modal && s.modal.body.includes(t('manage.options.structure')) && s.modal.tabs.length === 5);
  if (!open.modal) return;
  if (open.under !== 'hidden') run.note(kind, `la fenêtre « Partager » devait être cachée sous « Gérer les partages » (visibilité : ${open.under})`);
  // Les cinq onglets gardent la même hauteur et la même place (le titre ne saute plus), et un clic sur un onglet lui laisse le clavier.
  const frame = { height: open.modal.height, top: open.modal.top };
  const steady = (what, now) => {
    if (!now.modal) return;
    if (now.modal.height !== frame.height || now.modal.top !== frame.top) run.note(kind, `${what} : la fenêtre devait garder sa hauteur (${frame.height} px) et sa place (${frame.top} px) à chaque onglet (elle mesure ${now.modal.height} px, à ${now.modal.top} px)`);
  };
  const keptKey = (what, now, key) => { if (now.modal && now.modal.focus !== key) run.note(kind, `${what} : le clavier devait rester sur l'onglet choisi (« ${key} »), il est sur « ${now.modal.focus} »`); };
  if (!open.modal.inPage) run.note(kind, 'la fenêtre devait tenir dans la page');
  if (!open.modal.sticky) run.note(kind, 'le titre et le bouton devaient rester en place');
  if (open.modal.outside.length) run.note(kind, `rien ne devait sortir de la fenêtre (sort : ${open.modal.outside.join(', ')})`);
  if (!open.modal.inside) run.note(kind, 'le clavier devait être dans la fenêtre');
  await run.clickSelector('[data-fk="manage-structure"]');
  await seen('le bouton de la structure devait demander le geste', s => JSON.stringify(s.acts) === '[["structure"]]');
  await run.clickSelector('[data-fk="manage-tab-groups"]');
  const groups = await seen('l\'onglet Groupes devait lister les deux groupes', s => s.modal && s.modal.groups === 2 && s.modal.body.includes('Achats'));
  steady('onglet Groupes', groups);
  keptKey('onglet Groupes', groups, 'manage-tab-groups');
  if (groups.modal && (groups.modal.outside.length || !groups.modal.inPage)) run.note(kind, `la liste des groupes (nom très long) devait tenir (sort : ${groups.modal.outside.join(', ')})`);
  if (groups.modal && groups.modal.body.includes(t('manage.groups.edit') + ' ' + t('manage.groups.remove')) === false && !groups.modal.body.includes(t('manage.groups.remove'))) run.note(kind, 'chaque groupe devait avoir « Supprimer »');
  await run.clickSelector('[data-fk="manage-group-new"]');
  await seen('« Nouveau groupe » devait montrer le formulaire, le clavier sur le nom', s => s.modal && s.modal.form && s.modal.focus === 'manage-group-name');
  await page.press(...'Ventes'.split(''));
  // Les adresses à proposer (choix du 13/11) : les deux boutons sont là, dans la fenêtre, et ne la font pas grandir (le contenu défile) ; la colonne choisie se dit à côté ;
  // « Ajouter une adresse connue… » ajoute l'adresse choisie au champ, sur sa ligne.
  const withButtons = await seen('le formulaire devait offrir « Ajouter une adresse connue… » et « Adresses d\'une table… »', s => s.modal && s.modal.body.includes(t('manage.suggest.button')) && s.modal.body.includes(t('manage.suggest.column')));
  steady('formulaire du groupe', withButtons);
  if (withButtons.modal && (withButtons.modal.outside.length || !withButtons.modal.inPage || !withButtons.modal.sticky)) run.note(kind, `le formulaire du groupe devait tenir à 700 × 400 (sort : ${withButtons.modal.outside.join(', ')})`);
  if (withButtons.modal && withButtons.modal.greyed.some(key => /manage-group-(suggest|column)/.test(key))) run.note(kind, 'les deux boutons d\'adresses devaient être libres (la table Contacts a une colonne d\'adresses)');
  await run.clickSelector('[data-fk="manage-group-column"]');
  await seen('« Adresses d\'une table… » devait dire la colonne choisie dans le pied de la fenêtre', s => s.modal && s.modal.foot === t('manage.suggest.chosen', { table: 'Contacts', column: 'Mail', n: 12 }) && JSON.stringify(s.acts.slice(1)) === '[["column"]]');
  await run.clickSelector('[data-fk="manage-group-suggest"]');
  await seen('« Ajouter une adresse connue… » devait mettre l\'adresse choisie dans le champ, le clavier dessus', s => s.modal && s.modal.people === 'lea@example.com' && s.modal.focus === 'manage-group-people' && JSON.stringify(s.acts[2]) === '["suggest",""]');
  await run.clickSelector('[data-fk="manage-group-save"]');
  await seen('« Créer le groupe » devait demander d\'écrire le groupe', s => JSON.stringify(s.acts.slice(3)) === '[["addGroup","Ventes","lea@example.com"]]');
  await run.clickSelector('[data-fk="manage-tab-spaces"]');
  const spaces = await seen('l\'onglet Espaces devait lister les deux espaces', s => s.modal && s.modal.spaces === 2);
  steady('onglet Espaces', spaces);
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
  // « Autres documents » : les liens (à jour, en attente, bloqué) et leur seul geste ; annuler l'invitation en attente l'enlève de la liste.
  await run.clickSelector('[data-fk="manage-tab-other"]');
  const linked = await seen('l\'onglet Autres documents devait lister les trois liens et dire que ce qui est arrivé reste', s => s.modal && s.modal.links === 3 && s.modal.body.includes(t('manage.other.lead')));
  steady('onglet Autres documents', linked);
  keptKey('onglet Autres documents', linked, 'manage-tab-other');
  if (linked.modal && (!linked.modal.inPage || !linked.modal.sticky || linked.modal.outside.length)) run.note(kind, `l'onglet Autres documents devait tenir dans la fenêtre (sort : ${linked.modal.outside.join(', ')})`);
  if (linked.modal && !(linked.modal.body.includes(t('manage.other.cancel')) && linked.modal.body.includes(t('manage.other.stop')))) run.note(kind, 'un lien en attente devait proposer « Annuler », les autres « Arrêter »');
  await run.clickSelector('[data-fk="manage-other-stop-e2"]');
  await seen('annuler l\'invitation en attente devait le demander puis la retirer de la liste', s => s.acts.some(act => act[0] === 'cancelLink' && act[1] === 'e2') && s.modal && s.modal.links === 2);
  // « Relier un document… » : la fenêtre du lien (sans fichier) s'ouvre par-dessus ; Échap ne ferme qu'elle, et la liste est relue.
  if (linked.modal && !linked.modal.body.includes(t('manage.other.new'))) run.note(kind, `l'onglet Autres documents devait proposer « ${t('manage.other.new')} »`);
  await run.clickSelector('[data-fk="manage-other-new"]');
  await seen('« Relier un document… » devait demander au contrôleur de relier', s => s.acts.some(act => act[0] === 'newLink'));
  const linkWindow = await page.run(() => { const node = document.querySelector('.mod.so'); return node ? { title: node.querySelector('.mod-head').textContent, modes: node.querySelectorAll('[data-fk^="so-mode-"]').length } : null; });
  if (!linkWindow) run.note(kind, 'la fenêtre du lien devait s\'ouvrir par-dessus « Gérer les partages »');
  else if (!linkWindow.title.includes(t('so.title.link')) || linkWindow.modes) run.note(kind, `la fenêtre devait dire « ${t('so.title.link')} » sans choix une fois / à jour (elle dit ${JSON.stringify(linkWindow)})`);
  await page.press('Escape');
  await seen('Échap devait fermer la fenêtre du lien seule, « Gérer les partages » restant ouvert', s => s.modal && s.modal.links === 2 && !s.modal.body.includes(t('so.title.link')));
  await run.clickSelector('[data-fk="manage-tab-cats"]');
  const cats = await seen('l\'onglet Catégories devait montrer les deux catégories', s => s.modal && s.modal.body.includes(t('share.cat.editeurs')) && s.modal.body.includes(t('share.cat.tous')));
  steady('onglet Catégories', cats);
  await run.clickSelector('[data-fk="manage-cat-tous"]');
  const menu = await seen('le droit d\'une catégorie devait ouvrir son menu', s => s.menu.length >= 3);
  if (menu.menu.length && !menu.menu.some(label => label.startsWith(t('share.right.lecture')))) run.note(kind, 'le menu devait proposer « Lecture seule »');
  const at = await page.run(label => { const node = [...document.querySelectorAll('.menu .menu-item')].find(item => item.textContent.trim().startsWith(label)); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; }, t('share.right.lecture'));
  if (at) { await page.click(...at); await seen('le choix devait demander d\'écrire le droit de la racine', s => s.acts.some(act => act[0] === 'root' && act[1] === '@tous' && act[2] === 'lecture')); }
  // Au clavier : le clavier est sur l'onglet Catégories ; → et ← vont à l'onglet voisin en bouclant, Fin et Début au dernier et au premier, et l'onglet atteint est choisi et garde le clavier.
  await run.clickSelector('[data-fk="manage-tab-cats"]');
  const arrows = [['ArrowRight', 'other', '→ devait choisir « Autres documents »'], ['ArrowRight', 'options', '→ sur le dernier onglet devait boucler sur « Options »'], ['End', 'other', 'Fin devait choisir le dernier onglet'],
    ['Home', 'options', 'Début devait choisir le premier onglet'], ['ArrowLeft', 'other', '← sur le premier onglet devait boucler sur le dernier'], ['ArrowLeft', 'cats', '← devait choisir « Catégories »']];
  for (const [key, tab, what] of arrows) {
    await page.press(key);
    const now = await seen(what, s => s.modal && s.modal.focus === `manage-tab-${tab}` && s.modal.tabs.filter(entry => entry[1] === 'true').map(entry => entry[0]).join() === t(`manage.tab.${tab}`));
    steady(what, now);
  }
  await page.press('Escape');
  const closed = await seen('Échap devait fermer « Gérer les partages » seul', s => s.modal === null);
  if (closed.under !== 'visible') run.note(kind, `la fenêtre « Partager » devait reparaître à la fermeture (visibilité : ${closed.under})`);
  if (closed.key !== 'share-manage') run.note(kind, `le clavier devait revenir sur « Gérer les partages… » de la fenêtre « Partager » (il est sur « ${closed.key} »)`);
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
    for (const [kind, needs] of [['inactif', [t('share.inactive.title'), t('share.inactive.owner'), t('share.inactive.activate')]], ['etendre', [t('share.extend.title'), t('share.extend.owner'), t('share.extend.activate')]], ['upgrade', [t('share.upgrade.title'), t('share.upgrade.owner'), t('share.upgrade.activate')]], ['actif', [t('share.sec.access'), t('share.row.owners'), t('share.tag.expired'), t('share.tag.invalid'), t('share.row.download')]], ['lecture', [t('share.readonly'), t('share.row.owners')]]]) {
      await run.reset();
      await page.run(name => { window.__shareKind = name; window.__shareOther = true; window.__links = 'actifs'; }, kind);
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
        if (['inactif', 'etendre', 'upgrade'].includes(kind) && open.modal.centered !== true) run.note(kind, 'le bouton de l\'étape obligatoire devait être au milieu de la fenêtre');
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
        const pick = await page.run(selector => { const node = document.querySelector(selector); if (!node) return null; node.scrollIntoView({ block: 'nearest' }); const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; }, '[data-fk="share-pick-@editeurs"]');
        if (!pick) run.note(kind, 'la liste devait proposer « les éditeurs »');
        else {
          await page.click(...pick);
          const form = await expect(kind, 'le formulaire devait se montrer avec « Ajouter » visible sans défiler, le clavier sur le droit', s => s.modal && s.modal.form && s.modal.confirmShown === true && s.modal.focus === 'share-new-level');
          if (form.modal && form.modal.form) {
            // Le menu du droit du formulaire : « Administration » est grisée pour une catégorie (une personne ou un groupe l'a, choix du 13/11), puis on revient à « Lecture ».
            await run.clickSelector('[data-fk="share-new-level"]');
            const menu = await page.run(() => [...document.querySelectorAll('.menu .menu-item')].map(node => [node.textContent.replace(/\s+/g, ' ').trim(), node.getAttribute('aria-disabled')]));
            const admin = menu.find(item => item[0].startsWith(t('share.right.admin')));
            if (!admin || admin[1] !== 'true') run.note(kind, `pour une catégorie, « ${t('share.right.admin')} » devait être grisée dans le menu du formulaire (menu : ${JSON.stringify(menu).slice(0, 200)})`);
            const back = await page.run(label => { const node = [...document.querySelectorAll('.menu .menu-item')].find(item => item.textContent.trim().startsWith(label)); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; }, t('share.right.lecture'));
            if (back) await page.click(...back); else run.note(kind, 'le menu du droit devait proposer « Lecture »');
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
  await page.run(() => { window.__shareOther = false; window.__links = null; window.__removed = []; });
  await run.reset();
  return found;
}
