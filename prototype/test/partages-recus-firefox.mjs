// « Partagés avec moi » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; ouverte depuis le volet de gauche, décision du 09/11). Le vrai explorateur, le vrai
// contrôle (js/received-control.js) et la vraie fenêtre « Accepter ? » (js/received-window.js) sur des arrivées que le vrai modèle lit dans un faux Grist en mémoire (test/pages/explorateur.js, `window.__shared`) ; ce que le
// moteur de Sync+ fait de ces tables se mesure dans un vrai Grist (labo/run-partages-recus.mjs). Ici, la mise en page à 700 × 400 et les gestes, à la vraie souris et au vrai clavier :
//   la vue : le nombre à accepter dans le volet, des lignes à plat (pas de dossier), les arrivées en attente grisées avec le mot « À accepter » et sans étoile, une arrivée acceptée comme un fichier, une arrivée que l'envoyeur
//   ne partage plus gardée comme un fichier, aucune arrivée refusée, aucun texte coupé sans son texte entier au survol ; une ligne choisie change le bouton principal en « Accepter ou refuser… » ;
//   la question : Entrée sur une ligne l'ouvre, le clavier est sur « Accepter », Tab reste dans la fenêtre, Échap ferme sans rien écrire ; le menu « ⋯ » n'offre que la réponse ;
//   « Refuser » masque la ligne et le dit, « Accepter » dégrise la ligne, les marques sont écrites sur LEUR ligne seulement ; un document en lecture seule dit pourquoi, sans fenêtre ; une vue sans arrivée n'est pas une page blanche.
import { createI18n } from '../js/i18n.js';
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
  const out = {
    cut,
    rail: rail ? { label: text(rail.querySelector('.lbl')), count: text(rail.querySelector('.cnt')), current: rail.getAttribute('aria-current') === 'true', grey: rail.getAttribute('aria-disabled') === 'true' } : null,
    rows: [...document.querySelectorAll('.ls-row')].map(row => ({ name: text(row.querySelector('.t')), folder: row.classList.contains('folder'), grey: row.classList.contains('lk'), pill: text(row.querySelector('.ty .pill')), pins: row.querySelectorAll('.rb.pin').length, key: row.dataset.key })),
    selected: text(document.querySelector('.ls-row[aria-selected="true"] .t')),
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
    if (done.rail && done.rail.count !== null) run.note('accepter', `plus rien à accepter : le volet ne devait plus porter de nombre (il dit ${done.rail.count})`);
    if (JSON.stringify(done.marks.find(([name]) => name === LONG)) !== JSON.stringify([LONG, true, false])) run.note('accepter', `la ligne devait être marquée acceptée (${JSON.stringify(done.marks.find(([name]) => name === LONG))})`);
    if (!done.notices.includes(t('rx.accepted', { name: LONG }))) run.note('accepter', 'la phrase devait dire que le fichier est accepté');

    // Une arrivée acceptée se choisit et s'ouvre comme un fichier ; son menu n'a plus la réponse.
    await clickRow('Contrat.pdf');
    const open = await expect('arrivée acceptée', 'le bouton principal devait redevenir « Ouvrir »', s => s.selected === 'Contrat.pdf' && s.openLabel === t('ex.open'));
    await page.press('Enter');
    if ((await expect('arrivée acceptée', 'Entrée devait ouvrir le fichier accepté', s => s.opened === 'Contrat.pdf')).modal) run.note('arrivée acceptée', 'un fichier accepté ne devait pas reposer la question');
    if (open.info && open.info.includes(t('rx.lock'))) run.note('arrivée acceptée', 'un fichier accepté n\'est plus grisé');

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
    await run.reset();
    await page.run(() => window.__shared('vide'));
    const empty = await expect('vue vide', 'une vue sans arrivée devait dire quoi faire', s => s.empty === t('rx.empty'));
    if (empty.rows.length) run.note('vue vide', 'aucune ligne ne devait y être');
    if (empty.rail && empty.rail.count !== null) run.note('vue vide', 'le volet ne devait porter aucun nombre');
  } catch (error) {
    run.note('geste impossible', String(error.message).slice(0, 200));
    await page.press('Escape').catch(() => {});
  }
  await run.reset();
  return found;
}
