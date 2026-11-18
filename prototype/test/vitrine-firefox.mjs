// La vitrine de la fenêtre « Apps et extensions » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; décisions du porteur du 17/11,
// « A · Vitrine » pour la mosaïque et « A · Page produit » pour la fiche). La vraie fenêtre, le vrai modèle et le vrai catalogue de GFS sur les quatre manifestes (`window.__vitrine`,
// test/pages/explorateur.js), à 700 × 400 ; la vraie souris et le vrai clavier. À mesurer : la mosaïque (trois colonnes, quatre cartes dans la fenêtre, rien qui déborde, la vignette d'attente),
// « Installer » (la carte passe à « Ouvrir », le compte monte, le clavier suit), la fiche (un clic sur le nom ou la capture, Échap qui revient au même nom et au même défilement, le bandeau et son
// bouton, la barre du haut qui reprend le nom et le bouton quand le bandeau est sorti de l'écran, les extensions en cartes qui s'ajoutent et se retirent, le lien qui y mène), l'ordre de Tab,
// la lecture seule et l'app refusée (grisées, avec leur raison au clic), les captures (une bande qui défile, un fichier qui se charge, un fichier absent qui laisse la vignette d'attente), la fenêtre
// étroite (deux colonnes, une colonne), les vitrines rendues par les apps le 17/11 (Publipostage+, Automation+, Form+, Grist-BI : leurs vraies images de GFS sur la carte et sur la fiche, légendes et description comprises), le contraste des textes, boutons grisés compris : l'opacité d'un bouton grisé compte (mesuré le 17/11 : « Installer » grisé tombait à 2:1).
import { createI18n } from '../js/i18n/i18n.js';
import { readJson } from './helpers.mjs';

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
    const level = card.querySelector('.lvl');
    return { id: card.dataset.app, box: box(card), name: card.querySelector('.ap-name').textContent, text: card.querySelector('.ap-text').textContent, locked: card.classList.contains('is-locked'),
      level: level ? level.textContent.replace(/\s+/g, ' ').trim() : null, levelTip: level ? level.title : null, button: button.textContent.trim(), disabled: button.getAttribute('aria-disabled') === 'true', buttonKey: button.dataset.fk, badge: (card.querySelector('.badge') || {}).textContent || null,
      warn: (card.querySelector('.ap-warn') || {}).textContent || null, placeholder: Boolean(card.querySelector('.ap-shot .ap-ph')), placeholderName: (card.querySelector('.ap-ph-name') || {}).textContent || null,
      image: image ? { loaded: image.complete && image.naturalWidth > 0 } : null, shot: box(card.querySelector('.ap-shot')), overflow: card.scrollWidth - card.clientWidth };
  });
  return { window: box(modal), body: { overflow: body.scrollWidth - body.clientWidth, top: body.scrollTop, max: body.scrollHeight - body.clientHeight }, cards, columns: new Set(cards.map(card => Math.round(card.box.left))).size,
    count: (modal.querySelector('.mod-count') || {}).textContent || '', note: modal.querySelector('.mod-note').textContent, focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null,
    title: modal.querySelector('h2').textContent, events: window.__vitrineEvents };
}

// La fiche d'une app : le bandeau et ses boutons, la barre du haut, les pastilles, les captures, les extensions en cartes, le choix des bibliothèques.
function fiche() {
  const modal = document.querySelector('.mod-scrim .mod');
  const page = modal && modal.querySelector('.fp-page');
  if (!page) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const body = modal.querySelector('.mod-body');
  const head = modal.querySelector('.mod-head');
  const hero = page.querySelector('.fp-hero');
  const strip = page.querySelector('.fp-strip');
  const button = node => ({ text: text(node), disabled: node.getAttribute('aria-disabled') === 'true', key: node.dataset.fk, box: box(node), shown: node.getClientRects().length > 0 });
  const about = page.querySelector('.fp-about .fp-long');
  const exts = page.querySelector('.fp-exts');
  const count = exts && exts.querySelector('.fp-count');
  const slides = [...page.querySelectorAll('.fp-slide')].map(slide => ({ caption: text(slide.querySelector('figcaption')), placeholder: Boolean(slide.querySelector('.ap-ph')), image: slide.querySelector('img') ? slide.querySelector('img').complete && slide.querySelector('img').naturalWidth > 0 : false, box: box(slide) }));
  const nav = dir => { const node = page.querySelector(`.fp-nav.${dir}`); return node ? { shown: node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden', disabled: node.disabled } : null; };
  return { window: box(modal), title: hero.querySelector('h1').firstChild.textContent, badge: Boolean(hero.querySelector('h1 .badge')), level: hero.querySelector('h1 .lvl') ? text(hero.querySelector('h1 .lvl')) : null, back: text(head.querySelector('.ap-back')), mini: head.classList.contains('is-mini'),
    miniButtons: [...head.querySelectorAll('.fp-head-cta .btn')].map(button), miniName: head.querySelector('.fp-mini strong') ? text(head.querySelector('.fp-mini strong')) : null, head: box(head),
    buttons: [...hero.querySelectorAll('.fp-cta .btn')].map(button), cta: box(hero.querySelector('.fp-cta-wrap')), hero: box(hero), tag: (hero.querySelector('.fp-tag') || {}).textContent || null,
    chips: [...hero.querySelectorAll('.fp-chips li')].map(text), link: hero.querySelector('.fp-chip-link') ? text(hero.querySelector('.fp-chip-link')) : null,
    about: about ? about.textContent : null, noShot: Boolean(page.querySelector('.fp-noshot')), strip: strip ? { scroll: strip.scrollLeft, max: strip.scrollWidth - strip.clientWidth, box: box(strip), tab: strip.getAttribute('tabindex') } : null, slides,
    prev: nav('prev'), next: nav('next'),
    section: exts ? { top: box(exts).top, count: count ? text(count) : null, note: exts.querySelector('.fp-note') ? text(exts.querySelector('.fp-note')) : null } : null,
    cards: [...page.querySelectorAll('.fp-ext')].map(card => ({ key: card.dataset.row, name: text(card.querySelector('h3')), on: card.classList.contains('is-on'), off: card.classList.contains('is-off'),
      added: Boolean(card.querySelector('.fp-added')), button: button(card.querySelector('.fp-ext-foot .btn')), box: box(card), overflow: card.scrollWidth - card.clientWidth, seg: Boolean(card.querySelector('.fp-seg')) })),
    libs: Boolean(page.querySelector('.fp-libs')), libsNote: [...page.querySelectorAll('.fp-libs > .fp-note')].map(text), choices: page.querySelectorAll('.fp-choice').length,
    body: { overflow: body.scrollWidth - body.clientWidth, top: body.scrollTop, max: body.scrollHeight - body.clientHeight, bottom: box(body).bottom, topEdge: box(body).top },
    focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null, events: window.__vitrineEvents, note: modal.querySelector('.mod-note').textContent };
}

// Le centre, en pixels de la page, d'un élément amené dans la fenêtre : le clic s'y fait à la vraie souris.
function centerOf(selector) {
  const node = document.querySelector(selector);
  if (!node) return null;
  node.scrollIntoView({ block: 'nearest' });
  const r = node.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

// Le contraste des textes de la vitrine, opacité comprise (un bouton grisé à 55 % d'opacité tombait à 2:1 sans que l'ancien essai le voie) : [le texte, le fond sur lequel il se pose].
const PROBES = {
  text: ['.ap-card .ap-text', '.ap-card'], name: ['.ap-card .ap-name', '.ap-card'], placeholder: ['.ap-shot .ap-ph-name', '.ap-shot'],
  install: ['.ap-card .btn.primary:not([aria-disabled="true"])', '.ap-card'], disabled: ['.ap-card .btn.primary[aria-disabled="true"]', '.ap-card'],
  tag: ['.fp-tag', '.fp-hero'], chip: ['.fp-chips li', '.fp-hero'], chipLink: ['.fp-chip-link', 'li'], heroInstall: ['.fp-hero .btn.primary:not([aria-disabled="true"])', '.fp-hero'],
  heroDisabled: ['.fp-hero .btn.primary[aria-disabled="true"]', '.fp-hero'], heroOpen: ['.fp-hero .btn.primary', '.fp-hero'], remove: ['.fp-hero .btn.quiet:not([aria-disabled="true"])', '.fp-hero'],
  removeDisabled: ['.fp-hero .btn.quiet[aria-disabled="true"]', '.fp-hero'], miniDisabled: ['.fp-head .btn.primary[aria-disabled="true"]', '.mod'],
  levelAlpha: ['.ap-card .lvl-alpha', '.ap-card'], levelBeta: ['.ap-card .lvl-beta', '.ap-card'], levelStable: ['.ap-card .lvl-stable', '.ap-card'], heroLevel: ['.fp-hero .lvl', '.fp-hero'],
  about: ['.fp-long', '.mod'], lead: ['.fp-lead', '.mod'], count: ['.fp-count', '.mod'], caption: ['.fp-slide figcaption', '.mod'], noShot: ['.fp-noshot', '.mod'],
  extText: ['.fp-ext-text', '.fp-ext'], extNote: ['.fp-ext .fp-note', '.fp-ext'], extAdd: ['.fp-ext .btn:not([aria-disabled="true"])', '.fp-ext'], extDisabled: ['.fp-ext .btn[aria-disabled="true"]', '.fp-ext'],
  added: ['.fp-added', '.fp-ext'], choiceDesc: ['.fp-choice-desc', '.fp-choice'], pill: ['.fp-pill', '.fp-choice'], seg: ['.fp-segs label', '.fp-segs'], summary: ['.fp-detail summary', '.mod'],
};

export function contrasts(probes) {
  const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const alphaOf = value => { const parts = value.match(/[\d.]+/g) || []; return parts.length > 3 ? Number(parts[3]) : 1; };
  const light = ([r, g, b]) => { const f = c => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (front, back) => { const a = light(front); const b = light(back); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const mix = (front, back, alpha) => front.map((channel, index) => channel * alpha + back[index] * (1 - alpha));
  const opacityOf = (node) => { let alpha = 1; for (let at = node; at && at.nodeType === 1; at = at.parentElement) alpha *= Number(getComputedStyle(at).opacity); return alpha; };
  const out = {};
  for (const [name, [selector, groundSelector]] of Object.entries(probes)) {
    const node = document.querySelector(selector);
    const ground = node && node.closest(groundSelector);
    if (!node || !ground) continue;
    const under = rgb(getComputedStyle(ground).backgroundColor);
    const own = getComputedStyle(node).backgroundColor;
    const back = alphaOf(own) > 0 ? rgb(own) : under;
    const alpha = opacityOf(node);
    out[name] = ratio(mix(rgb(getComputedStyle(node).color), under, alpha), mix(back, under, alpha));
  }
  return out;
}

// Les contrastes de l'écran où l'on est : ce qui est sous 4,5:1 est noté.
async function contrastProblems(page, note, where) {
  const ratios = await page.run(contrasts, PROBES);
  for (const [what, value] of Object.entries(ratios)) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
}

const ids = cards => cards.map(card => card.id).join();
// Le niveau que le manifeste donne à une app, tel que la pastille le dit (le préfixe lu par les lecteurs d'écran compris) : « Niveau : Alpha », « Niveau : V1.1 », ou null quand il n'en dit rien.
const levelText = (t, id) => {
  const value = readJson(`manifestes/${id}.json`).maturite;
  if (!value) return null;
  return `${t('ap.level.prefix')} ${value === 'alpha' || value === 'beta' ? t(`ap.level.${value}`) : `V${value.slice(1)}`}`;
};
const closed = () => !document.querySelector('.mod-scrim');
const memo = {}; // ce qu'un essai garde pour un autre : la hauteur de la fenêtre d'une fiche

// La mosaïque au départ : quatre cartes, trois colonnes, dans la fenêtre, la vignette d'attente, l'état de chacune.
async function gridProblems(page, t, note) {
  await page.run(() => window.__vitrine('ok'));
  const s = await page.until(grid);
  if (ids(s.cards) !== 'publipostage,automation,form,bi') note('cartes', `la mosaïque devrait montrer les quatre apps du catalogue dans l'ordre : ${ids(s.cards)}`);
  if (s.columns !== 3) note('colonnes', `à 700 px la mosaïque devrait poser trois colonnes : ${s.columns}`);
  if (s.body.overflow > 1) note('débordement', `la mosaïque déborde la fenêtre de ${s.body.overflow} px`);
  if (s.title !== t('mod.title')) note('titre', `le titre devrait être « ${t('mod.title')} » : « ${s.title} »`);
  for (const card of s.cards) {
    if (card.box.left < s.window.left || card.box.right > s.window.right) note('carte hors de la fenêtre', `« ${card.name} » sort de la fenêtre`);
    if (card.overflow > 1) note('carte coupée', `« ${card.name} » déborde de ${card.overflow} px`);
    if (!card.placeholder || card.placeholderName !== card.name) note('vignette d\'attente', `« ${card.name} » sans capture devrait montrer son icône et son nom (vignette : ${card.placeholder}, nom : ${card.placeholderName})`);
    if (card.level !== levelText(t, card.id)) note('niveau', `« ${card.name} » devrait montrer ${levelText(t, card.id) ? `la pastille « ${levelText(t, card.id)} »` : 'aucune pastille de niveau'} : ${card.level}`);
    if (card.level && !card.levelTip) note('niveau', `la pastille de « ${card.name} » devrait porter son info-bulle`);
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
  await contrastProblems(page, note, 'la mosaïque');
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

// La fiche d'une app sans extension ni capture (Form+) : la page, le bandeau et son bouton, « Installer » qui devient « Retirer » et « Ouvrir », Échap qui revient au même nom et au même défilement.
async function ficheProblems(page, t, note) {
  await page.run(() => { const body = document.querySelector('.mod-body'); body.scrollTop = Math.min(30, body.scrollHeight - body.clientHeight); });
  const before = (await page.run(grid)).body.top;
  const card = (await page.run(grid)).cards.find(item => item.id === 'form');
  await page.click(...await page.run(centerOf, '[data-fk="name:form"]'));
  let f = await page.until(fiche);
  memo.height = f.window.height;
  if (f.title !== 'Form+' || f.back !== t('ap.back')) note('fiche', `un clic sur le nom devrait ouvrir la fiche de Form+ avec « ${t('ap.back')} » : ${f.title} / ${f.back}`);
  if (f.focused !== 'back') note('fiche', `le clavier devrait être sur « ${t('ap.back')} » : ${f.focused}`);
  if (f.tag !== card.text) note('fiche', `le bandeau reprend le texte de la carte : « ${f.tag} »`);
  if (f.about !== null) note('fiche', `sans description à elle, la fiche ne répète pas le texte court : « ${f.about} »`);
  if (f.level !== levelText(t, 'form')) note('niveau', `la fiche de Form+ devrait montrer ${levelText(t, 'form') || 'aucune pastille de niveau'} : ${f.level}`);
  if (!f.noShot || f.strip || f.slides.length) note('captures', 'sans capture la fiche le dit en une phrase, sans bande de captures');
  if (f.chips[0] !== t('ap.version', { v: '0.1.0' }) || f.chips[f.chips.length - 1] !== t('ap.noExt')) note('fiche', `les pastilles devraient dire la version et « ${t('ap.noExt')} » : ${JSON.stringify(f.chips)}`);
  if (JSON.stringify(f.buttons.map(item => item.text)) !== JSON.stringify([t('ap.install')]) || f.buttons[0].disabled) note('fiche', `Form+ n'est pas installée : le bandeau devrait proposer seulement « ${t('ap.install')} » : ${JSON.stringify(f.buttons)}`);
  if (f.mini || f.miniButtons.some(item => item.shown)) note('barre du haut', 'en haut de la page la barre du haut ne reprend ni le nom ni le bouton');
  if (!f.libs || f.libsNote.join() !== t('ap.noNatives') || f.choices) note('bibliothèques', `Form+ n'a pas de bibliothèque à choisir et devrait le dire : ${JSON.stringify(f.libsNote)}`);
  if (f.section.count !== null || f.section.note !== t('ap.extNone')) note('extensions', `sans extension la rubrique le dit : « ${f.section.note} »`);
  if (f.body.overflow > 1) note('fiche', `la fiche déborde la fenêtre de ${f.body.overflow} px`);
  if (f.window.bottom > 400 || f.hero.right > f.window.right || f.cta.right > f.hero.right) note('fiche', 'la fiche sort de la fenêtre');
  if (f.tag && f.hero.top < f.body.topEdge - 1) note('fiche', 'le bandeau devrait être en haut de la page');
  await contrastProblems(page, note, 'la fiche de Form+');
  await page.click(...await page.run(centerOf, '[data-fk="app:form"]'));
  f = await page.until(() => { const x = fiche(); return x && x.buttons.some(item => item.text === 'Retirer' || item.text === 'Remove') ? x : null; });
  if (JSON.stringify(f.buttons.map(item => item.text)) !== JSON.stringify([t('mod.open'), t('ap.remove')])) note('fiche', `Form+ installée : le bandeau devrait proposer « ${t('mod.open')} » puis « ${t('ap.remove')} » : ${JSON.stringify(f.buttons)}`);
  if (f.focused !== 'open:form') note('fiche', `après « ${t('ap.install')} » le clavier devrait être sur « ${t('mod.open')} » : ${f.focused}`);
  if (!f.badge) note('fiche', `Form+ installée devrait porter « ${t('mod.badge.on')} » à côté de son nom`);
  await page.press('Escape');
  const s = await page.until(grid);
  if (s.focused !== 'name:form') note('retour', `Échap devrait ramener le clavier sur le nom de Form+ : ${s.focused}`);
  if (Math.abs(s.body.top - before) > 1) note('retour', `la mosaïque devrait retrouver son défilement (${before} px) : ${s.body.top} px`);
  if (!s.window.right) note('retour', 'la fenêtre ne devrait pas se fermer sur le premier Échap');
  await page.click(...await page.run(centerOf, '[data-app="bi"] .ap-shot'));
  f = await page.until(fiche);
  if (f.title !== 'Grist-BI') note('fiche', `un clic sur la capture devrait ouvrir la fiche de Grist-BI : ${f.title}`);
  if (f.level !== levelText(t, 'bi')) note('niveau', `la fiche de Grist-BI devrait montrer « ${levelText(t, 'bi')} » : ${f.level}`);
  if (!f.chips[0].startsWith(t('ap.version', { v: '' }).trim().split(' ')[0])) note('niveau', `une app qui n'est pas encore stable garde sa ligne « Version » : ${JSON.stringify(f.chips)}`);
  await contrastProblems(page, note, 'la fiche de Grist-BI');
  await page.click(...await page.run(centerOf, '[data-fk="back"]'));
  await page.until(grid);
}

// La fiche de Publipostage+ : la page entière, le lien qui mène aux extensions, une extension qui s'ajoute puis se retire, la barre du haut, l'ordre de Tab.
async function extensionsProblems(page, t, note) {
  await page.click(...await page.run(centerOf, '[data-fk="name:publipostage"]'));
  let f = await page.until(fiche);
  if (f.window.height !== memo.height) note('fenêtre fixe', `la fenêtre d'une fiche garde sa hauteur d'une app à l'autre (${memo.height} px, ici ${f.window.height} px)`);
  if (!f.libs || f.choices !== 2) note('bibliothèques', `la fiche de Publipostage+ devrait porter le choix de ses bibliothèques en deux cartes : ${f.choices}`);
  if (f.buttons.map(item => item.text).join() !== t('mod.open')) note('fiche', `Publipostage+ est toujours active : pas de « ${t('ap.remove')} », seulement « ${t('mod.open')} » : ${JSON.stringify(f.buttons)}`);
  if (f.level !== levelText(t, 'publipostage')) note('niveau', `la fiche de Publipostage+ devrait montrer « ${levelText(t, 'publipostage')} » : ${f.level}`);
  if (f.chips.some(chip => chip.startsWith(t('ap.version', { v: '' }).trim().split(' ')[0]))) note('niveau', `une app stable dit sa version dans la pastille du niveau, pas sur une deuxième ligne : ${JSON.stringify(f.chips)}`);
  if (!f.chips.includes(t('mod.always').replace(/\.$/, ''))) note('fiche', `les pastilles devraient dire que l'app est toujours active : ${JSON.stringify(f.chips)}`);
  if (f.cards.length !== 5 || f.link !== t('ap.extCount', { n: 5 })) note('extensions', `la fiche devrait montrer cinq extensions et un lien « ${t('ap.extCount', { n: 5 })} » : ${f.cards.length} / ${f.link}`);
  if (!f.section || f.section.count !== t('ap.extOf', { n: 0, total: 5 })) note('extensions', `le compte devrait dire « ${t('ap.extOf', { n: 0, total: 5 })} » : ${f.section && f.section.count}`);
  for (const card of f.cards) if (card.overflow > 1 || card.box.right > f.window.right) note('extensions', `la carte « ${card.name} » déborde la fenêtre`);
  await contrastProblems(page, note, 'la fiche de Publipostage+');
  const order = [];
  await page.run(() => document.querySelector('[data-fk="back"]').focus());
  for (let step = 0; step < 6; step += 1) { await page.press('Tab'); order.push((await page.run(fiche)).focused); }
  if (order[0] !== 'to-ext' || order[1] !== 'open:publipostage' || !/^ext:/.test(order[2] || '') || order.some(key => /^mini-/.test(key || ''))) {
    note('Tab', `après « ${t('ap.back')} », Tab devrait aller au lien des extensions, au bouton du bandeau, puis aux cartes, sans jamais entrer dans la barre du haut cachée : ${order.join()}`);
  }
  await page.click(...await page.run(centerOf, '[data-fk="to-ext"]'));
  f = await page.until(fiche);
  if (f.section && Math.abs(f.section.top - f.body.topEdge) > 40) note('lien des extensions', `le lien devrait amener les extensions en haut de la fenêtre (écart ${(f.section.top - f.body.topEdge).toFixed(0)} px)`);
  const key = 'ext:publipostage/graphique';
  await page.click(...await page.run(centerOf, `[data-fk="${key}"]`));
  f = await page.until(() => { const x = fiche(); return x && x.events.some(event => event[0] === 'extension') ? x : null; });
  if (JSON.stringify(f.events.filter(event => event[0] === 'extension')) !== JSON.stringify([['extension', 'publipostage', 'graphique', true]])) note('extension', `« ${t('ap.extAdd')} » sur Graphique a envoyé ${JSON.stringify(f.events)}`);
  let graph = f.cards.find(card => card.key === key);
  if (!graph.on || !graph.added || graph.button.text !== t('ap.remove')) note('extension', `la carte Graphique devrait dire « ${t('ap.extAdded')} » et proposer « ${t('ap.remove')} » : ${JSON.stringify([graph.on, graph.added, graph.button.text])}`);
  if (f.section.count !== t('ap.extOf', { n: 1, total: 5 })) note('extension', `le compte devrait monter à « ${t('ap.extOf', { n: 1, total: 5 })} » : ${f.section.count}`);
  if (f.focused !== key) note('extension', `le clavier devrait rester sur le bouton de la carte : ${f.focused}`);
  if (f.body.top < 20) note('extension', 'la fiche ne devrait pas remonter en haut après un geste');
  await page.click(...await page.run(centerOf, `[data-fk="${key}"]`));
  f = await page.until(() => { const x = fiche(); return x && x.events.filter(event => event[0] === 'extension').length === 2 ? x : null; });
  graph = f.cards.find(card => card.key === key);
  if (JSON.stringify(f.events[f.events.length - 1]) !== JSON.stringify(['extension', 'publipostage', 'graphique', false]) || graph.on || graph.added || graph.button.text !== t('ap.extAdd')) {
    note('extension', `« ${t('ap.remove')} » devrait retirer l'extension : ${JSON.stringify(f.events[f.events.length - 1])} / ${JSON.stringify([graph.on, graph.button.text])}`);
  }
  await page.run(() => { const body = document.querySelector('.mod-body'); body.scrollTop = body.scrollHeight; });
  f = await page.until(() => { const x = fiche(); return x && x.mini ? x : null; });
  const shown = f.miniButtons.filter(item => item.shown);
  if (f.miniName !== 'Publipostage+' || shown.map(item => item.text).join() !== t('mod.open') || shown.some(item => item.box.right > f.head.right || item.box.bottom > f.head.bottom)) {
    note('barre du haut', `quand le bandeau est sorti de l'écran, la barre du haut reprend le nom et « ${t('mod.open')} » : ${f.miniName} / ${JSON.stringify(shown.map(item => item.text))}`);
  }
  await page.run(() => { document.querySelector('.mod-body').scrollTop = 0; });
  f = await page.until(() => { const x = fiche(); return x && !x.mini ? x : null; });
  if (f.miniButtons.some(item => item.shown)) note('barre du haut', 'de retour en haut de la page la barre du haut rend le nom et le bouton');
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
  await page.until(closed, [], 2000);
}

// « Ouvrir » (la carte, le bandeau de la fiche, puis la barre du haut) : un seul appel `open` avec l'identifiant de l'app, et la fenêtre se ferme (le labo « vrai Grist » l'a trouvé le 17/11 : l'identifiant manquait).
async function openProblems(page, note) {
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
  await page.click(...await page.run(centerOf, '.fp-hero [data-fk="open:publipostage"]'));
  await page.until(closed, [], 2000);
  events = await page.run(() => window.__vitrineEvents);
  if (JSON.stringify(events) !== JSON.stringify([['open', 'publipostage']])) note('ouvrir', `« Ouvrir » dans le bandeau de la fiche a envoyé ${JSON.stringify(events)}`);
  await page.run(() => window.__vitrine('ok'));
  await page.until(grid);
  await page.click(...await page.run(centerOf, '[data-fk="name:publipostage"]'));
  await page.until(fiche);
  await page.run(() => { const body = document.querySelector('.mod-body'); body.scrollTop = body.scrollHeight; });
  await page.until(() => { const x = fiche(); return x && x.mini ? x : null; });
  await page.click(...await page.run(centerOf, '.fp-head [data-fk="mini-open:publipostage"]'));
  await page.until(closed, [], 2000);
  events = await page.run(() => window.__vitrineEvents);
  if (JSON.stringify(events) !== JSON.stringify([['open', 'publipostage']])) note('ouvrir', `« Ouvrir » dans la barre du haut a envoyé ${JSON.stringify(events)}`);
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
  await contrastProblems(page, note, 'la mosaïque avec une app refusée');
  await page.click(...await page.run(centerOf, '[data-fk="name:bi"]'));
  let f = await page.until(fiche);
  if (!f.badge || f.buttons.length !== 1 || !f.buttons[0].disabled || f.buttons[0].text !== t('ap.install')) note('app refusée', `la fiche de Grist-BI refusée devrait garder « ${t('ap.install')} » grisé et son badge : ${JSON.stringify(f.buttons)}`);
  await contrastProblems(page, note, 'la fiche de l\'app refusée');
  await page.click(...await page.run(centerOf, '[data-fk="app:bi"]'));
  f = await page.run(fiche);
  if (f.events.length || f.note !== reason) note('app refusée', `un clic sur « ${t('ap.install')} » grisé de la fiche ne devrait rien envoyer et dire la raison (envoyé : ${JSON.stringify(f.events)}, pied : « ${f.note} »)`);
  await page.press('Escape');
  await page.press('Escape');
  await page.until(closed, [], 2000);
  await page.run(() => window.__vitrine('lecture'));
  s = await page.until(grid);
  if (s.note !== t('mod.readonly')) note('lecture seule', `le pied devrait dire « ${t('mod.readonly')} » : « ${s.note} »`);
  const grey = s.cards.filter(card => card.button === t('ap.install'));
  if (grey.length !== 3 || grey.some(card => !card.disabled)) note('lecture seule', `en lecture seule les trois « ${t('ap.install')} » devraient être grisés : ${JSON.stringify(grey.map(card => card.disabled))}`);
  await page.click(...await page.run(centerOf, '[data-app="form"] .ap-act .btn'));
  s = await page.run(grid);
  if (s.events.length) note('lecture seule', `un clic sur « ${t('ap.install')} » grisé a envoyé ${JSON.stringify(s.events)}`);
  await page.click(...await page.run(centerOf, '[data-fk="name:publipostage"]'));
  f = await page.until(fiche);
  const grayed = f.cards.filter(card => card.button.disabled);
  if (grayed.length !== 5 || f.cards.some(card => card.button.text !== t('ap.extAdd'))) note('lecture seule', `en lecture seule les cinq « ${t('ap.extAdd')} » devraient être grisés : ${JSON.stringify(f.cards.map(card => [card.button.text, card.button.disabled]))}`);
  await contrastProblems(page, note, 'la fiche en lecture seule');
  await page.click(...await page.run(centerOf, `[data-fk="${f.cards[0].key}"]`));
  f = await page.run(fiche);
  if (f.events.length || f.note !== t('mod.readonly')) note('lecture seule', `un clic sur « ${t('ap.extAdd')} » grisé a envoyé ${JSON.stringify(f.events)} (pied : « ${f.note} »)`);
  await page.press('Escape');
  await page.press('Escape');
  await page.until(closed, [], 2000);
}

// Les vitrines que les apps ont rendues (consignes 014, 018 et 031, 17/11) : sur les vrais manifestes, les vraies images de `vitrine/` s'affichent. Chaque carte montre sa première capture (chargée,
// sans vignette d'attente) ; la fiche porte les trois captures, leurs légendes dans la langue de la personne, la description de l'app, et la bande des captures prend le clavier.
async function deliveredProblems(page, language, t, note) {
  await page.run(() => window.__vitrine('livrees'));
  const ids = ['publipostage', 'automation', 'form', 'bi'];
  const s = await page.until(() => { const g = grid(); return g && g.cards.every(card => card.image && card.image.loaded) ? g : null; }, [], 5000)
    .catch(() => null);
  const seen = s || await page.run(grid);
  for (const id of ids) {
    const card = seen.cards.find(item => item.id === id);
    if (!card || card.placeholder || !card.image || !card.image.loaded) note('vitrines rendues : carte', `la carte de « ${id} » devrait montrer sa première capture, chargée : ${JSON.stringify(card && { placeholder: card.placeholder, image: card.image })}`);
    else if (card.overflow > 1 || card.shot.height < 40) note('vitrines rendues : carte', `la carte de « ${id} » est coupée (${card.overflow} px) ou sa vignette trop basse (${card.shot.height.toFixed(0)} px)`);
  }
  for (const id of ids) {
    const manifest = readJson(`manifestes/${id}.json`);
    await page.click(...await page.run(centerOf, `[data-fk="name:${id}"]`));
    const f = await page.until(() => { const x = fiche(); return x && x.slides.length === 3 && x.slides.every(slide => slide.image) ? x : null; }, [], 5000).catch(() => null);
    if (!f) { note('vitrines rendues : fiche', `la fiche de « ${id} » devrait porter trois captures chargées`); await page.press('Escape'); await page.until(grid).catch(() => null); continue; }
    const wanted = manifest.vitrine.captures.map(capture => capture.legende[language]);
    if (f.slides.map(slide => slide.caption).join('|') !== wanted.join('|')) note('vitrines rendues : légendes', `la fiche de « ${id} » devrait dire « ${wanted.join(' | ')} » : ${f.slides.map(slide => slide.caption).join(' | ')}`);
    if (f.about !== manifest.vitrine.description[language]) note('vitrines rendues : description', `la fiche de « ${id} » devrait montrer la description de l'app : « ${f.about} »`);
    if (f.noShot || !f.strip || f.strip.tab !== '0') note('vitrines rendues : bande', `la bande des captures de « ${id} » devrait être une région qui prend le clavier`);
    if (f.slides[0].box.left < f.strip.box.left - 1 || f.slides[0].box.right > f.window.right) note('vitrines rendues : première capture', `la première capture de « ${id} » devrait se voir en entier dans la fenêtre`);
    if (f.body.overflow > 1) note('vitrines rendues : fiche', `la fiche de « ${id} » déborde la fenêtre de ${f.body.overflow} px`);
    await contrastProblems(page, note, `la fiche de « ${id} » avec ses captures`);
    await page.click(...await page.run(centerOf, '[data-fk="back"]'));
    await page.until(grid);
  }
  await page.press('Escape');
  await page.until(closed, [], 2000);
}


// Les captures : une qui se charge dans la carte et dans la bande, une absente remplacée par la vignette d'attente ; les flèches et le clavier font défiler la bande ; la barre du haut reprend « Installer ».
async function capturesProblems(page, t, note) {
  await page.run(() => window.__vitrine('captures'));
  let s = await page.until(() => { const g = grid(); return g && g.cards[0].image && g.cards[0].image.loaded ? g : null; });
  if (!s.cards[0].image || !s.cards[0].image.loaded || s.cards[0].placeholder) note('captures', `la carte de Publipostage+ devrait montrer sa première capture, sans vignette d'attente : ${JSON.stringify(s.cards[0].image)}`);
  if (s.cards.slice(2).some(card => card.image)) note('captures', 'Form+ et Grist-BI n\'ont pas de capture : seule la vignette d\'attente');
  await page.click(...await page.run(centerOf, '[data-fk="name:publipostage"]'));
  let f = await page.until(() => { const x = fiche(); return x && x.slides.length === 2 && x.slides[0].image && x.slides[1].placeholder ? x : null; });
  const fr = t('mod.open') === 'Ouvrir';
  const [first, second] = fr ? ['Première capture', 'Deuxième capture'] : ['First screenshot', 'Second screenshot'];
  if (f.about !== (fr ? 'Une description longue de Publipostage+.' : 'A long description of Publipostage+.')) note('description', `la fiche devrait montrer la description de la vitrine : « ${f.about} »`);
  if (f.slides.map(slide => slide.caption).join() !== [first, second].join()) note('captures', `les légendes devraient être « ${first} » et « ${second} » : ${f.slides.map(slide => slide.caption).join()}`);
  if (f.noShot || !f.strip || f.strip.tab !== '0') note('captures', 'la bande des captures est une région qui prend le clavier');
  if (f.slides[0].box.left < f.strip.box.left - 1 || f.slides[0].box.right > f.window.right) note('captures', 'la première capture devrait se voir en entier dans la fenêtre');
  if (f.slides[1].image || !f.slides[1].placeholder) note('capture absente', 'la capture dont le fichier est absent devrait laisser la vignette d\'attente dans la bande');
  if (!f.next || !f.next.shown || f.next.disabled || (f.prev && f.prev.shown)) note('captures', `au début de la bande « suivante » est là et « précédente » reste cachée : ${JSON.stringify([f.prev, f.next])}`);
  await contrastProblems(page, note, 'la fiche avec captures');
  await page.click(...await page.run(centerOf, '.fp-nav.next'));
  f = await page.until(() => { const x = fiche(); return x && x.strip.scroll > 20 && x.next.disabled ? x : null; }, [], 3000).catch(() => null);
  if (!f) note('captures', 'la flèche « suivante » devrait faire défiler la bande jusqu\'au bout, puis se cacher');
  else if (!f.prev.shown || f.prev.disabled) note('captures', 'au bout de la bande « précédente » devrait se montrer');
  await page.click(...await page.run(centerOf, '.fp-nav.prev'));
  await page.until(() => { const x = fiche(); return x && x.strip.scroll < 4 ? x : null; }, [], 3000).catch(() => note('captures', 'la flèche « précédente » devrait ramener la bande au début'));
  await page.run(() => document.querySelector('.fp-strip').focus());
  await page.press('ArrowRight');
  await page.until(() => { const x = fiche(); return x && x.strip.scroll > 20 ? x : null; }, [], 3000).catch(() => note('captures', 'la flèche droite sur la bande devrait la faire défiler'));
  await page.press('Escape');
  await page.until(grid);
  // La barre du haut reprend « Installer » : Automation+ (non installée) a deux captures dans cet essai ; le geste vient de la barre, et le clavier la suit sur « Ouvrir ».
  await page.click(...await page.run(centerOf, '[data-fk="name:automation"]'));
  await page.until(fiche);
  await page.run(() => { const body = document.querySelector('.mod-body'); body.scrollTop = body.scrollHeight; });
  f = await page.until(() => { const x = fiche(); return x && x.mini ? x : null; });
  const mini = f.miniButtons.filter(item => item.shown);
  if (mini.map(item => item.text).join() !== t('ap.install') || f.miniName !== 'Automation+') note('barre du haut', `la barre du haut devrait reprendre « ${t('ap.install')} » d'Automation+ : ${f.miniName} / ${JSON.stringify(mini.map(item => item.text))}`);
  await page.click(...await page.run(centerOf, '.fp-head [data-fk="mini-app:automation"]'));
  f = await page.until(() => { const x = fiche(); return x && x.events.length ? x : null; });
  if (JSON.stringify(f.events) !== JSON.stringify([['app', 'automation', true]])) note('barre du haut', `« ${t('ap.install')} » de la barre du haut a envoyé ${JSON.stringify(f.events)}`);
  if (f.focused !== 'mini-open:automation') note('barre du haut', `le clavier devrait suivre sur « ${t('mod.open')} » de la barre du haut : ${f.focused}`);
  if (!f.mini || f.body.top < 20) note('barre du haut', 'après le geste la page garde son défilement et la barre du haut ses boutons');
  await page.press('Escape');
  await page.press('Escape');
  await page.until(closed, [], 2000);
}

// La fenêtre étroite : deux colonnes à 560 px, une à 480 px ; rien ne déborde, ni la mosaïque ni la fiche, boutons du bandeau compris.
async function narrowProblems(page, mode, note) {
  for (const [width, columns] of [[560, 2], [480, 1]]) {
    await page.view({ width, scale: 1, mode });
    await page.run(() => window.__vitrine('ok'));
    const s = await page.until(grid);
    if (s.columns !== columns) note('fenêtre étroite', `à ${width} px la mosaïque devrait poser ${columns} colonne(s) : ${s.columns}`);
    if (s.body.overflow > 1 || s.cards.some(card => card.box.right > s.window.right || card.box.left < s.window.left)) note('fenêtre étroite', `à ${width} px une carte déborde la fenêtre`);
    await page.click(...await page.run(centerOf, '[data-fk="name:publipostage"]'));
    const f = await page.until(fiche);
    if (f.body.overflow > 1 || f.hero.right > f.window.right || f.buttons.some(item => item.box.right > f.window.right || item.box.left < f.window.left)) note('fenêtre étroite', `à ${width} px la fiche déborde la fenêtre`);
    if (f.cards.some(card => card.overflow > 1 || card.box.right > f.window.right)) note('fenêtre étroite', `à ${width} px une carte d'extension déborde la fenêtre`);
    await page.press('Escape');
    await page.press('Escape');
    await page.until(closed, [], 2000);
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
    await page.until(closed, [], 2000);
    await keyboardProblems(page, note);
    await openProblems(page, note);
    await blockedProblems(page, t, note);
    await capturesProblems(page, t, note);
    await deliveredProblems(page, language, t, note);
    await narrowProblems(page, mode, note);
  } catch (error) {
    note('essai interrompu', String(error && error.message));
  }
  return found;
}
