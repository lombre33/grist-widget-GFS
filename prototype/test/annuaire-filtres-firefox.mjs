// Les filtres de l'annuaire sous Firefox (règle du 03/11 ; module Annuaire, retours du porteur du 25/11 : « un bouton pour réinitialiser dès qu'une valeur est cochée »,
// « une option par annuaire : le panneau, ou une barre horizontale avec le nom de chaque champ », « un champ de recherche par filtre »), à la vraie souris et au vrai clavier,
// sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js, `?filters=bar` pour la barre). Suite de test/annuaire-firefox.mjs. À mesurer : dans le panneau,
// la tête (ce qui est coché, « Réinitialiser » grisé tant que rien ne l'est, puis actif), la recherche de chaque filtre (elle réduit ses valeurs seulement, garde le clavier et
// le curseur, dit quand rien ne correspond) ; dans la barre, un bouton par filtre au nom de son champ (sans bouton « Filtres »), le menu d'un filtre (sa recherche, ses
// valeurs, une seule fenêtre ouverte à la fois, Échap qui rend le clavier au bouton), le nombre de choix sur le bouton, « Réinitialiser » ; la barre de l'organigramme ; et
// la lisibilité (4,5:1).
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';
import { press } from './annuaire-setup-firefox.mjs';
import { clickOn } from './annuaire-table-firefox.mjs';

export const FILTER_PROBES = { 'le compte': ['.an-fp-n', '.menu-panel'], 'une valeur': ['.an-fv-t', '.menu-panel'], 'son nombre': ['.an-fv-n', '.menu-panel'],
  '« Réinitialiser » grisé': ['.an-freset[aria-disabled="true"]', '.menu-panel'], 'un bouton de la barre': ['.an-fb .an-fb-t', '.an-card'],
  'la recherche': ['.an-fq', '.menu-panel'] };

// ---------- ce qui s'exécute dans la page ----------

function snapshot() {
  const q = selector => document.querySelector(selector);
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
  const panel = q('.an-fpanel');
  const bar = q('.an-fbar');
  const barRow = q('.an-fbar-row');
  const orgBar = q('.an-org-fbar .an-fbar');
  const shownBox = node => (node && node.getClientRects().length ? box(node) : null);
  const buttonsOf = root => (root ? [...root.querySelectorAll('.an-fb')].map(node => ({ col: node.dataset.col, text: text(node.querySelector('.an-fb-t')), badge: text(node.querySelector('.an-badge')),
    on: node.classList.contains('is-on'), expanded: node.getAttribute('aria-expanded'), box: box(node) })) : []);
  const resetOf = root => { const node = root && root.querySelector('.an-freset'); return node ? { disabled: node.getAttribute('aria-disabled') === 'true', box: box(node), title: node.title } : null; };
  const focused = document.activeElement;
  return {
    view: [innerWidth, innerHeight], window: box(q('.mod.an')),
    persons: document.querySelectorAll('.an-person, .an-pcard').length, cards: document.querySelectorAll('.an-oc').length,
    toolbarButton: Boolean(q('[data-fk="filters"]') && shownBox(q('[data-fk="filters"]'))),
    footReset: Boolean(q('[data-fk="filters-reset"]')),
    panel: panel ? { box: box(panel), head: text(panel.querySelector('.an-fp-n')), reset: resetOf(panel), sideways: panel.scrollWidth - panel.clientWidth,
      searches: [...panel.querySelectorAll('.an-fq')].map(input => ({ col: input.dataset.col, value: input.value, height: input.getBoundingClientRect().height })),
      rows: [...panel.querySelectorAll('.an-fv:not(.an-fmore)')].map(node => ({ fk: node.dataset.fk, col: node.dataset.col, text: text(node.querySelector('.an-fv-t')),
        checked: node.getAttribute('aria-checked') === 'true', box: box(node) })), none: text(panel.querySelector('.an-fnone')) } : null,
    bar: bar ? { box: bar.getClientRects().length ? box(bar) : null, row: shownBox(barRow), buttons: buttonsOf(bar), reset: resetOf(bar), sideways: bar.scrollWidth - bar.clientWidth } : null,
    orgBar: orgBar ? { box: shownBox(orgBar), buttons: buttonsOf(orgBar) } : null,
    focused: focused && focused.dataset ? focused.dataset.fk : null,
    caret: focused && focused.type === 'search' ? [focused.selectionStart, focused.selectionEnd] : null,
  };
}

// ---------- l'essai ----------

const rowsOf = (snap, col) => snap.panel.rows.filter(row => row.col === col);

async function readable(page, note, where) {
  for (const [what, value] of Object.entries(await page.run(contrasts, FILTER_PROBES))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
}

// Le panneau : sa tête, sa recherche par filtre, « Réinitialiser ».
async function panelProblems(page, t, note) {
  const hit = selector => clickOn(page, note, selector);
  const where = 'le panneau des filtres';
  if (!await hit('[data-fk="filters"]')) return;
  await delay(250);
  let snap = await page.run(snapshot);
  if (!snap.panel) { note('filtres', `${where} : le bouton « ${t('an.filters')} » n'ouvre rien`); return; }
  if (snap.bar) note('filtres', `${where} : une barre de filtres est là alors que l'annuaire montre un panneau`);
  if (!snap.panel.reset) { note('filtres', `${where} : « ${t('an.filters.reset')} » manque dans la tête du panneau`); return; }
  if (!snap.panel.reset.disabled) note('filtres', `${where} : « ${t('an.filters.reset')} » n'est pas grisé alors que rien n'est coché`);
  if (snap.panel.head !== t('an.filters.nothing', { n: 0 })) note('filtres', `${where} : la tête dit « ${snap.panel.head} » (« ${t('an.filters.nothing', { n: 0 })} » attendu)`);
  if (snap.panel.reset.box.height < 24) note('cible trop petite', `${where} : « ${t('an.filters.reset')} » mesure ${Math.round(snap.panel.reset.box.height)} px de haut`);
  if (snap.panel.searches.length !== 2) note('filtres', `${where} : ${snap.panel.searches.length} recherche(s) pour les 2 filtres dépliés (une par filtre déplié attendue)`);
  for (const search of snap.panel.searches) if (search.height < 28) note('cible trop petite', `${where} : la recherche de « ${search.col} » mesure ${Math.round(search.height)} px de haut`);
  await readable(page, note, where);
  await hit('[data-fk="fs:Contrat"]');
  await hit('[data-fk="fq:Contrat"]');
  snap = await page.run(snapshot);
  const all = rowsOf(snap, 'Contrat').map(row => row.text);
  await press(page, 'contr');
  snap = await page.run(snapshot);
  const some = rowsOf(snap, 'Contrat').map(row => row.text);
  if (!all.length || some.length !== all.filter(each => /contr/i.test(each)).length || some.length === 0 || some.length >= all.length) {
    note('recherche', `${where} : « contr » réduit « Contrat » de ${JSON.stringify(all)} à ${JSON.stringify(some)}`);
  }
  if (rowsOf(snap, '@L0').length === 0) note('recherche', `${where} : la recherche d'un filtre vide aussi les autres`);
  if (snap.focused !== 'fq:Contrat' || !snap.caret || snap.caret[0] !== 5) note('clavier', `${where} : après la frappe, le clavier est sur « ${snap.focused} » (curseur ${JSON.stringify(snap.caret)} ; « fq:Contrat » et 5 attendus)`);
  await press(page, 'zz');
  snap = await page.run(snapshot);
  if (rowsOf(snap, 'Contrat').length !== 0 || snap.panel.none !== t('an.filter.noMatch')) note('recherche', `${where} : sans réponse, le filtre dit « ${snap.panel.none} » et garde ${rowsOf(snap, 'Contrat').length} valeur(s) (« ${t('an.filter.noMatch')} » attendu)`);
  for (let at = 0; at < 7; at += 1) await page.press('Backspace');
  await delay(250);
  snap = await page.run(snapshot);
  if (rowsOf(snap, 'Contrat').length !== all.length) note('recherche', `${where} : la recherche vidée laisse ${rowsOf(snap, 'Contrat').length} valeurs (${all.length} attendues)`);
  const row = rowsOf(snap, 'Contrat').find(each => each.text === 'Contractuelle') || rowsOf(snap, 'Contrat')[0];
  await hit(`[data-fk="${row.fk}"]`);
  snap = await page.run(snapshot);
  if (!snap.panel) { note('filtres', `${where} : le panneau se ferme à une case cochée`); return; }
  if (snap.panel.reset.disabled) note('filtres', `${where} : « ${t('an.filters.reset')} » reste grisé alors qu'une valeur est cochée`);
  if (snap.panel.head !== t('an.filters.chosen', { n: 1 })) note('filtres', `${where} : la tête dit « ${snap.panel.head} » (« ${t('an.filters.chosen', { n: 1 })} » attendu)`);
  if (snap.persons >= 7) note('filtres', `${where} : une valeur cochée laisse ${snap.persons} lignes (moins de 7 attendues)`);
  await readable(page, note, `${where}, une valeur cochée`);
  await hit('[data-fk="fp-reset"]');
  snap = await page.run(snapshot);
  if (snap.persons !== 7 || snap.footReset) note('filtres', `${where} : « ${t('an.filters.reset')} » du panneau laisse ${snap.persons} lignes (7 attendues) et ${snap.footReset ? 'le bouton du pied' : 'plus de bouton au pied'}`);
  if (!snap.panel) note('filtres', `${where} : « ${t('an.filters.reset')} » ferme le panneau (il reste ouvert : on recoche autre chose)`);
  else if (!snap.panel.reset.disabled) note('filtres', `${where} : « ${t('an.filters.reset')} » reste actif après avoir tout retiré`);
  if (snap.focused !== 'fp-reset') note('clavier', `${where} : après « ${t('an.filters.reset')} », le clavier est sur « ${snap.focused} » (le bouton lui-même attendu)`);
  await page.press('Escape');
  await delay(200);
  snap = await page.run(snapshot);
  if (snap.panel || snap.focused !== 'filters') note('clavier', `${where} : Échap laisse le panneau ${snap.panel ? 'ouvert' : 'fermé'} et le clavier sur « ${snap.focused} » (fermé, sur le bouton attendu)`);
}

// Le menu d'un filtre de la barre.
async function menuProblems(page, t, note, where) {
  const hit = selector => clickOn(page, note, selector);
  if (!await hit('[data-fk="fb:Contrat"]')) return;
  await delay(250);
  let snap = await page.run(snapshot);
  if (!snap.panel) { note('barre', `${where} : un clic sur « Contrat » n'ouvre aucun menu`); return; }
  const button = snap.bar && snap.bar.buttons.find(each => each.col === 'Contrat');
  if (!button || button.expanded !== 'true') note('barre', `${where} : le bouton « Contrat » ne dit pas qu'il est ouvert (« ${button && button.expanded} »)`);
  if (button && snap.panel.box.top < button.box.bottom - 1) note('barre', `${where} : le menu n'est pas sous le bouton (haut ${Math.round(snap.panel.box.top)}, bas du bouton ${Math.round(button.box.bottom)})`);
  if (snap.panel.box.left < snap.window.left - 1 || snap.panel.box.right > snap.window.right + 1 || snap.panel.box.bottom > snap.window.bottom + 1) note('barre', `${where} : le menu sort de la fenêtre`);
  if (snap.panel.searches.length !== 1 || snap.panel.searches[0].col !== 'Contrat') note('barre', `${where} : le menu a ${snap.panel.searches.length} recherche(s) (la sienne seule attendue)`);
  if (snap.focused !== 'fq:Contrat') note('clavier', `${where} : à l'ouverture, le clavier est sur « ${snap.focused} » (la recherche du filtre attendue)`);
  if (snap.panel.rows.some(row => row.col !== 'Contrat') || snap.panel.rows.length === 0) note('barre', `${where} : le menu montre ${snap.panel.rows.length} valeurs, de ${[...new Set(snap.panel.rows.map(row => row.col))]} (celles de « Contrat » seules attendues)`);
  await readable(page, note, where);
  const all = snap.panel.rows.length;
  await press(page, 'contr');
  snap = await page.run(snapshot);
  if (snap.panel.rows.length === 0 || snap.panel.rows.length >= all || snap.focused !== 'fq:Contrat') note('recherche', `${where} : « contr » laisse ${snap.panel.rows.length} valeurs sur ${all}, le clavier sur « ${snap.focused} »`);
  const row = snap.panel.rows[0];
  await hit(`[data-fk="${row.fk}"]`);
  snap = await page.run(snapshot);
  const chosen = snap.bar.buttons.find(each => each.col === 'Contrat');
  if (!snap.panel) note('barre', `${where} : le menu se ferme à une case cochée`);
  if (!chosen || chosen.badge !== '1' || !chosen.on) note('barre', `${where} : le bouton « Contrat » ne compte pas le choix (« ${chosen && chosen.badge} », ${chosen && chosen.on})`);
  if (snap.bar.reset.disabled) note('barre', `${where} : « ${t('an.filters.reset')} » reste grisé alors qu'une valeur est cochée`);
  if (snap.persons >= 7) note('filtres', `${where} : une valeur cochée laisse ${snap.persons} lignes (moins de 7 attendues)`);
  if (!snap.footReset) note('pied', `${where} : le pied n'a pas son « ${t('an.filters.reset')} »`);
  await page.press('Escape');
  await delay(200);
  snap = await page.run(snapshot);
  if (snap.panel || snap.focused !== 'fb:Contrat') note('clavier', `${where} : Échap laisse le menu ${snap.panel ? 'ouvert' : 'fermé'} et le clavier sur « ${snap.focused} » (« fb:Contrat » attendu)`);
  if (!await hit('[data-fk="fb:Contrat"]')) return;
  await delay(250);
  if (!await hit('[data-fk="fb:@L0"]')) return;
  await delay(250);
  snap = await page.run(snapshot);
  const open = snap.bar.buttons.filter(each => each.expanded === 'true').map(each => each.col);
  if (open.join() !== '@L0' || !snap.panel || snap.panel.searches[0].col !== '@L0') note('barre', `${where} : un second bouton ouvre ${JSON.stringify(open)} (« @L0 » seul attendu, un seul menu à la fois)`);
  await page.press('Escape');
  await delay(200);
  await hit('[data-fk="fb:Contrat"]');
  await delay(250);
  await hit('[data-fk="fp-reset"], .an-fb-reset');
  await delay(250);
  snap = await page.run(snapshot);
  if (snap.persons !== 7 || snap.footReset || snap.panel) note('barre', `${where} : « ${t('an.filters.reset')} » de la barre laisse ${snap.persons} lignes (7), ${snap.footReset ? 'le bouton du pied' : 'plus de bouton au pied'}, ${snap.panel ? 'un menu ouvert' : 'plus de menu'} (7, plus de bouton ni de menu attendus)`);
  if (!snap.bar.reset.disabled) note('barre', `${where} : « ${t('an.filters.reset')} » reste actif après avoir tout retiré`);
}

// La barre : un bouton par filtre, au nom de son champ ; la barre de l'organigramme.
async function barProblems(page, t, note, { width }) {
  const where = `la barre des filtres (${width} px)`;
  let snap = await page.run(snapshot);
  if (!snap.bar || !snap.bar.row) { note('barre', `${where} : la barre n'est pas là alors que l'annuaire montre ses filtres en barre`); return; }
  if (snap.toolbarButton) note('barre', `${where} : le bouton « ${t('an.filters')} » est là en plus de la barre`);
  const names = snap.bar.buttons.map(each => each.text);
  if (names.join('|') !== ['Pôle', 'Direction', 'Service', 'Contrat', 'Competences', 'Teletravail'].join('|')) note('barre', `${where} : les boutons disent ${JSON.stringify(names)} (un par filtre, au nom de son champ)`);
  if (snap.bar.row.right > snap.window.right + 1 || snap.bar.row.left < snap.window.left - 1) note('barre', `${where} : la barre sort de la fenêtre`);
  for (const button of snap.bar.buttons) if (button.box.height < 24) note('cible trop petite', `${where} : « ${button.text} » mesure ${Math.round(button.box.height)} px de haut`);
  if (!snap.bar.reset || !snap.bar.reset.disabled) note('barre', `${where} : « ${t('an.filters.reset')} » manque ou n'est pas grisé alors que rien n'est coché`);
  await readable(page, note, where);
  await menuProblems(page, t, note, where);
  await clickOn(page, note, '[data-fk="v:org"]');
  await delay(500);
  snap = await page.run(snapshot);
  if (!snap.orgBar || !snap.orgBar.box) { note('barre', `${where} : l'organigramme n'a pas la barre des filtres`); return; }
  if (snap.bar.row) note('barre', `${where} : la rangée de la liste reste visible sous l'organigramme`);
  if (snap.orgBar.buttons.length !== 6) note('barre', `${where} : la barre de l'organigramme a ${snap.orgBar.buttons.length} boutons (6 attendus)`);
  const before = snap.cards;
  await clickOn(page, note, '[data-fk="fb:Contrat"]');
  await delay(250);
  snap = await page.run(snapshot);
  if (!snap.panel) { note('barre', `${where} : un bouton de la barre de l'organigramme n'ouvre rien`); return; }
  await clickOn(page, note, `[data-fk="${snap.panel.rows[0].fk}"]`);
  await delay(400);
  snap = await page.run(snapshot);
  if (snap.cards >= before) note('barre', `${where} : une valeur cochée laisse ${snap.cards} cartes dans l'organigramme (moins de ${before} attendues)`);
  await page.press('Escape');
  await clickOn(page, note, '[data-fk="filters-reset"]');
  await delay(300);
  await clickOn(page, note, '[data-fk="v:list"]');
  await delay(400);
  snap = await page.run(snapshot);
  if (!snap.bar || !snap.bar.row) note('barre', `${where} : de retour à la liste, la barre ne revient pas`);
}

async function reload(page, query, { width, mode }) {
  await page.goto(`${await page.run(() => `${location.origin}${location.pathname}`)}${query}`);
  await page.run(() => window.__ready);
  await page.view({ width, scale: 1, mode });
  await page.run(() => { void window.__annuaire.open(); });
  await page.until(() => document.querySelector('.an-person') !== null);
}

export async function filtresProblems(page, t, note, click, { width, mode, language }) {
  const view = { width, mode };
  await reload(page, `?lang=${language}`, view);
  await panelProblems(page, t, note, view);
  await reload(page, `?lang=${language}&filters=bar`, view);
  await barProblems(page, t, note, view);
}
