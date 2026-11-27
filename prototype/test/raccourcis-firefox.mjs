// Les raccourcis de fichiers sous Firefox (demande du porteur du 27/11 : « le bouton pour créer des raccourcis de fichier doit fonctionner partout » ; règle du 03/11 : toute nouvelle interface ajoute ses mesures à
// test/interfaces-firefox.test.mjs). Les gestes se font à la vraie souris et au vrai clavier de Firefox, sur la page d'essai (test/pages/explorateur.js : le vrai explorateur, les vraies fenêtres du rangement, le vrai
// `ShortcutGestures` sur un rangement de doublure qui tient les lignes `gfs-shortcut`), à 700 px : l'article « Créer un raccourci… » dans le menu d'un fichier de « Moi » et de « Récents », grisé pendant un choix, la fenêtre du
// dossier (elle tient dans la page, aucun dossier d'espace), le raccourci dans son dossier (une ligne de 28 px, le mot « Raccourci · type », pas d'étoile), son menu, « Aller au fichier d'origine », Suppr puis Ctrl+Z, la
// ligne grisée quand son fichier part à la corbeille. Ce que chaque geste écrit est dans test/shortcuts.test.mjs, ce que Grist en retient dans labo/run-raccourcis.mjs.
import { createI18n } from '../js/i18n/i18n.js';
import { Run, centerOfName, names } from './corbeille-firefox.mjs';
import { centerOfMenuItem, menuFits } from './copier-firefox.mjs';
import { measureRows } from '../labo/mesures-liste.mjs';

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

// La fenêtre du dossier : son titre, ses articles, où est le clavier, si elle tient dans la page et si rien n'en sort ; null quand elle n'est pas ouverte.
function folderWindow() {
  const win = document.querySelector('.mod.mv');
  if (!win) return null;
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const box = win.getBoundingClientRect();
  const outside = [...win.querySelectorAll('*')].filter(node => {
    const at = node.getBoundingClientRect();
    return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1 || at.bottom > box.bottom + 1 || at.top < box.top - 1);
  }).map(node => node.className || node.tagName).slice(0, 5);
  const active = document.activeElement;
  return { title: text(win.querySelector('h2')), items: [...win.querySelectorAll('.wk-item')].map(node => node.dataset.fk), focus: active && active.dataset ? active.dataset.fk || null : null,
    inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight, outside };
}

// Le centre d'un article de la fenêtre du dossier, par son `data-fk`.
function centerOfWindowItem(fk) {
  const node = document.querySelector(`.mod.mv .wk-item[data-fk="${fk}"]`);
  if (!node) return null;
  const box = node.getBoundingClientRect();
  return [box.left + box.width / 2, box.top + box.height / 2];
}

// Ce que la liste dit d'un raccourci : sa pastille, son poids, s'il a une étoile, s'il est grisé (et son infobulle), par le nom de la ligne ; null sans cette ligne.
function shortcutFacts(name) {
  const row = [...document.querySelectorAll('.ls-row')].find(item => (item.querySelector('.t') || {}).textContent === name && item.querySelector('.pill') && /^(Raccourci|Shortcut)/.test(item.querySelector('.pill').textContent.trim()));
  if (!row) return null;
  return { pill: row.querySelector('.pill').textContent.trim(), weight: row.querySelector('.wt').textContent.trim(), pin: Boolean(row.querySelector('.rb.pin')), grey: row.classList.contains('lk'), title: row.getAttribute('title') };
}

// ---------- la conduite ----------

async function openFolder(run, name) {
  await run.click(name);
  await run.page.press('Enter');
  await run.expect('ouvrir un dossier', `Entrée devait ouvrir le dossier « ${name} »`, state => state.crumbs.includes(name));
}

// Le menu d'un fichier, ouvert à la vraie souris ; rend l'état une fois les articles là.
async function menuOf(run, name) {
  const at = await run.page.run(centerOfName, name);
  await run.page.rightClick(...at);
  return run.expect('menu', `le menu de « ${name} » devait s'ouvrir`, state => state.menu.length > 0);
}

// « Créer un raccourci… » depuis le menu de « Convocation » : l'article, la fenêtre du dossier, le choix de « Formation », le raccourci écrit et dit.
async function createFromMenu(run, t) {
  await run.reset();
  await run.page.run(() => { window.__shortcutsOn = true; });
  const state = await menuOf(run, 'Convocation');
  const entry = state.menu.find(item => item.label === t('sc.menu'));
  if (!entry || entry.greyed || entry.hint !== null) run.note('menu d\'un fichier', `« ${t('sc.menu')} » devait être dans le menu de « Convocation », dégrisé et sans touche (${JSON.stringify(entry)})`);
  const fits = await run.page.run(menuFits);
  if (fits.length) run.note('menu d\'un fichier', `le menu devait tenir dans la page (${fits.join(' ; ')})`);
  const item = await run.page.run(centerOfMenuItem, t('sc.menu'));
  await run.page.click(...item);
  let found = null;
  for (let i = 0; i < 40 && !found; i++) { found = await run.page.run(folderWindow); if (!found) await new Promise(resolve => setTimeout(resolve, 60)); }
  if (!found) { run.note('fenêtre du dossier', 'la fenêtre du dossier devait s\'ouvrir'); return; }
  if (found.title !== t('sc.pick.title', { name: 'Convocation' }) || found.focus !== 'move-search') run.note('fenêtre du dossier', `la fenêtre devait nommer le fichier et donner le clavier à la recherche (${found.title} ; ${found.focus})`);
  if (!found.inPage || found.outside.length) run.note('fenêtre du dossier', `la fenêtre devait tenir dans la page, rien n'en sortir (${found.inPage} ; ${found.outside.join(', ')})`);
  if (found.items.some(fk => fk.startsWith('move-Espaces')) || !found.items.includes('move-Formation')) run.note('fenêtre du dossier', `aucun dossier d'espace, mais « Formation » (${found.items.join(', ')})`);
  const at = await run.page.run(centerOfWindowItem, 'move-Formation');
  await run.page.click(...at);
  await run.expect('raccourci créé', 'choisir « Formation » devait écrire le raccourci, fermer la fenêtre et le dire ; le fichier reste à la racine', now => now.notices.at(-1) === t('sc.done', { name: 'Convocation', folder: 'Formation' })
    && names(now).includes('Convocation'));
  const lines = await run.page.run(() => window.__shortcutLines());
  if (lines.length !== 1 || lines[0].folder !== 'Formation' || lines[0].name !== 'Convocation') run.note('raccourci créé', `une ligne, dans « Formation », au nom du fichier (${JSON.stringify(lines)})`);
}

// Le raccourci dans son dossier : une ligne de 28 px, centrée, le mot « Raccourci · type », un tiret pour le poids, pas d'étoile ; son menu et « Aller au fichier d'origine ».
async function shortcutRow(run, t) {
  await createFromMenu(run, t);
  await openFolder(run, 'Formation');
  const facts = await run.page.run(shortcutFacts, 'Convocation');
  if (!facts) { run.note('liste', 'le dossier « Formation » devait montrer le raccourci « Convocation »'); return; }
  if (!facts.pill.startsWith(t('sc.type')) || facts.weight !== '—' || facts.pin || facts.grey) run.note('ligne d\'un raccourci', `la ligne devait dire « ${t('sc.type')} · type », un tiret pour le poids, sans étoile ni grisé (${JSON.stringify(facts)})`);
  for (const row of (await run.page.run(measureRows)).filter(each => each.name === 'Convocation')) {
    if (Math.abs(row.height - 28) > 0.5 || row.off > 1 || row.out > 0.5) run.note('ligne d\'un raccourci', `la ligne devait mesurer 28 px, son contenu centré dans la ligne (${JSON.stringify(row)})`);
  }
  const state = await menuOf(run, 'Convocation');
  const labels = state.menu.map(item => item.label);
  const wanted = [t('ex.open'), t('sc.origin'), t('ex.rename'), t('ex.move'), t('sc.remove')];
  if (JSON.stringify(labels) !== JSON.stringify(wanted)) run.note('menu d\'un raccourci', `le menu devait être ${wanted.join(' · ')} (${labels.join(' · ')})`);
  const fits = await run.page.run(menuFits);
  if (fits.length) run.note('menu d\'un raccourci', `le menu devait tenir dans la page (${fits.join(' ; ')})`);
  const origin = await run.page.run(centerOfMenuItem, t('sc.origin'));
  await run.page.click(...origin);
  await run.expect('aller au fichier d\'origine', 'le menu devait ouvrir « Moi » sur « Convocation », choisi', now => !now.crumbs.includes('Formation') && now.selected === 'Convocation' && names(now).includes('Convocation'));
}

// Suppr retire le raccourci (le fichier reste), Ctrl+Z le rend, un second Ctrl+Z le défait.
async function removeAndUndo(run, t) {
  await createFromMenu(run, t);
  await openFolder(run, 'Formation');
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('Suppr', 'Suppr devait retirer le raccourci et le dire, sans toucher au fichier', now => now.notices.at(-1) === t('sc.removed', { name: 'Convocation' }) && !names(now).includes('Convocation'));
  const gone = await run.page.run(() => window.__shortcutLines());
  if (gone.length !== 0) run.note('Suppr', `la ligne du raccourci devait être retirée (${JSON.stringify(gone)})`);
  await run.page.chord('Control', 'z');
  await run.expect('Ctrl+Z', 'Ctrl+Z devait rendre le raccourci, avec sa phrase', now => now.notices.at(-1) === t('undo.shortcutRemoved', { name: 'Convocation' }) && names(now).includes('Convocation'));
  await run.page.chord('Control', 'z');
  await run.expect('Ctrl+Z, encore', 'un second Ctrl+Z devait défaire la création', now => now.notices.at(-1) === t('undo.shortcutCreated', { name: 'Convocation' }) && !names(now).includes('Convocation'));
}

// Le fichier visé part à la corbeille : le raccourci reste, grisé, avec sa phrase en infobulle, jamais effacé.
async function greyed(run, t) {
  await createFromMenu(run, t);
  await run.click('Convocation');
  await run.page.press('Delete');
  await run.expect('corbeille', 'Suppr devait mettre « Convocation » à la corbeille', now => now.notices.at(-1) === t('trash.moved', { name: 'Convocation' }));
  await openFolder(run, 'Formation');
  const facts = await run.page.run(shortcutFacts, 'Convocation');
  if (!facts || !facts.grey || facts.title !== t('sc.missing')) run.note('raccourci grisé', `le raccourci devait rester, grisé, avec sa phrase en infobulle (${JSON.stringify(facts)})`);
  const lines = await run.page.run(() => window.__shortcutLines());
  if (lines.length !== 1) run.note('raccourci grisé', 'sa ligne ne devait pas être effacée');
}

// Depuis « Récents », le même article est là et dégrisé ; Échap dans la fenêtre du dossier n'écrit rien.
async function fromRecent(run, t) {
  await run.reset();
  await run.page.run(() => { window.__shortcutsOn = true; });
  await run.clickSelector('.tr-row[data-view="recent"]');
  const state = await menuOf(run, 'Contrat de prestation');
  const entry = state.menu.find(item => item.label === t('sc.menu'));
  if (!entry || entry.greyed) run.note('« Récents »', `« ${t('sc.menu')} » devait être dans le menu d'un fichier de « Récents », dégrisé (${JSON.stringify(entry)})`);
  const item = await run.page.run(centerOfMenuItem, t('sc.menu'));
  await run.page.click(...item);
  await run.page.run(() => new Promise(resolve => { const wait = () => (document.querySelector('.mod.mv') ? resolve() : setTimeout(wait, 40)); wait(); }));
  await run.page.press('Escape');
  await run.expect('Échap', 'Échap devait fermer la fenêtre sans rien écrire', now => now.modal === null);
  const lines = await run.page.run(() => window.__shortcutLines());
  const open = await run.page.run(folderWindow);
  if (lines.length !== 0 || open !== null) run.note('Échap', `Échap ne devait rien écrire et fermer la fenêtre (${JSON.stringify(lines)})`);
}

// Pendant un choix de fichier demandé par une app : l'article est grisé, sans touche, et le clic le dit.
async function whileChoosing(run, t) {
  await run.reset();
  await run.page.run(() => { window.__shortcutsOn = true; });
  await run.page.run(() => window.__explorer.enterChoice({ title: 'Choisir', accept: () => true, onPick: () => {}, onCancel: () => {} }));
  const state = await menuOf(run, 'Convocation');
  const entry = state.menu.find(item => item.label === t('sc.menu'));
  if (!entry || !entry.greyed) run.note('pendant un choix', `« ${t('sc.menu')} » devait être grisé pendant un choix (${JSON.stringify(entry)})`);
  const item = await run.page.run(centerOfMenuItem, t('sc.menu'));
  await run.page.click(...item);
  await run.expect('pendant un choix', 'le clic sur l\'article grisé devait dire pourquoi, sans ouvrir de fenêtre', now => now.notices.at(-1) === t('ex.choose.newOff'));
  await run.page.press('Escape');
  await run.page.run(() => window.__explorer.exitChoice());
}

// Les mesures des raccourcis, dans la langue de la page ; rend les écarts { kind, text }.
export async function raccourcisProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'raccourcis de fichiers');
  for (const step of [shortcutRow, removeAndUndo, greyed, fromRecent, whileChoosing]) {
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
