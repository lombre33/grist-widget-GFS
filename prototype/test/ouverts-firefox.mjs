// La vue « Ouverts » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs). La ligne « Ouverts » du volet porte le nombre de fichiers ouverts et ouvre
// une liste à plat, par nom, de ces fichiers (de tous les dossiers) ; le fichier que l'app affiche porte le mot « affiché » (jamais une couleur seule) ; chaque ligne mesure 28 px, son contenu y reste et
// aucun texte n'est coupé sans son texte entier au survol ; « Retirer des ouverts » est le deuxième article du menu d'une ligne (à la vraie souris), retire la ligne, rend le clavier à la suivante et met
// le nombre à jour ; Entrée ouvre le fichier choisi ; une liste vide le dit. À 700 px, en clair et en sombre, en français et en anglais (le contraste se mesure dans un vrai Grist : labo/run-ouverts.mjs).
import { createI18n } from '../js/i18n/i18n.js';
import { Run } from './corbeille-firefox.mjs';

const OPENED = ['Support de session', 'Convocation', 'Grille de suivi']; // le dernier est celui que l'app affiche ; « Support de session » est dans le dossier « Formation »
const SORTED = ['Convocation', 'Grille de suivi', 'Support de session'];

// Ce que la vue montre : la ligne du volet (son mot, son nombre, si elle est la vue courante), les lignes de la liste (nom, mot « affiché », hauteur, ce qui sort de la ligne, le dossier en indice).
function read() {
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const tree = document.querySelector('.tr-row[data-view="opened"]');
  const rows = [...document.querySelectorAll('.ls-row')].map(row => {
    const box = row.getBoundingClientRect();
    const inside = [...row.querySelectorAll('.nm > *, .ty > *, .md > *')].every(node => { const at = node.getBoundingClientRect(); return at.width === 0 || (at.top >= box.top - 0.5 && at.bottom <= box.bottom + 0.5 && at.right <= box.right + 0.5); });
    const now = row.querySelector('.now');
    const name = row.querySelector('.t');
    return {
      name: text(name), now: text(now), nowCut: now ? now.scrollWidth > now.clientWidth + 1 : false, nameWidth: Math.round(name.getBoundingClientRect().width), height: Math.round(box.height), inside,
      hint: text(row.querySelector('.hint')), cutNames: name.scrollWidth > name.clientWidth + 1 && !name.title,
    };
  });
  const label = tree && tree.querySelector('.lbl');
  return {
    tree: tree ? { label: text(label), count: text(tree.querySelector('.cnt')), current: tree.getAttribute('aria-current'), cut: label.scrollWidth > label.clientWidth + 1 } : null,
    rows, empty: text(document.querySelector('.ex .empty:not([hidden])')), crumbs: text(document.querySelector('.crumbs')), opened: window.__opened,
    selected: text(document.querySelector('.ls-row[aria-selected="true"] .t')),
    focus: document.activeElement && document.activeElement.closest('.ls-row') ? text(document.activeElement.closest('.ls-row').querySelector('.t')) : null,
    menu: [...document.querySelectorAll('.menu .menu-item .menu-label')].map(text),
  };
}

const state = run => run.page.run(read);
async function expectState(run, kind, what, check) {
  const started = Date.now();
  let current = await state(run);
  while (!check(current) && Date.now() - started < 3000) { await new Promise(resolve => setTimeout(resolve, 60)); current = await state(run); }
  if (!check(current)) run.note(kind, `${what} (état : ${JSON.stringify(current).slice(0, 500)})`);
  return current;
}

// La liste de trois fichiers ouverts, ouverte à la vraie souris par la ligne du volet.
async function listing(run, t) {
  await run.reset();
  await run.page.run(names => window.__open(names), OPENED);
  await run.clickSelector('.tr-row[data-view="opened"]');
  const view = await expectState(run, 'la liste', 'la liste devait montrer les trois fichiers ouverts, par nom, tous dossiers confondus', current => current.rows.length === 3 && current.rows.map(row => row.name).join('|') === SORTED.join('|'));
  if (!view.tree || view.tree.label !== t('ex.opened') || view.tree.count !== '3' || view.tree.current !== 'true' || view.tree.cut) run.note('la ligne du volet', `la ligne devait dire « ${t('ex.opened')} », compter 3, être la vue courante et n'être pas coupée (${JSON.stringify(view.tree)})`);
  if (!view.crumbs || !view.crumbs.includes(t('ex.opened'))) run.note('le fil d\'Ariane', `le fil devait dire « ${t('ex.opened')} » (${view.crumbs})`);
  const marked = view.rows.filter(row => row.now !== null).map(row => `${row.name} : ${row.now}`);
  if (marked.join('|') !== `Grille de suivi : ${t('ex.shown')}`) run.note('« affiché »', `seul le dernier fichier ouvert devait porter « ${t('ex.shown')} » (${marked.join(' ; ') || 'aucun'})`);
  for (const row of view.rows) {
    if (row.height !== 28) run.note('hauteur de ligne', `« ${row.name} » devait mesurer 28 px (${row.height} px)`);
    if (!row.inside) run.note('contenu de la ligne', `le contenu de « ${row.name} » devait rester dans la ligne`);
    if (row.nowCut) run.note('« affiché » coupé', `le mot « ${row.now} » ne devait pas être coupé sur « ${row.name} »`);
    if (row.nameWidth < 60) run.note('nom écrasé', `le nom « ${row.name} » ne devait pas être écrasé (${row.nameWidth} px)`);
  }
  const folder = view.rows.find(row => row.name === 'Support de session');
  if (!folder || folder.hint !== 'Formation') run.note('le dossier en indice', `« Support de session » devait dire son dossier « Formation » (${folder && folder.hint})`);
  const snap = await run.snap();
  if (snap.cut.length) run.note('texte coupé sans info-bulle', `des textes de la liste sont coupés sans leur texte entier au survol : ${snap.cut.slice(0, 3).join(' ; ')}`);
}

// « Retirer des ouverts » : le menu de la ligne choisie, à la vraie souris, son deuxième article ; la ligne part, le nombre baisse, le clavier passe à la ligne suivante.
async function dropping(run, t) {
  await run.reset();
  await run.page.run(names => window.__open(names), OPENED);
  await run.clickSelector('.tr-row[data-view="opened"]');
  await run.click('Convocation');
  await run.clickSelector('.ls-row[aria-selected="true"] .rb.mn');
  const menu = await expectState(run, 'le menu', 'le menu de la ligne devait s\'ouvrir avec « Ouvrir » puis « Retirer des ouverts »', current => current.menu.length > 2 && current.menu[1] === t('ex.openedDrop'));
  if (menu.menu[0] !== t('ex.open')) run.note('le menu', `le premier article devait être « ${t('ex.open')} » (${menu.menu[0]})`);
  await run.clickSelector('.menu > :nth-child(2)');
  const after = await expectState(run, '« Retirer des ouverts »', 'la ligne devait partir, le nombre passer à 2 et le clavier à la ligne suivante', current => current.rows.map(row => row.name).join('|') === 'Grille de suivi|Support de session' && current.tree.count === '2' && current.menu.length === 0);
  if (after.focus !== 'Grille de suivi') run.note('le clavier après le retrait', `la ligne suivante devait prendre le clavier (focus : ${after.focus})`);
  await run.page.press('Enter');
  await expectState(run, 'Entrée', 'Entrée devait ouvrir le fichier de la ligne qui a le clavier', current => current.opened === 'Grille de suivi');
}

// Rien d'ouvert : la ligne n'a pas de nombre, la liste le dit (une phrase, pas une page blanche).
async function nothing(run, t) {
  await run.reset();
  await run.clickSelector('.tr-row[data-view="opened"]');
  const empty = await expectState(run, 'la liste vide', 'la liste devait dire qu\'aucun fichier n\'est ouvert, sans nombre sur la ligne du volet', current => current.rows.length === 0 && current.empty === t('ex.emptyOpened') && current.tree.count === null);
  if (empty.empty !== t('ex.emptyOpened')) run.note('la phrase', `la phrase devait être « ${t('ex.emptyOpened')} » (${empty.empty})`);
}

// Les mesures de la vue « Ouverts », dans la langue de la page (`language`) ; rend les écarts { kind, text }.
export async function ouvertsProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'fichiers ouverts');
  for (const step of [listing, dropping, nothing]) {
    try {
      await step(run, t);
    } catch (error) {
      run.note('geste impossible', `${step.name} : ${String(error.message).slice(0, 200)}`);
      await page.press('Escape').catch(() => {});
    }
    await run.reset();
  }
  return found;
}
