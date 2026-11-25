// « Partagés avec moi » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; ouverte depuis le volet de gauche, décision du 09/11). Le vrai explorateur, le vrai
// contrôle (js/sharing/received-control.js) et la vraie fenêtre « Accepter ? » (js/sharing/received-window.js) sur des arrivées que le vrai modèle lit dans un faux Grist en mémoire (test/pages/explorateur.js, `window.__shared`) ; ce que le
// moteur de Sync+ fait de ces tables se mesure dans un vrai Grist (labo/run-partages-recus.mjs). Ici, la mise en page à 700 × 400 et les gestes, à la vraie souris et au vrai clavier :
//   la vue : le nombre à accepter dans le volet, des lignes à plat (pas de dossier), les arrivées en attente grisées avec le mot « À accepter » et sans étoile, une arrivée acceptée comme un fichier, une arrivée que l'envoyeur
//   ne partage plus gardée comme un fichier, aucune arrivée refusée, aucun texte coupé sans son texte entier au survol ; une ligne choisie change le bouton principal en « Accepter ou refuser… » ;
//   la question : Entrée sur une ligne l'ouvre, le clavier est sur « Accepter », Tab reste dans la fenêtre, Échap ferme sans rien écrire ; le menu « ⋯ » n'offre que la réponse ;
//   la cloche Notifications (à droite de l'en-tête) : la pastille dit le nombre à accepter (contraste 4,5:1, sans couvrir un autre bouton), son menu nomme les arrivées et tient dans 700 × 400, un clic sur une arrivée
//   pose sa question, « Ouvrir « Partagés avec moi » » y mène, sans arrivée la ligne reste grisée et dit ce qui s'annonce ici ;
//   un fichier qui arrive pendant que l'explorateur est ouvert s'ajoute seul (liste, volet, cloche) sans changer la ligne choisie ;
//   les DOSSIERS reçus (js/sharing/received-folders.js, choix du 11/11) : des lignes de dossier en tête (grisé « N fichiers à accepter » tant qu'un fichier attend), on y entre (fil d'Ariane, Retour arrière), la barre « Accepter le dossier… »
//   et sa fenêtre (Échap n'écrit rien, un oui = tous les fichiers à accepter, une seule action, le clavier revient dans la liste), le menu du dossier sans renommer ni supprimer, la cloche à une ligne par dossier ;
//   « Refuser » masque la ligne et le dit, « Accepter » dégrise la ligne, les marques sont écrites sur LEUR ligne seulement ; un document en lecture seule dit pourquoi, sans fenêtre ; une vue sans arrivée n'est pas une page blanche.
import { createI18n } from '../js/i18n/i18n.js';
import { Run, delay, centerOfName, centerOfSelector } from './corbeille-firefox.mjs';

const KEY = id => `gfs-recus:GFS_Recus:r${id}`;
const LONG = 'Facture de la session de formation de septembre 2026.pdf';

// Ce que la personne voit (s'exécute dans la page : rien du module n'y est visible).
function state() {
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const active = document.activeElement;
  const rail = document.querySelector('.tr-row[data-view="shared"]');
  const open = document.querySelector('.ex-foot > .btn');
  const modal = document.querySelector('.mod.so');
  const cut = [...document.querySelectorAll('.ex *')].filter(node => {
    const style = getComputedStyle(node);
    const clipped = (style.textOverflow === 'ellipsis' && node.scrollWidth > node.clientWidth + 1) || (style.getPropertyValue('-webkit-line-clamp') !== 'none' && node.scrollHeight > node.clientHeight + 1);
    return clipped && !node.closest('[title]') && !node.getAttribute('aria-label');
  }).map(node => `${node.className || node.tagName} « ${text(node).slice(0, 40)} »`);
  const box = node => { const at = node.getBoundingClientRect(); return { l: at.left, t: at.top, r: at.right, b: at.bottom }; };
  const channels = value => (String(value).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const light = value => { const [r, g, b] = channels(value).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [hi, lo] = [light(a), light(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const bell = document.querySelector('.tb-bell');
  const badge = bell && bell.querySelector('.tb-badge');
  const menuBox = document.querySelector('.menu');
  const out = {
    cut,
    bell: bell ? {
      label: bell.getAttribute('aria-label'), title: bell.getAttribute('title'), disabled: bell.getAttribute('aria-disabled') === 'true', badge: badge && !badge.hidden ? text(badge) : null, box: box(bell),
      badgeBox: badge && !badge.hidden ? box(badge) : null, badgeContrast: badge && !badge.hidden ? ratio(getComputedStyle(badge).color, getComputedStyle(badge).backgroundColor) : null,
      others: ['.tb-group', '[aria-label][aria-haspopup="menu"]:not(.tb-bell)'].map(selector => document.querySelector(`.ex-title-row ${selector}`)).filter(Boolean).map(box),
      grow: box(document.querySelector('.ex-title-row .grow')), page: { w: window.innerWidth, h: window.innerHeight },
    } : null,
    menuBox: menuBox ? box(menuBox) : null,
    rail: rail ? { label: text(rail.querySelector('.lbl')), count: text(rail.querySelector('.cnt')), current: rail.getAttribute('aria-current') === 'true', grey: rail.getAttribute('aria-disabled') === 'true' } : null,
    rows: [...document.querySelectorAll('.ls-row')].map(row => ({ name: text(row.querySelector('.t')), folder: row.classList.contains('folder'), grey: row.classList.contains('lk'), pill: text(row.querySelector('.ty .pill')), pins: row.querySelectorAll('.rb.pin').length, key: row.dataset.key })),
    selected: text(document.querySelector('.ls-row[aria-selected="true"] .t')),
    bar: text(document.querySelector('.ex .trash-bar')),
    focusKey: active && active.dataset ? active.dataset.key || null : null,
    filings: window.__filing ? window.__filing.length : 0,
    crumbs: text(document.querySelector('.crumbs')),
    empty: (() => { const node = document.querySelector('.ex-scroll .empty'); return node && !node.hidden ? text(node) : null; })(),
    openLabel: text(open),
    info: text(document.querySelector('.ex-info')),
    notices: window.__notices.slice(),
    opened: window.__opened,
    menu: [...document.querySelectorAll('.menu .menu-item')].map(item => ({ label: text(item.querySelector('.menu-label')), hint: text(item.querySelector('.menu-hint')) })),
    marks: window.__sharedTables && window.__sharedTables.GFS_Recus ? window.__sharedTables.GFS_Recus.rows.map(row => [row.Nom, row.Accepte === true, row.Refuse === true]) : [],
    writes: window.__sharedActions ? window.__sharedActions.length : 0,
    modal: null,
  };
  if (modal) {
    const box = modal.getBoundingClientRect();
    const head = modal.querySelector('.mod-head').getBoundingClientRect();
    const foot = modal.querySelector('.mod-foot').getBoundingClientRect();
    const outside = node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); };
    out.modal = {
      title: text(modal.querySelector('.mod-head h2')), sub: text(modal.querySelector('.mod-count')), body: text(modal.querySelector('.rt-body')), foot: text(modal.querySelector('.mod-note')),
      focus: active && active.dataset ? active.dataset.fk || null : null, inside: modal.contains(active), keys: [...modal.querySelectorAll('[data-fk]')].map(node => node.dataset.fk),
      inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1,
      sticky: head.bottom <= foot.top + 1 && foot.bottom <= box.bottom + 1 && head.top >= box.top - 1,
      outside: [...modal.querySelectorAll('.rt-body *, .mod-foot *, .mod-head *')].filter(outside).map(node => node.className || node.tagName).slice(0, 5),
    };
  }
  return out;
}

export async function partagesRecusProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'partagés avec moi');
  const snap = () => page.run(state);
  const expect = async (kind, what, test) => {
    let now = await snap();
    for (let i = 0; i < 40 && !test(now); i += 1) { await delay(75); now = await snap(); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify({ ...now, cut: undefined, info: undefined }).slice(0, 600)})`);
    return now;
  };
  const clickRow = async name => { const at = await page.run(centerOfName, name); if (!at) { run.note('ligne introuvable', `« ${name} » n'est pas dans la liste`); return false; } await page.click(...at); return true; };
  const clickKey = async (kind, selector) => { const at = await page.run(centerOfSelector, selector); if (!at) { run.note(kind, `${selector} devait être dans la page`); return false; } await page.click(...at); return true; };
  const fits = (kind, now, what) => {
    if (!now.modal) return;
    if (!now.modal.inPage) run.note(kind, `${what} : la fenêtre devait tenir dans la page`);
    if (!now.modal.sticky) run.note(kind, `${what} : le titre et les boutons devaient rester en place`);
    if (now.modal.outside.length) run.note(kind, `${what} : rien ne devait sortir de la fenêtre (sort : ${now.modal.outside.join(', ')})`);
  };
  const names = now => now.rows.map(row => row.name);
  const row = (now, name) => now.rows.find(each => each.name === name);
  try {
    await run.reset();
    await page.run(() => window.__shared('arrivees'));
    const view = await expect('la vue', 'la vue devait montrer les quatre arrivées non refusées, à plat', s => s.rows.length === 4);
    if (!view.rail || !view.rail.current || view.rail.label !== t('rx.view')) run.note('la vue', `le volet devait porter « ${t('rx.view')} » comme vue courante (il dit ${JSON.stringify(view.rail)})`);
    if (view.rail && view.rail.count !== '2') run.note('la vue', `le volet devait dire le nombre à accepter (2), il dit ${view.rail && view.rail.count}`);
    if (!view.crumbs || !view.crumbs.includes(t('rx.view'))) run.note('la vue', `le fil d'Ariane devait nommer la vue (il dit « ${view.crumbs} »)`);
    if (view.rows.some(each => each.folder)) run.note('la vue', 'la liste est à plat : aucun dossier ne devait y être');
    if (names(view).some(name => name === 'Ancien refus.pdf')) run.note('la vue', 'une arrivée refusée ne devait plus être montrée');
    for (const name of [LONG, 'Devis.pdf']) {
      const each = row(view, name);
      if (!each || !each.grey || each.pill !== t('rx.pending')) run.note('la vue', `« ${name} » devait être grisé, avec le mot « ${t('rx.pending')} » (il est ${JSON.stringify(each)})`);
      if (each && each.pins) run.note('la vue', `« ${name} » n'a pas de rangement : aucune étoile ne devait y être`);
    }
    const accepted = row(view, 'Contrat.pdf');
    if (!accepted || accepted.grey || accepted.pill !== 'PDF') run.note('la vue', `« Contrat.pdf » accepté devait être un fichier comme les autres (il est ${JSON.stringify(accepted)})`);
    const gone = row(view, 'Retiré.pdf');
    if (!gone || gone.grey || gone.pill !== 'PDF') run.note('la vue', `« Retiré.pdf » (l'envoyeur ne le partage plus) devait rester un fichier lisible avec son type (il est ${JSON.stringify(gone)})`);
    if (view.cut.length) run.note('la vue', `un texte coupé devait avoir son texte entier au survol : ${view.cut.slice(0, 3).join(' ; ')}`);

    // La cloche : à droite, la pastille dit le nombre à accepter, le menu nomme les arrivées ; un clic sur l'une pose SA question.
    const bell = view.bell;
    if (!bell) run.note('la cloche', 'la cloche devait être dans l\'en-tête');
    else {
      const overlap = (a, b) => a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
      if (bell.badge !== '2' || bell.label !== t('nt.tipCount', { n: 2 })) run.note('la cloche', `la pastille devait dire 2 et le nom de la cloche « ${t('nt.tipCount', { n: 2 })} » (elle dit ${JSON.stringify([bell.badge, bell.label])})`);
      if (bell.box.l < bell.grow.r - 1) run.note('la cloche', 'la cloche devait être à droite du titre, avec les autres boutons');
      if (bell.others.some(other => overlap(bell.box, other) || (bell.badgeBox && overlap(bell.badgeBox, other)))) run.note('la cloche', 'la cloche et sa pastille ne devaient couvrir aucun autre bouton');
      if (bell.badgeBox && (bell.badgeBox.r > bell.page.w || bell.badgeBox.t < 0)) run.note('la cloche', 'la pastille devait tenir dans la page');
      if (bell.badgeContrast !== null && bell.badgeContrast < 4.5) run.note('la cloche', `le nombre de la pastille devait avoir un contraste de 4,5:1 au moins (il est de ${bell.badgeContrast.toFixed(2)})`);
    }
    if (await clickKey('la cloche', '.tb-bell')) {
      const bellMenu = await expect('la cloche', 'le menu de la cloche devait s\'ouvrir', s => s.menu.length > 0);
      const labels = bellMenu.menu.map(item => item.label);
      const wanted = [t('nt.arrival', { name: LONG, by: 'Comptabilité' }), t('nt.arrival', { name: 'Devis.pdf', by: 'Comptabilité' }), t('nt.open')];
      if (labels.length !== 3 || !wanted.every(label => labels.includes(label)) || labels.at(-1) !== t('nt.open')) run.note('la cloche', `le menu devait nommer les deux arrivées puis ouvrir « ${t('rx.view')} » (il dit ${JSON.stringify(labels)})`);
      const at = bellMenu.menuBox;
      if (!at || at.l < 0 || at.t < 0 || at.r > bellMenu.bell.page.w + 1 || at.b > bellMenu.bell.page.h + 1) run.note('la cloche', `le menu devait tenir dans la page (${JSON.stringify(at)})`);
      await page.press('Escape');
      await expect('la cloche', 'Échap devait fermer le menu de la cloche', s => s.menu.length === 0);
      await clickKey('la cloche', '.tb-bell');
      await expect('la cloche', 'le menu de la cloche devait se rouvrir', s => s.menu.length > 0);
      await clickKey('la cloche', '.menu .menu-item:nth-child(2)');
      const fromBell = await expect('la cloche', 'un clic sur une arrivée devait poser la question de CE fichier', s => s.modal && s.modal.focus === 'rx-accept');
      if (fromBell.modal && ![LONG, 'Devis.pdf'].some(name => fromBell.modal.title === t('rx.answer.title', { name }))) run.note('la cloche', `la question devait nommer une des deux arrivées (« ${fromBell.modal.title} »)`);
      await page.press('Escape');
      const back = await expect('la cloche', 'Échap devait fermer la question', s => s.modal === null);
      if (back.writes !== 0 || (back.bell && back.bell.badge !== '2')) run.note('la cloche', 'Échap ne devait rien écrire : les deux arrivées restent à accepter');
    }

    // Une ligne choisie : le bouton principal dit la réponse ; la barre dit pourquoi la ligne est grisée.
    await clickRow('Devis.pdf');
    const chosen = await expect('la ligne choisie', 'le bouton principal devait devenir « Accepter ou refuser… »', s => s.selected === 'Devis.pdf' && s.openLabel === t('rx.answer.menu'));
    if (!chosen.info || !chosen.info.includes(t('rx.lock'))) run.note('la ligne choisie', `la barre devait dire pourquoi la ligne est grisée (« ${t('rx.lock')} »), elle dit « ${chosen.info} »`);

    // Entrée ouvre la question ; le clavier est sur « Accepter » ; Tab reste dedans ; Échap ferme sans rien écrire.
    await page.press('Enter');
    const asked = await expect('la question', 'Entrée devait ouvrir la question, le clavier sur « Accepter »', s => s.modal && s.modal.focus === 'rx-accept');
    fits('la question', asked, 'la question');
    if (asked.modal) {
      if (asked.modal.title !== t('rx.answer.title', { name: 'Devis.pdf' })) run.note('la question', `le titre devait nommer le fichier (« ${t('rx.answer.title', { name: 'Devis.pdf' })} »), il dit « ${asked.modal.title} »`);
      if (!asked.modal.sub || !asked.modal.sub.includes('Comptabilité')) run.note('la question', `le sous-titre devait dire qui partage (il dit « ${asked.modal.sub} »)`);
      if (!asked.modal.body.includes('Comptabilité') || !/Ko|KB|o\b|B\b/.test(asked.modal.body)) run.note('la question', `le texte devait dire qui partage et le poids (« ${asked.modal.body} »)`);
      if (asked.modal.foot !== t('rx.answer.foot')) run.note('la question', `le pied devait dire « ${t('rx.answer.foot')} » (il dit « ${asked.modal.foot} »)`);
      if (!['rx-refuse', 'rx-accept'].every(key => asked.modal.keys.includes(key))) run.note('la question', `la fenêtre devait avoir « Refuser » et « Accepter » (${asked.modal.keys.join(', ')})`);
    }
    for (let i = 0; i < 3; i += 1) { await page.press('Tab'); const inside = await snap(); if (!inside.modal || !inside.modal.inside) run.note('la question', 'Tab devait rester dans la fenêtre'); }
    await page.press('Escape');
    const closed = await expect('la question', 'Échap devait fermer la fenêtre', s => s.modal === null);
    if (closed.writes !== 0 || closed.marks.some(([, yes, no]) => (yes || no) === false && false)) run.note('la question', 'Échap ne devait rien écrire');
    if (closed.rail && closed.rail.count !== '2') run.note('la question', 'après Échap, les deux arrivées devaient rester à accepter');

    // Le menu « ⋯ » : la réponse seule ; « Refuser » masque la ligne, le dit, et ne marque que cette ligne.
    await page.run(name => { const row = [...document.querySelectorAll('.ls-row')].find(item => item.querySelector('.t').textContent === name); row.querySelector('.rb.mn').click(); }, 'Devis.pdf');
    const menu = await expect('le menu', 'le menu devait s\'ouvrir', s => s.menu.length > 0);
    if (menu.menu.length !== 1 || menu.menu[0].label !== t('rx.answer.menu') || menu.menu[0].hint !== t('key.enter')) run.note('le menu', `le menu d'une arrivée en attente devait n'offrir que « ${t('rx.answer.menu')} » (il offre ${JSON.stringify(menu.menu)})`);
    await clickKey('le menu', '.menu .menu-item');
    await expect('le menu', 'l\'article devait ouvrir la question', s => s.modal && s.modal.focus === 'rx-accept');
    await clickKey('refuser', '[data-fk="rx-refuse"]');
    const refused = await expect('refuser', '« Refuser » devait fermer la question et masquer la ligne', s => s.modal === null && !names(s).includes('Devis.pdf'));
    if (refused.rail && refused.rail.count !== '1') run.note('refuser', `le nombre à accepter devait tomber à 1 (il dit ${refused.rail && refused.rail.count})`);
    if (!refused.notices.includes(t('rx.refused', { name: 'Devis.pdf' }))) run.note('refuser', `la phrase devait dire que le fichier est refusé (« ${t('rx.refused', { name: 'Devis.pdf' })} »)`);
    if (refused.bell && refused.bell.badge !== '1') run.note('refuser', `la pastille de la cloche devait tomber à 1 (elle dit ${refused.bell && refused.bell.badge})`);
    const marksAfterRefuse = JSON.stringify(refused.marks.filter(([name]) => name === 'Devis.pdf' || name === LONG));
    if (marksAfterRefuse !== JSON.stringify([[LONG, false, false], ['Devis.pdf', false, true]])) run.note('refuser', `seule la ligne de Devis devait être marquée refusée (marques : ${marksAfterRefuse})`);

    // « Accepter » la ligne au nom long : la ligne n'est plus grisée, le mot est « PDF » ; la fenêtre tient avec ce nom.
    await clickRow(LONG);
    await page.press('Enter');
    const long = await expect('accepter', 'Entrée devait ouvrir la question du fichier au nom long', s => s.modal && s.modal.focus === 'rx-accept');
    fits('accepter', long, 'la question du nom long');
    await clickKey('accepter', '[data-fk="rx-accept"]');
    const done = await expect('accepter', '« Accepter » devait fermer la question et dégriser la ligne', s => s.modal === null && row(s, LONG) && !row(s, LONG).grey);
    if (row(done, LONG) && row(done, LONG).pill !== 'PDF') run.note('accepter', `le mot de la ligne acceptée devait être « PDF » (il est « ${row(done, LONG).pill} »)`);
    if (done.bell && (done.bell.badge !== null || done.bell.label !== t('nt.tip'))) run.note('accepter', `plus rien à accepter : la cloche ne devait plus porter de nombre (elle dit ${JSON.stringify([done.bell.badge, done.bell.label])})`);
    if (done.rail && done.rail.count !== null) run.note('accepter', `plus rien à accepter : le volet ne devait plus porter de nombre (il dit ${done.rail.count})`);
    if (JSON.stringify(done.marks.find(([name]) => name === LONG)) !== JSON.stringify([LONG, true, false])) run.note('accepter', `la ligne devait être marquée acceptée (${JSON.stringify(done.marks.find(([name]) => name === LONG))})`);
    if (!done.notices.includes(t('rx.accepted', { name: LONG }))) run.note('accepter', 'la phrase devait dire que le fichier est accepté');

    // Une arrivée acceptée se choisit et s'ouvre comme un fichier ; son menu n'a plus la réponse.
    await clickRow('Contrat.pdf');
    const open = await expect('arrivée acceptée', 'le bouton principal devait redevenir « Ouvrir »', s => s.selected === 'Contrat.pdf' && s.openLabel === t('ex.open'));
    await page.press('Enter');
    if ((await expect('arrivée acceptée', 'Entrée devait ouvrir le fichier accepté', s => s.opened === 'Contrat.pdf')).modal) run.note('arrivée acceptée', 'un fichier accepté ne devait pas reposer la question');
    if (open.info && open.info.includes(t('rx.lock'))) run.note('arrivée acceptée', 'un fichier accepté n\'est plus grisé');

    // Les DOSSIERS reçus : deux dossiers (« Contrats » : 2 fichiers à accepter + 1 accepté ; « Archives » : 2 acceptés) et un fichier seul.
    await run.reset();
    await page.run(() => window.__shared('dossier'));
    const top = await expect('dossiers', 'la vue devait montrer deux dossiers en tête puis le fichier seul', s => s.rows.length === 3);
    const kinds = top.rows.map(each => `${each.folder ? 'D' : 'F'}:${each.name}`).join(' | ');
    if (kinds !== 'D:Archives | D:Contrats | F:Seul.pdf') run.note('dossiers', `la liste devait être « D:Archives | D:Contrats | F:Seul.pdf » (dossiers d'abord) : ${kinds}`);
    const contrats = row(top, 'Contrats');
    const archives = row(top, 'Archives');
    if (!contrats || !contrats.grey || contrats.pill !== t('rx.folder.pending', { n: 2 })) run.note('dossiers', `« Contrats » devait être grisé et dire « ${t('rx.folder.pending', { n: 2 })} » (il est ${JSON.stringify(contrats)})`);
    if (!archives || archives.grey || archives.pill !== t('ex.fileCount', { n: 2 })) run.note('dossiers', `« Archives » (tout accepté) ne devait pas être grisé et dire « ${t('ex.fileCount', { n: 2 })} » (il est ${JSON.stringify(archives)})`);
    if (top.rail && top.rail.count !== '3') run.note('dossiers', `le volet devait compter 3 fichiers à accepter (2 du dossier + le fichier seul), il dit ${top.rail && top.rail.count}`);
    if (top.cut.length) run.note('dossiers', `un texte coupé devait avoir son texte entier au survol : ${top.cut.slice(0, 3).join(' ; ')}`);
    await clickRow('Contrats');
    const picked = await expect('dossiers', 'une ligne de dossier choisie devait être choisie', s => s.selected === 'Contrats');
    if (!picked.info || !picked.info.includes(t('rx.folder.hint'))) run.note('dossiers', `la barre d'information devait dire ce qu'est un dossier reçu (« ${t('rx.folder.hint')} »), elle dit « ${picked.info} »`);
    await page.press('F2');
    await page.press('Delete');
    await page.chord('Control', 'x');
    const kept = await snap();
    if (kept.modal || kept.filings !== 0) run.note('dossiers', 'F2, Suppr et Ctrl+X ne devaient rien faire sur un dossier reçu (ni fenêtre ni rangement)');
    await page.press('Enter');
    const inside = await expect('dossiers', 'Entrée devait entrer dans le dossier : trois fichiers, le fil d\'Ariane le dit', s => s.rows.length === 3 && s.rows.every(each => !each.folder));
    if (!inside.crumbs || !inside.crumbs.includes(t('rx.view')) || !inside.crumbs.endsWith('Contrats')) run.note('dossiers', `le fil d'Ariane devait dire « … ${t('rx.view')} › Contrats » (il dit « ${inside.crumbs} »)`);
    if (JSON.stringify(inside.rows.map(each => [each.name, each.grey])) !== JSON.stringify([['Contrat de prestation.pdf', true], ['Avenant 1.pdf', true], ['Avenant 2.pdf', false]])) run.note('dossiers', `les fichiers du dossier devaient être Contrat de prestation (grisé), Avenant 1 (grisé), Avenant 2 (accepté), du plus récent au plus ancien : ${JSON.stringify(inside.rows.map(each => [each.name, each.grey]))}`);
    if (!inside.bar || !inside.bar.includes(t('rx.folder.bar', { n: 2 }).replace(/\.$/, '')) || !inside.bar.includes(t('rx.folder.answer'))) run.note('dossiers', `la barre devait dire « ${t('rx.folder.bar', { n: 2 })} » avec « ${t('rx.folder.answer')} » (elle dit « ${inside.bar} »)`);
    if (inside.cut.length) run.note('dossiers', `dans le dossier, un texte coupé devait avoir son texte entier au survol : ${inside.cut.slice(0, 3).join(' ; ')}`);
    await page.press('Backspace');
    const back = await expect('dossiers', 'Retour arrière devait revenir à « Partagés avec moi »', s => s.rows.some(each => each.folder) && s.crumbs && !s.crumbs.endsWith('Contrats'));
    if (back.rows.length !== 3) run.note('dossiers', 'au retour, les deux dossiers et le fichier seul devaient être là');
    await clickRow('Contrats');
    await page.press('Enter');
    await expect('dossiers', 'on devait pouvoir ressortir par le fil d\'Ariane', s => s.rows.length === 3 && !s.rows[0].folder);
    await clickKey('dossiers', '.crumbs button[data-view="shared"]');
    await expect('dossiers', 'le fil d\'Ariane devait ramener à « Partagés avec moi » à la souris', s => s.rows.some(each => each.folder));
    await clickRow('Contrats');
    await page.press('Enter');
    await expect('dossiers', 'rentrer dans le dossier', s => s.rows.length === 3 && !s.rows[0].folder);

    // La question du dossier : la barre, la fenêtre (elle tient, Tab y reste, Échap n'écrit rien), puis « Accepter ».
    await clickKey('dossiers', '.trash-bar .btn');
    const folderAsk = await expect('dossiers', 'la barre devait ouvrir la question du dossier, le clavier sur « Accepter »', s => s.modal && s.modal.focus === 'rx-accept');
    fits('dossiers', folderAsk, 'la question du dossier');
    if (folderAsk.modal) {
      if (folderAsk.modal.title !== t('rx.folder.title', { name: 'Contrats' })) run.note('dossiers', `le titre devait dire « ${t('rx.folder.title', { name: 'Contrats' })} », il dit « ${folderAsk.modal.title} »`);
      if (!folderAsk.modal.body.includes('Comptabilité') || !/Ko|KB|o\b|B\b/.test(folderAsk.modal.body) || !folderAsk.modal.body.includes(t('rx.folder.keep'))) run.note('dossiers', `le texte devait dire qui partage, le poids, et qu'un fichier ajouté plus tard attend (« ${folderAsk.modal.body} »)`);
      if (folderAsk.modal.foot !== t('rx.folder.foot')) run.note('dossiers', `le pied devait dire « ${t('rx.folder.foot')} » (il dit « ${folderAsk.modal.foot} »)`);
    }
    for (let i = 0; i < 3; i += 1) { await page.press('Tab'); const around = await snap(); if (!around.modal || !around.modal.inside) run.note('dossiers', 'Tab devait rester dans la fenêtre du dossier'); }
    await page.press('Escape');
    const nothing = await expect('dossiers', 'Échap devait fermer la question', s => s.modal === null);
    if (nothing.writes !== 0) run.note('dossiers', 'Échap ne devait rien écrire');
    await clickKey('dossiers', '.trash-bar .btn');
    await expect('dossiers', 'la question devait se rouvrir', s => s.modal && s.modal.focus === 'rx-accept');
    await clickKey('dossiers', '[data-fk="rx-accept"]');
    const accepted2 = await expect('dossiers', '« Accepter » devait fermer la question, enlever la barre et dégriser les fichiers', s => s.modal === null && s.bar === null && s.rows.every(each => !each.grey));
    const bulk = accepted2.marks.filter(([name]) => /^(Avenant 1|Contrat de prestation)\.pdf$/.test(name)).map(([, yes, no]) => `${yes}/${no}`).join(',');
    if (bulk !== 'true/false,true/false') run.note('dossiers', `les deux fichiers qui attendaient devaient être marqués acceptés (${bulk})`);
    if (accepted2.writes !== 1) run.note('dossiers', `la réponse devait tenir en UNE écriture groupée (les colonnes de marques existent déjà) : ${accepted2.writes} actions`);
    if (!accepted2.notices.includes(t('rx.folder.accepted', { name: 'Contrats', n: 2 }))) run.note('dossiers', 'la phrase devait dire que le dossier est accepté');
    if (!accepted2.focusKey) run.note('dossiers', 'le clavier devait revenir dans la liste (la barre et son bouton ont disparu)');
    await page.press('Backspace');
    const after = await expect('dossiers', 'Retour arrière devait fonctionner tout de suite après la réponse', s => s.rows.some(each => each.folder));
    if (after.rail && after.rail.count !== '1') run.note('dossiers', `le volet devait ne compter que le fichier seul (1), il dit ${after.rail && after.rail.count}`);
    if (row(after, 'Contrats') && row(after, 'Contrats').grey) run.note('dossiers', '« Contrats » entièrement accepté ne devait plus être grisé');

    // Le menu d'un dossier reçu : l'ouvrir et répondre, rien d'autre ; un dossier entièrement accepté ne propose plus la réponse.
    await run.reset();
    await page.run(() => window.__shared('dossier'));
    await expect('dossiers', 'rouvrir la vue', s => s.rows.length === 3);
    await page.run(name => { const found = [...document.querySelectorAll('.ls-row.folder')].find(item => item.querySelector('.t').textContent === name); found.querySelector('.rb.mn').click(); }, 'Contrats');
    const folderMenu = await expect('dossiers', 'le menu du dossier devait s\'ouvrir', s => s.menu.length > 0);
    if (JSON.stringify(folderMenu.menu.map(item => item.label)) !== JSON.stringify([t('ex.openFolder'), t('rx.folder.answer')])) run.note('dossiers', `le menu devait offrir « ${t('ex.openFolder')} » et « ${t('rx.folder.answer')} » seulement (il offre ${JSON.stringify(folderMenu.menu.map(item => item.label))})`);
    await page.press('Escape');
    await page.run(name => { const found = [...document.querySelectorAll('.ls-row.folder')].find(item => item.querySelector('.t').textContent === name); found.querySelector('.rb.mn').click(); }, 'Archives');
    const archivesMenu = await expect('dossiers', 'le menu du dossier accepté devait s\'ouvrir', s => s.menu.length > 0);
    if (JSON.stringify(archivesMenu.menu.map(item => item.label)) !== JSON.stringify([t('ex.openFolder')])) run.note('dossiers', `un dossier tout accepté devait n'offrir que « ${t('ex.openFolder')} » (il offre ${JSON.stringify(archivesMenu.menu.map(item => item.label))})`);
    await page.press('Escape');

    // La cloche : une ligne pour le dossier (ses fichiers à accepter), une pour le fichier seul.
    await clickKey('la cloche', '.tb-bell');
    const folderBell = await expect('la cloche', 'le menu de la cloche devait s\'ouvrir', s => s.menu.length > 0);
    const bellLabels = folderBell.menu.map(item => item.label);
    if (bellLabels.length !== 3 || bellLabels[0] !== t('nt.folder', { name: 'Contrats', by: 'Comptabilité', n: 2 }) || bellLabels.at(-1) !== t('nt.open')) run.note('la cloche', `la cloche devait dire une ligne pour le dossier puis une pour le fichier seul (elle dit ${JSON.stringify(bellLabels)})`);
    await clickKey('la cloche', '.menu .menu-item');
    const fromFolder = await expect('la cloche', 'la ligne du dossier devait poser la question du DOSSIER', s => s.modal && s.modal.focus === 'rx-accept');
    if (fromFolder.modal && fromFolder.modal.title !== t('rx.folder.title', { name: 'Contrats' })) run.note('la cloche', `la question devait nommer le dossier (« ${fromFolder.modal.title} »)`);
    await page.press('Escape');

    // Un document en lecture seule : la phrase, pas de fenêtre.
    await run.reset();
    await page.run(() => { window.__sharedBlocked = 'Document en lecture seule.'; return window.__shared('arrivees'); });
    await clickRow('Devis.pdf');
    await page.press('Enter');
    const blocked = await expect('lecture seule', 'la phrase devait dire pourquoi rien ne s\'écrit', s => s.notices.includes('Document en lecture seule.'));
    if (blocked.modal) run.note('lecture seule', 'aucune fenêtre ne devait s\'ouvrir');
    if (blocked.writes !== 0) run.note('lecture seule', 'rien ne devait s\'écrire');

    // Moi et Récents ne montrent pas les arrivées ; une vue sans arrivée n'est pas une page blanche.
    await clickKey('Moi', '.tr-row[data-path=""]');
    const me = await expect('Moi', '« Moi » devait être la vue courante', s => s.crumbs && !s.crumbs.includes(t('rx.view')));
    if (me.rows.some(each => each.name === 'Devis.pdf' || each.name === LONG)) run.note('Moi', 'les arrivées d\'un autre document ne devaient pas être dans « Moi »');
    if (await clickKey('la cloche', '.tb-bell')) {
      await expect('la cloche', 'le menu de la cloche devait s\'ouvrir depuis « Moi »', s => s.menu.length > 0);
      await clickKey('la cloche', '.menu .menu-item:last-child');
      const toShared = await expect('la cloche', '« Ouvrir « Partagés avec moi » » devait mener à la vue', s => s.crumbs && s.crumbs.includes(t('rx.view')));
      if (toShared.rail && !toShared.rail.current) run.note('la cloche', 'la vue « Partagés avec moi » devait être la vue courante');
    }
    await run.reset();
    await page.run(() => window.__shared('vide'));
    const empty = await expect('vue vide', 'une vue sans arrivée devait dire quoi faire', s => s.empty === t('rx.empty'));
    if (empty.rows.length) run.note('vue vide', 'aucune ligne ne devait y être');
    if (empty.rail && empty.rail.count !== null) run.note('vue vide', 'le volet ne devait porter aucun nombre');
    if (!empty.bell || empty.bell.badge !== null || empty.bell.label !== t('nt.tip')) run.note('vue vide', `la cloche devait rester là, sans nombre (${JSON.stringify(empty.bell && [empty.bell.badge, empty.bell.label])})`);
    if (await clickKey('la cloche', '.tb-bell')) {
      const none = await expect('la cloche', 'le menu devait s\'ouvrir sans arrivée', s => s.menu.length > 0);
      if (none.menu[0].label !== t('nt.none') || none.menu.at(-1).label !== t('nt.open')) run.note('la cloche', `sans arrivée, le menu devait dire « ${t('nt.none')} » et garder « ${t('nt.open')} » (${JSON.stringify(none.menu)})`);
      await clickKey('la cloche', '.menu .menu-item');
      await expect('la cloche', 'la ligne grisée devait dire ce qui s\'annonce ici', s => s.notices.includes(t('nt.noneWhy')));
    }

    // Un fichier arrive PENDANT que l'explorateur est ouvert : la ligne, le nombre du volet et la cloche se mettent à jour seuls, la ligne choisie reste choisie.
    await run.reset();
    await page.run(() => window.__shared('arrivees'));
    await clickRow('Devis.pdf');
    await expect('une arrivée', 'la ligne choisie devait l\'être', s => s.selected === 'Devis.pdf');
    await page.run(() => window.__arrive('Avenant.pdf'));
    const arrived = await expect('une arrivée', 'la nouvelle arrivée devait s\'ajouter à la liste ouverte, à accepter', s => names(s).includes('Avenant.pdf'));
    if (!row(arrived, 'Avenant.pdf') || !row(arrived, 'Avenant.pdf').grey || row(arrived, 'Avenant.pdf').pill !== t('rx.pending')) run.note('une arrivée', `« Avenant.pdf » devait arriver grisé, avec le mot « ${t('rx.pending')} » (il est ${JSON.stringify(row(arrived, 'Avenant.pdf'))})`);
    if (!arrived.rail || arrived.rail.count !== '3') run.note('une arrivée', `le volet devait dire 3 à accepter (il dit ${arrived.rail && arrived.rail.count})`);
    if (!arrived.bell || arrived.bell.badge !== '3' || arrived.bell.label !== t('nt.tipCount', { n: 3 })) run.note('une arrivée', `la cloche devait dire 3 à accepter (elle dit ${JSON.stringify(arrived.bell && [arrived.bell.badge, arrived.bell.label])})`);
    if (arrived.selected !== 'Devis.pdf') run.note('une arrivée', `la ligne choisie devait rester choisie (c'est « ${arrived.selected} »)`);
    if (arrived.modal || arrived.writes !== 0) run.note('une arrivée', 'une arrivée ne devait ni ouvrir de fenêtre ni rien écrire');
  } catch (error) {
    run.note('geste impossible', String(error.message).slice(0, 200));
    await page.press('Escape').catch(() => {});
  }
  await run.reset();
  return found;
}
