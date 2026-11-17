// La vitrine de la fenêtre « Apps et extensions » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; décision du porteur du 17/11,
// « A · Vitrine »). La vraie fenêtre, le vrai modèle et le vrai catalogue de GFS sur les quatre manifestes (`window.__vitrine`, test/pages/explorateur.js), à 700 × 400 ; la vraie souris et le vrai
// clavier. À mesurer : la mosaïque (trois colonnes, quatre cartes dans la fenêtre, rien qui déborde, la vignette d'attente), « Installer » (la carte passe à « Ouvrir », le compte monte, le clavier
// suit), la fiche (un clic sur le nom ou la capture, Échap qui revient au même nom et au même défilement, le lien vers les extensions, une extension qui se coche), l'ordre de Tab, la lecture
// seule et l'app refusée (grisées, avec leur raison au clic), les captures (un fichier qui se charge, un fichier absent qui laisse la vignette d'attente), la fenêtre étroite (deux colonnes, une colonne),
// le contraste des textes de la vitrine.
import { createI18n } from '../js/i18n/i18n.js';

// Ce que la fenêtre montre : la fenêtre, les cartes (place, nom, texte, bouton, vignette), les colonnes, le compte, le pied, le clavier.
function grid() {
  const modal = document.querySelector('.mod-scrim .mod');
  const gridNode = modal && modal.querySelector('.ap-grid');
  if (!gridNode) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const body = modal.querySelector('.mod-body');
  const cards = [...gridNode.querySelectorAll('.ap-card')].map(card => {
    const button = card.querySelector('.ap-act .btn');
    const image = card.querySelector('.ap-shot img');
    return { id: card.dataset.app, box: box(card), name: card.querySelector('.ap-name').textContent, text: card.querySelector('.ap-text').textContent, locked: card.classList.contains('is-locked'),
      button: button.textContent.trim(), disabled: button.getAttribute('aria-disabled') === 'true', buttonKey: button.dataset.fk, badge: (card.querySelector('.badge') || {}).textContent || null,
      warn: (card.querySelector('.ap-warn') || {}).textContent || null, placeholder: Boolean(card.querySelector('.ap-shot .ap-ph')), placeholderName: (card.querySelector('.ap-ph-name') || {}).textContent || null,
      image: image ? { loaded: image.complete && image.naturalWidth > 0 } : null, shot: box(card.querySelector('.ap-shot')), overflow: card.scrollWidth - card.clientWidth };
  });
  return { window: box(modal), body: { overflow: body.scrollWidth - body.clientWidth, top: body.scrollTop, max: body.scrollHeight - body.clientHeight }, cards, columns: new Set(cards.map(card => Math.round(card.box.left))).size,
    count: (modal.querySelector('.mod-count') || {}).textContent || '', note: modal.querySelector('.mod-note').textContent, focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null,
    title: modal.querySelector('h2').textContent, events: window.__vitrineEvents };
}

// La fiche d'une app : son en-tête, la galerie, la description, les faits, l'état des extensions.
function fiche() {
  const modal = document.querySelector('.mod-scrim .mod');
  const page = modal && modal.querySelector('.ap-fiche');
  if (!page) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const body = modal.querySelector('.mod-body');
  const head = modal.querySelector('.mod-head');
  const big = page.querySelector('.ap-big');
  const image = big.querySelector('img');
  const link = page.querySelector('.ap-link');
  const section = page.querySelector('.ap-sect');
  const headButtons = [...head.querySelectorAll('.ap-head-acts .btn')].map(button => ({ text: button.textContent.trim(), disabled: button.getAttribute('aria-disabled') === 'true', key: button.dataset.fk }));
  return { window: box(modal), title: head.querySelector('h2').textContent, back: head.querySelector('.ap-back').textContent.trim(), buttons: headButtons, count: head.querySelector('.mod-count').textContent,
    long: page.querySelector('.ap-long').textContent, facts: page.querySelector('.ap-facts').textContent, big: box(big), bigImage: image ? { loaded: image.complete && image.naturalWidth > 0 } : null,
    bigPlaceholder: Boolean(big.querySelector('.ap-ph')), thumbs: [...page.querySelectorAll('.ap-thumb')].map(thumb => ({ current: thumb.getAttribute('aria-current') === 'true', key: thumb.dataset.fk,
      placeholder: Boolean(thumb.querySelector('.ap-ph')), image: Boolean(thumb.querySelector('img')) })), caption: (page.querySelector('.ap-cap') || {}).textContent || null,
    link: link ? link.textContent.trim() : null, section: section ? { top: box(section).top, rows: section.querySelectorAll('.mr').length, active: section.querySelector('h3').textContent } : null,
    natives: Boolean(page.querySelector('.mr-natives')), hint: [...page.querySelectorAll('.ap-about .mr-note')].map(node => node.textContent), body: { overflow: body.scrollWidth - body.clientWidth, top: body.scrollTop, bottom: box(body).bottom, topEdge: box(body).top },
    focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null, events: window.__vitrineEvents,
    checks: [...page.querySelectorAll('.ap-sect input[type=checkbox]')].map(input => ({ key: input.dataset.fk, checked: input.checked, disabled: input.disabled })), note: modal.querySelector('.mod-note').textContent };
}

// Le centre, en pixels de la page, d'un élément amené dans la fenêtre : le clic s'y fait à la vraie souris.
function centerOf(selector) {
  const node = document.querySelector(selector);
  if (!node) return null;
  node.scrollIntoView({ block: 'nearest' });
  const r = node.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

// Le contraste des textes de la vitrine : le texte d'une carte, le nom de la vignette d'attente, le texte du bouton grisé, le bouton « Installer ».
function contrasts() {
  const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const light = ([r, g, b]) => { const f = c => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (front, back) => { const a = light(rgb(front)); const b = light(rgb(back)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const of = (selector, backSelector) => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const back = backSelector === null ? node : (backSelector ? node.closest(backSelector) : node);
    return ratio(getComputedStyle(node).color, getComputedStyle(back).backgroundColor);
  };
  return { text: of('.ap-card .ap-text', '.ap-card'), name: of('.ap-card .ap-name', '.ap-card'), placeholder: of('.ap-shot .ap-ph-name', '.ap-shot'),
    install: of('.ap-card .btn.primary:not([aria-disabled="true"])', null), disabled: of('.ap-card .btn.primary[aria-disabled="true"]', null) };
}

const ids = cards => cards.map(card => card.id).join();

// La mosaïque au départ : quatre cartes, trois colonnes, dans la fenêtre, la vignette d'attente, l'état de chacune.
async function gridProblems(page, t, note) {
  await page.run(() => window.__vitrine('ok'));
  let s = await page.until(grid);
  if (ids(s.cards) !== 'publipostage,automation,form,bi') note('cartes', `la mosaïque devrait montrer les quatre apps du catalogue dans l'ordre : ${ids(s.cards)}`);
  if (s.columns !== 3) note('colonnes', `à 700 px la mosaïque devrait poser trois colonnes : ${s.columns}`);
  if (s.body.overflow > 1) note('débordement', `la mosaïque déborde la fenêtre de ${s.body.overflow} px`);
  if (s.title !== t('mod.title')) note('titre', `le titre devrait être « ${t('mod.title')} » : « ${s.title} »`);
  for (const card of s.cards) {
    if (card.box.left < s.window.left || card.box.right > s.window.right) note('carte hors de la fenêtre', `« ${card.name} » sort de la fenêtre`);
    if (card.overflow > 1) note('carte coupée', `« ${card.name} » déborde de ${card.overflow} px`);
    if (!card.placeholder || card.placeholderName !== card.name) note('vignette d\'attente', `« ${card.name} » sans capture devrait montrer son icône et son nom (vignette : ${card.placeholder}, nom : ${card.placeholderName})`);
    if (card.shot.height < 40) note('vignette', `la vignette de « ${card.name} » est trop basse : ${card.shot.height.toFixed(0)} px`);
  }
  const [first, second, , fourth] = s.cards;
  if (s.cards.length === 4 && first.box.top > s.window.bottom - 60) note('première rangée', 'la première rangée devrait se voir dans la fenêtre');
  if (s.cards.length === 4 && Math.abs(first.box.top - second.box.top) > 1) note('rangée', 'les trois premières cartes devraient être sur la même rangée');
  if (s.cards.length === 4 && fourth.box.top < first.box.bottom - 1) note('cartes superposées', 'la quatrième carte recouvre la première rangée');
  const [pp, au] = [s.cards[0], s.cards[1]];
  if (pp && (pp.button !== t('mod.open') || !pp.badge || !pp.badge.includes(t('mod.badge.on')))) note('app installée', `Publipostage+ (toujours active) devrait dire « ${t('mod.badge.on')} » et proposer « ${t('mod.open')} » : ${pp.badge} / ${pp.button}`);
  if (au && (au.button !== t('ap.install') || au.badge || au.disabled)) note('app à installer', `Automation+ devrait proposer « ${t('ap.install')} », libre, sans pastille : ${au.button} / ${au.badge} / ${au.disabled}`);
  if (s.count !== `${t('mod.count', { n: 1, total: 9 })} · ${t('mod.countNote')}`) note('compte', `le compte devrait dire « ${t('mod.count', { n: 1, total: 9 })} » : « ${s.count} »`);
  if (s.note !== t('mod.saved')) note('pied', `le pied devrait dire « ${t('mod.saved')} » : « ${s.note} »`);
  if (s.focused !== 'name:publipostage') note('clavier', `à l'ouverture le clavier devrait être sur le premier nom : ${s.focused}`);
  const ratios = await page.run(contrasts);
  for (const [what, value] of Object.entries(ratios)) if (value !== null && value < 4.5) note('contraste', `le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
  return s;
}

// « Installer » à la vraie souris : un seul geste envoyé, la carte passe à « Ouvrir » avec sa pastille, le compte monte, le clavier est sur « Ouvrir ».
async function installProblems(page, t, note) {
  const at = await page.run(centerOf, '[data-app="automation"] .ap-act .btn');
  await page.click(...at);
  const s = await page.until(() => { const g = grid(); return g && g.cards[1].button && g.events.length ? g : null; });
  if (JSON.stringify(s.events) !== JSON.stringify([['app', 'automation', true]])) note('installer', `un clic sur « Installer » a envoyé ${JSON.stringify(s.events)}`);
  const au = s.cards[1];
  if (au.button !== t('mod.open') || !au.badge || !au.badge.includes(t('mod.badge.on'))) note('installer', `après le clic Automation+ devrait proposer « ${t('mod.open')} » avec « ${t('mod.badge.on')} » : ${au.button} / ${au.badge}`);
  if (s.count !== `${t('mod.count', { n: 2, total: 9 })} · ${t('mod.countNote')}`) note('installer', `le compte devrait monter à « ${t('mod.count', { n: 2, total: 9 })} » : « ${s.count} »`);
  if (s.focused !== 'open:automation') note('installer', `le clavier devrait suivre sur « ${t('mod.open')} » : ${s.focused}`);
}

// Le refus d'un geste (la personne refuse de créer la table du document) : l'état d'avant revient, « Installer » prend la place d'« Ouvrir » et le clavier le suit (labo « vrai Grist », 17/11).
async function undoProblems(page, t, note) {
  await page.click(...await page.run(centerOf, '[data-app="bi"] .ap-act .btn'));
  await page.until(() => { const g = grid(); return g && g.focused === 'open:bi' ? g : null; });
  await page.run(() => window.__vitrineUndo());
  const s = await page.until(grid);
  const bi = s.cards.find(card => card.id === 'bi');
  if (bi.button !== t('ap.install')) note('refus', `après le refus la carte devrait proposer « ${t('ap.install')} » : ${bi.button}`);
  if (s.focused !== 'app:bi') note('refus', `après le refus le clavier devrait suivre sur « ${t('ap.install')} » : ${s.focused}`);
}

// La fiche : un clic sur le nom, la galerie d'attente, la description, « Installer » dans l'en-tête, Échap qui revient au même nom et au même défilement.
async function ficheProblems(page, t, note) {
  await page.run(() => { const body = document.querySelector('.mod-body'); body.scrollTop = Math.min(30, body.scrollHeight - body.clientHeight); });
  const before = (await page.run(grid)).body.top;
  const card = (await page.run(grid)).cards.find(item => item.id === 'form');
  await page.click(...await page.run(centerOf, '[data-fk="name:form"]'));
  let f = await page.until(fiche);
  if (f.title !== 'Form+' || f.back !== t('ap.back')) note('fiche', `un clic sur le nom devrait ouvrir la fiche de Form+ avec « ${t('ap.back')} » : ${f.title} / ${f.back}`);
  if (f.focused !== 'back') note('fiche', `le clavier devrait être sur « ${t('ap.back')} » : ${f.focused}`);
  if (f.long !== card.text) note('fiche', `sans description à elle, la fiche reprend le texte de la carte : « ${f.long} »`);
  if (!f.bigPlaceholder || f.bigImage || f.thumbs.length) note('galerie d\'attente', `sans capture la fiche montre la vignette d'attente, sans bande de petites vues (grande : ${f.bigPlaceholder}, bande : ${f.thumbs.length})`);
  if (f.facts !== t('ap.version', { v: '0.1.0' })) note('fiche', `les faits devraient dire la version : « ${f.facts} »`);
  if (JSON.stringify(f.buttons.map(item => item.text)) !== JSON.stringify([t('ap.install')]) || f.buttons[0].disabled) note('fiche', `Form+ n'est pas installée : l'en-tête devrait proposer seulement « ${t('ap.install')} » : ${JSON.stringify(f.buttons)}`);
  if (f.body.overflow > 1) note('fiche', `la fiche déborde la fenêtre de ${f.body.overflow} px`);
  if (f.window.bottom > 400 || f.big.right > f.window.right) note('fiche', 'la fiche sort de la fenêtre');
  await page.click(...await page.run(centerOf, '[data-fk="app:form"]'));
  f = await page.until(() => { const x = fiche(); return x && x.buttons.some(item => item.text === 'Retirer' || item.text === 'Remove') ? x : null; });
  if (JSON.stringify(f.buttons.map(item => item.text)) !== JSON.stringify([t('ap.remove'), t('mod.open')])) note('fiche', `Form+ installée : l'en-tête devrait proposer « ${t('ap.remove')} » puis « ${t('mod.open')} » : ${JSON.stringify(f.buttons)}`);
  if (f.focused !== 'open:form') note('fiche', `après « ${t('ap.install')} » le clavier devrait être sur « ${t('mod.open')} » : ${f.focused}`);
  await page.press('Escape');
  const s = await page.until(grid);
  if (s.focused !== 'name:form') note('retour', `Échap devrait ramener le clavier sur le nom de Form+ : ${s.focused}`);
  if (Math.abs(s.body.top - before) > 1) note('retour', `la mosaïque devrait retrouver son défilement (${before} px) : ${s.body.top} px`);
  if (!s.window.right) note('retour', 'la fenêtre ne devrait pas se fermer sur le premier Échap');
  await page.click(...await page.run(centerOf, '[data-app="bi"] .ap-shot'));
  f = await page.until(fiche);
  if (f.title !== 'Grist-BI') note('fiche', `un clic sur la capture devrait ouvrir la fiche de Grist-BI : ${f.title}`);
  await page.click(...await page.run(centerOf, '[data-fk="back"]'));
  await page.until(grid);
}

// La fiche de Publipostage+ : ses bibliothèques, ses extensions, le lien qui y mène, une extension cochée.
async function extensionsProblems(page, t, note) {
  await page.click(...await page.run(centerOf, '[data-fk="name:publipostage"]'));
  let f = await page.until(fiche);
  if (!f.natives) note('bibliothèques', 'la fiche de Publipostage+ devrait porter le choix de ses bibliothèques natives');
  if (f.buttons.map(item => item.text).join() !== t('mod.open')) note('fiche', `Publipostage+ est toujours active : pas de « ${t('ap.remove')} », seulement « ${t('mod.open')} » : ${JSON.stringify(f.buttons)}`);
  if (!f.facts.includes(t('mod.always').replace(/\.$/, ''))) note('fiche', `les faits devraient dire que l'app est toujours active : « ${f.facts} »`);
  if (!f.section || f.section.rows !== 5 || f.link !== t('ap.extCount', { n: 5 })) note('extensions', `la fiche devrait montrer cinq extensions et un lien « ${t('ap.extCount', { n: 5 })} » : ${JSON.stringify(f.section)} / ${f.link}`);
  await page.click(...await page.run(centerOf, '[data-fk="to-ext"]'));
  f = await page.until(fiche);
  if (f.section && Math.abs(f.section.top - f.body.topEdge) > 40) note('lien des extensions', `le lien devrait amener les extensions en haut de la fenêtre (écart ${(f.section.top - f.body.topEdge).toFixed(0)} px)`);
  await page.click(...await page.run(centerOf, '[data-fk="ext:publipostage/graphique"]'));
  f = await page.until(() => { const x = fiche(); return x && x.events.some(event => event[0] === 'extension') ? x : null; });
  if (JSON.stringify(f.events.filter(event => event[0] === 'extension')) !== JSON.stringify([['extension', 'publipostage', 'graphique', true]])) note('extension', `cocher « Graphique » a envoyé ${JSON.stringify(f.events)}`);
  if (!f.checks.find(item => item.key === 'ext:publipostage/graphique').checked) note('extension', 'la case « Graphique » devrait rester cochée après le geste');
  if (f.body.top < 20) note('extension', 'la fiche ne devrait pas remonter en haut après un geste');
  await page.press('Escape');
  await page.until(grid);
}

// L'ordre de Tab sur la mosaïque : chaque nom puis son bouton, « Fermer », puis le retour au premier ; la capture n'est jamais un arrêt.
async function keyboardProblems(page, note) {
  await page.run(() => window.__vitrine('ok'));
  await page.until(grid);
  const order = [];
  for (let step = 0; step < 9; step += 1) { await page.press('Tab'); order.push((await page.run(grid)).focused); }
  const expected = 'open:publipostage,name:automation,app:automation,name:form,app:form,name:bi,app:bi,close,name:publipostage';
  if (order.join() !== expected) note('Tab', `l'ordre de Tab devrait être ${expected} : ${order.join()}`);
  await page.press('Escape');
  await page.until(() => !document.querySelector('.mod-scrim'), [], 2000);
}

// « Ouvrir » (la carte, puis l'en-tête de la fiche) : un seul appel `open` avec l'identifiant de l'app, et la fenêtre se ferme (le labo « vrai Grist » l'a trouvé le 17/11 : l'identifiant manquait).
async function openProblems(page, note) {
  const closed = () => !document.querySelector('.mod-scrim');
  await page.run(() => window.__vitrine('ok'));
  await page.until(grid);
  await page.click(...await page.run(centerOf, '[data-fk="open:publipostage"]'));
  await page.until(closed, [], 2000);
  let events = await page.run(() => window.__vitrineEvents);
  if (JSON.stringify(events) !== JSON.stringify([['open', 'publipostage']])) note('ouvrir', `« Ouvrir » sur la carte a envoyé ${JSON.stringify(events)}`);
  await page.run(() => window.__vitrine('ok'));
  await page.until(grid);
  await page.click(...await page.run(centerOf, '[data-fk="name:publipostage"]'));
  await page.until(fiche);
  await page.click(...await page.run(centerOf, '.ap-head-acts [data-fk="open:publipostage"]'));
  await page.until(closed, [], 2000);
  events = await page.run(() => window.__vitrineEvents);
  if (JSON.stringify(events) !== JSON.stringify([['open', 'publipostage']])) note('ouvrir', `« Ouvrir » dans l'en-tête de la fiche a envoyé ${JSON.stringify(events)}`);
}

// L'app refusée et le document en lecture seule : grisés avec leur texte lisible, un clic dit pourquoi dans le pied et n'envoie rien.
async function blockedProblems(page, t, note) {
  await page.run(() => window.__vitrine('refusee'));
  let s = await page.until(grid);
  const bi = s.cards.find(card => card.id === 'bi');
  const reason = t('mod.invalid', { reasons: 'version « 1.0 » : une version exacte est attendue' });
  if (!bi.locked || !bi.disabled || !bi.badge.includes(t('mod.badge.locked')) || bi.warn !== reason) note('app refusée', `Grist-BI refusée devrait être grisée, « ${t('mod.badge.locked')} », avec sa raison : ${JSON.stringify(bi)}`);
  await page.click(...await page.run(centerOf, '[data-app="bi"] .ap-act .btn'));
  s = await page.run(grid);
  if (s.events.length || s.note !== reason) note('app refusée', `un clic sur « ${t('ap.install')} » grisé ne devrait rien envoyer et dire la raison dans le pied (envoyé : ${JSON.stringify(s.events)}, pied : « ${s.note} »)`);
  const ratios = await page.run(contrasts);
  if (ratios.disabled !== null && ratios.disabled < 4.5) note('contraste', `le bouton grisé est trop pâle (contraste ${ratios.disabled.toFixed(2)}, 4,5 attendu)`);
  await page.press('Escape');
  await page.until(() => !document.querySelector('.mod-scrim'), [], 2000);
  await page.run(() => window.__vitrine('lecture'));
  s = await page.until(grid);
  if (s.note !== t('mod.readonly')) note('lecture seule', `le pied devrait dire « ${t('mod.readonly')} » : « ${s.note} »`);
  const grey = s.cards.filter(card => card.button === t('ap.install'));
  if (grey.length !== 3 || grey.some(card => !card.disabled)) note('lecture seule', `en lecture seule les trois « ${t('ap.install')} » devraient être grisés : ${JSON.stringify(grey.map(card => card.disabled))}`);
  await page.click(...await page.run(centerOf, '[data-app="form"] .ap-act .btn'));
  s = await page.run(grid);
  if (s.events.length) note('lecture seule', `un clic sur « ${t('ap.install')} » grisé a envoyé ${JSON.stringify(s.events)}`);
  await page.click(...await page.run(centerOf, '[data-fk="name:automation"]'));
  const f = await page.until(fiche);
  if (JSON.stringify(f.hint) !== JSON.stringify([t('ap.noNatives')]) || f.natives) note('fiche', `la fiche d'Automation+ n'a pas de bibliothèque à choisir et devrait le dire : ${JSON.stringify(f.hint)}`);
  await page.press('Escape');
  await page.press('Escape');
  await page.until(() => !document.querySelector('.mod-scrim'), [], 2000);
}

// Les captures : une qui se charge dans la carte, la grande vue et la bande ; une absente, remplacée par la vignette d'attente ; la légende change avec la vignette cliquée.
async function capturesProblems(page, t, note) {
  await page.run(() => window.__vitrine('captures'));
  let s = await page.until(() => { const g = grid(); return g && g.cards[0].image && g.cards[0].image.loaded ? g : null; });
  if (!s.cards[0].image || !s.cards[0].image.loaded || s.cards[0].placeholder) note('captures', `la carte de Publipostage+ devrait montrer sa première capture, sans vignette d'attente : ${JSON.stringify(s.cards[0].image)}`);
  if (s.cards.slice(1).some(card => card.image)) note('captures', 'les autres cartes n\'ont pas de capture : seule la vignette d\'attente');
  await page.click(...await page.run(centerOf, '[data-fk="name:publipostage"]'));
  let f = await page.until(() => { const x = fiche(); return x && x.bigImage && x.bigImage.loaded && x.thumbs.length === 2 && x.thumbs[1].placeholder ? x : null; });
  const caption = language => (language === 'fr' ? ['Première capture', 'Deuxième capture'] : ['First screenshot', 'Second screenshot']);
  const [first, second] = caption(t('ap.back') === 'Apps' && t('mod.open') === 'Ouvrir' ? 'fr' : 'en');
  if (f.long !== (t('mod.open') === 'Ouvrir' ? 'Une description longue de Publipostage+.' : 'A long description of Publipostage+.')) note('description', `la fiche devrait montrer la description de la vitrine : « ${f.long} »`);
  if (f.caption !== first || !f.thumbs[0].current || f.thumbs[1].current) note('galerie', `la première capture devrait être en grand avec sa légende « ${first} » : ${f.caption} / ${JSON.stringify(f.thumbs)}`);
  if (!f.thumbs[1].placeholder || f.thumbs[1].image) note('capture absente', 'la capture dont le fichier est absent devrait laisser la vignette d\'attente dans la bande');
  await page.click(...await page.run(centerOf, '[data-fk="shot:1"]'));
  f = await page.until(() => { const x = fiche(); return x && x.thumbs[1] && x.thumbs[1].current ? x : null; });
  if (f.caption !== second || f.thumbs[0].current) note('galerie', `un clic sur la deuxième vignette devrait en montrer la légende « ${second} » : ${f.caption}`);
  await page.until(() => { const x = fiche(); return x && x.bigPlaceholder ? x : null; }, [], 3000).catch(() => note('capture absente', 'la grande vue de la capture absente devrait montrer la vignette d\'attente'));
  if ((await page.run(fiche)).focused !== 'shot:1') note('galerie', `le clavier devrait rester sur la vignette cliquée : ${(await page.run(fiche)).focused}`);
  await page.press('Escape');
  await page.press('Escape');
  await page.until(() => !document.querySelector('.mod-scrim'), [], 2000);
}

// La fenêtre étroite : deux colonnes à 560 px, une à 480 px ; rien ne déborde.
async function narrowProblems(page, mode, note) {
  for (const [width, columns] of [[560, 2], [480, 1]]) {
    await page.view({ width, scale: 1, mode });
    await page.run(() => window.__vitrine('ok'));
    const s = await page.until(grid);
    if (s.columns !== columns) note('fenêtre étroite', `à ${width} px la mosaïque devrait poser ${columns} colonne(s) : ${s.columns}`);
    if (s.body.overflow > 1 || s.cards.some(card => card.box.right > s.window.right || card.box.left < s.window.left)) note('fenêtre étroite', `à ${width} px une carte déborde la fenêtre`);
    await page.click(...await page.run(centerOf, '[data-fk="name:publipostage"]'));
    const f = await page.until(fiche);
    if (f.body.overflow > 1 || f.big.right > f.window.right) note('fenêtre étroite', `à ${width} px la fiche déborde la fenêtre`);
    await page.press('Escape');
    await page.press('Escape');
    await page.until(() => !document.querySelector('.mod-scrim'), [], 2000);
  }
  await page.view({ width: 700, scale: 1, mode });
}

export async function vitrineProblems(page, language, tag, mode = 'light') {
  const found = [];
  const { t } = createI18n(language);
  const note = (kind, text) => found.push({ kind: `vitrine des apps : ${kind}`, text: `${tag} : ${text}` });
  // Une fonction passée à `page.run` s'exécute seule dans la page : celles qui en appellent d'autres (`grid`, `fiche`) y sont posées comme fonctions globales.
  await page.run((...sources) => { for (const source of sources) { const [name, body] = [source.match(/function (\w+)/)[1], source]; window[name] = (0, eval)(`(${body})`); } },
    grid.toString(), fiche.toString());
  try {
    await gridProblems(page, t, note);
    await installProblems(page, t, note);
    await undoProblems(page, t, note);
    await ficheProblems(page, t, note);
    await extensionsProblems(page, t, note);
    await page.press('Escape');
    await page.until(() => !document.querySelector('.mod-scrim'), [], 2000);
    await keyboardProblems(page, note);
    await openProblems(page, note);
    await blockedProblems(page, t, note);
    await capturesProblems(page, t, note);
    await narrowProblems(page, mode, note);
  } catch (error) {
    note('essai interrompu', String(error && error.message));
  }
  return found;
}
