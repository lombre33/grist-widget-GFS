// L'apparence des dossiers de « Moi » sous Firefox (js/explorer/look-window.js ; demande du porteur du 27/11, règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs).
// Les gestes se font à la vraie souris et au vrai clavier de Firefox, sur la page d'essai (test/pages/explorateur.js : le vrai explorateur, la vraie fenêtre, le vrai `LookGestures` sur un rangement de
// doublure qui tient les lignes d'état), à 700 px : l'article « Apparence… » du menu d'un dossier (juste après « Renommer », dégrisé ; absent sans les gestes), la fenêtre (elle tient dans la page, le
// clavier arrive sur la pastille « par défaut », les flèches changent de pastille, Échap n'écrit rien), la couleur et le repère choisis à la souris (la ligne, le volet et l'aperçu les montrent), l'émoji
// tapé au clavier (il remplace l'icône ; « abc » est refusé avec sa phrase), Ctrl+Z, « Rétablir ». La couleur peinte est celle du jeton de la charte. Ce que chaque geste écrit est dans
// test/folder-looks.test.mjs, ce que Grist en retient dans labo/run-apparence.mjs.
import { createI18n } from '../js/i18n/i18n.js';
import { Run, centerOfName, delay } from './corbeille-firefox.mjs';
import { centerOfMenuItem, menuFits } from './copier-firefox.mjs';

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

// La fenêtre « Apparence » : son titre, le nom du dossier, le nombre de pastilles et d'icônes, la pastille et l'icône cochées, où est le clavier, la phrase, si « Appliquer » est grisé, si elle tient dans la
// page ; null quand elle n'est pas ouverte.
function lookWindow() {
  const win = document.querySelector('.mod.lk-win');
  if (!win) return null;
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const box = win.getBoundingClientRect();
  const outside = [...win.querySelectorAll('*')].filter(node => {
    const at = node.getBoundingClientRect();
    return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1 || at.bottom > box.bottom + 1 || at.top < box.top - 1);
  }).map(node => node.className || node.tagName).slice(0, 5);
  const active = document.activeElement;
  const sizes = [...win.querySelectorAll('.lk-sw, .lk-gl')].map(node => node.getBoundingClientRect()).map(at => Math.min(at.width, at.height));
  const emoji = win.querySelector('.lk-prev .fe');
  return { title: text(win.querySelector('h2')), name: text(win.querySelector('.lk-name')), swatches: win.querySelectorAll('.lk-sw').length, glyphs: win.querySelectorAll('.lk-gl').length,
    color: (win.querySelector('.lk-sw[aria-checked="true"]') || { dataset: {} }).dataset.fk || null, glyph: (win.querySelector('.lk-gl[aria-checked="true"]') || { dataset: {} }).dataset.fk || null,
    previewLook: win.querySelector('.lk-prev').getAttribute('data-look'), previewIcon: emoji ? `emoji:${emoji.textContent}` : (win.querySelector('.lk-prev use') || { getAttribute: () => null }).getAttribute('href'),
    focus: active && active.dataset ? active.dataset.fk || null : null, note: text(win.querySelector('.lk-note')), applyGrey: win.querySelector('[data-fk="look-ok"]').getAttribute('aria-disabled'),
    tabStops: [...win.querySelectorAll('.lk-sw, .lk-gl')].filter(node => node.tabIndex === 0).length, smallest: Math.round(Math.min(...sizes)),
    inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight, outside };
}

// Ce que la liste, le volet et la barre d'information disent d'un dossier : sa couleur (l'attribut), son icône (le dessin ou l'émoji), la couleur peinte du trait (celle du jeton `token`, si on en donne un).
function folderFacts(name, token) {
  const row = [...document.querySelectorAll('.ls-row.folder')].find(item => (item.querySelector('.t') || {}).textContent === name);
  if (!row) return null;
  const emoji = row.querySelector('.nm .fe');
  const svg = row.querySelector('.nm svg.ic');
  const probe = document.createElement('i');
  probe.style.color = token ? `var(${token})` : '';
  row.append(probe);
  const wanted = getComputedStyle(probe).color;
  probe.remove();
  const tree = [...document.querySelectorAll('.tr-row')].find(item => (item.querySelector('.lbl') || {}).textContent === name);
  return { look: row.getAttribute('data-look'), icon: emoji ? `emoji:${emoji.textContent}` : svg.querySelector('use').getAttribute('href'), emojiHidden: emoji ? emoji.getAttribute('aria-hidden') : null,
    stroke: svg ? getComputedStyle(svg).color : null, wanted: token ? wanted : null, treeLook: tree ? tree.getAttribute('data-look') : null,
    size: emoji ? [emoji.getBoundingClientRect().width, emoji.getBoundingClientRect().height] : [svg.getBoundingClientRect().width, svg.getBoundingClientRect().height] };
}

// ---------- la conduite ----------

// Le menu du dossier « Formation », ouvert à la vraie souris ; rend l'état une fois les articles là.
async function menuOf(run, name) {
  const at = await run.page.run(centerOfName, name);
  await run.page.rightClick(...at);
  return run.expect('menu', `le menu de « ${name} » devait s'ouvrir`, state => state.menu.length > 0);
}

async function openLook(run, t, name = 'Formation') {
  await menuOf(run, name);
  const item = await run.page.run(centerOfMenuItem, t('lk.menu'));
  if (!item) { run.note('menu d\'un dossier', `« ${t('lk.menu')} » devait être dans le menu de « ${name} »`); return null; }
  await run.page.click(...item);
  let found = null;
  for (let i = 0; i < 40 && !found; i++) { found = await run.page.run(lookWindow); if (!found) await delay(60); }
  if (!found) run.note('fenêtre « Apparence »', 'la fenêtre devait s\'ouvrir');
  return found;
}

// L'article : juste après « Renommer », avec son icône, dégrisé, sans touche ; absent quand les gestes ne sont pas là ; le menu tient dans la page.
async function menuItem(run, t) {
  await run.reset();
  const without = await menuOf(run, 'Formation');
  if (without.menu.some(item => item.label === t('lk.menu'))) run.note('menu d\'un dossier', 'sans les gestes d\'apparence, l\'article ne devait pas être là');
  await run.page.press('Escape');
  await run.page.run(() => { window.__looksOn = true; });
  const state = await menuOf(run, 'Formation');
  const labels = state.menu.map(item => item.label);
  const at = labels.indexOf(t('lk.menu'));
  if (at < 1 || labels[at - 1] !== t('ex.rename') || state.menu[at].greyed || state.menu[at].hint !== null) {
    run.note('menu d\'un dossier', `« ${t('lk.menu')} » devait suivre « ${t('ex.rename')} », dégrisé et sans touche (${labels.join(' · ')} ; ${JSON.stringify(state.menu[at])})`);
  }
  const hasIcon = await run.page.run(label => { const item = [...document.querySelectorAll('.menu .menu-item')].find(node => node.querySelector('.menu-label').textContent.trim() === label); return Boolean(item && item.querySelector('svg')); }, t('lk.menu'));
  if (!hasIcon) run.note('menu d\'un dossier', 'l\'article devait avoir son icône');
  const fits = await run.page.run(menuFits);
  if (fits.length) run.note('menu d\'un dossier', `le menu devait tenir dans la page (${fits.join(' ; ')})`);
  await run.page.press('Escape');
}

// La fenêtre : titre, nom, huit pastilles, treize icônes, clavier sur « par défaut », flèches, un arrêt de tabulation par groupe, tient dans la page ; Échap n'écrit rien.
async function windowShape(run, t) {
  await run.reset();
  await run.page.run(() => { window.__looksOn = true; });
  const found = await openLook(run, t);
  if (!found) return;
  if (found.title !== t('lk.title') || found.name !== 'Formation') run.note('fenêtre « Apparence »', `la fenêtre devait porter son titre et le nom du dossier (${found.title} ; ${found.name})`);
  if (found.swatches !== 8 || found.glyphs !== 13) run.note('fenêtre « Apparence »', `huit pastilles et treize icônes attendues (${found.swatches} ; ${found.glyphs})`);
  if (found.focus !== 'look-color-default' || found.color !== 'look-color-default' || found.glyph !== 'look-glyph-folder') {
    run.note('fenêtre « Apparence »', `le clavier devait être sur la pastille « par défaut », cochée, avec le dossier d'origine coché (${found.focus} ; ${found.color} ; ${found.glyph})`);
  }
  if (found.tabStops !== 2) run.note('fenêtre « Apparence »', `un seul arrêt de tabulation par groupe (la pastille et l'icône cochées) : ${found.tabStops} arrêts`);
  if (found.smallest < 26) run.note('fenêtre « Apparence »', `chaque pastille et chaque icône devait mesurer 26 px au moins (${found.smallest})`);
  if (!found.inPage || found.outside.length) run.note('fenêtre « Apparence »', `la fenêtre devait tenir dans la page, rien n'en sortir (${found.inPage} ; ${found.outside.join(', ')})`);
  await run.page.press('ArrowRight');
  let now = await run.page.run(lookWindow);
  if (now.color !== 'look-color-gray' || now.previewLook !== 'gray' || now.focus !== 'look-color-gray') run.note('fenêtre « Apparence »', `la flèche droite devait choisir « gris » et l'aperçu le montrer (${JSON.stringify([now.color, now.previewLook, now.focus])})`);
  await run.page.press('End');
  now = await run.page.run(lookWindow);
  if (now.color !== 'look-color-purple') run.note('fenêtre « Apparence »', `Fin devait choisir la dernière couleur (${now.color})`);
  await run.page.press('Home');
  now = await run.page.run(lookWindow);
  if (now.color !== 'look-color-default' || now.previewLook !== null) run.note('fenêtre « Apparence »', `Début devait revenir à « par défaut » (${now.color} ; ${now.previewLook})`);
  await run.page.press('Escape');
  await run.expect('Échap', 'Échap devait fermer la fenêtre sans rien écrire', state => state.modal === null);
  const lines = await run.page.run(() => window.__lookLines());
  if (lines.length !== 0) run.note('Échap', `Échap ne devait rien écrire (${JSON.stringify(lines)})`);
}

// La couleur et le repère, à la souris : la ligne, le volet, l'aperçu ; la couleur peinte est celle du jeton de la charte ; la ligne d'état dit { couleur, repère }.
async function colorAndGlyph(run, t) {
  await run.reset();
  await run.page.run(() => { window.__looksOn = true; });
  if (!(await openLook(run, t))) return;
  await run.clickSelector('[data-fk="look-color-red"]');
  await run.clickSelector('[data-fk="look-glyph-star"]');
  const shown = await run.page.run(lookWindow);
  if (shown.previewLook !== 'red' || shown.previewIcon !== '#i-fl-star') run.note('fenêtre « Apparence »', `l'aperçu devait montrer le rouge et l'étoile (${shown.previewLook} ; ${shown.previewIcon})`);
  await run.clickSelector('[data-fk="look-ok"]');
  await run.expect('Appliquer', 'Appliquer devait fermer la fenêtre', state => state.modal === null);
  await delay(100);
  const facts = await run.page.run(folderFacts, 'Formation', '--t-pdf');
  if (!facts || facts.look !== 'red' || facts.icon !== '#i-fl-star' || facts.treeLook !== 'red') run.note('liste', `la ligne et le volet devaient montrer le rouge et l'étoile (${JSON.stringify(facts)})`);
  if (facts && facts.stroke !== facts.wanted) run.note('liste', `le trait devait avoir la couleur du jeton --t-pdf (${facts.stroke} ; ${facts.wanted})`);
  const lines = await run.page.run(() => window.__lookLines());
  if (lines.length !== 1 || lines[0].folder !== 'Formation' || lines[0].value !== JSON.stringify({ look: { color: 'red', glyph: 'star' } })) run.note('Appliquer', `une ligne d'état « Formation » { rouge, étoile } (${JSON.stringify(lines)})`);
  await run.click('Formation');
  const info = await run.page.run(() => (document.querySelector('.inf') || { getAttribute: () => null }).getAttribute('data-look'));
  if (info !== 'red') run.note('barre d\'information', `la barre du dossier choisi devait avoir la couleur (${info})`);
}

// L'émoji tapé au clavier : « abc » refusé avec sa phrase, Entrée n'écrit rien ; « 🧾 » prend la place de l'icône, à la taille de l'icône, caché pour la lecture d'écran ; le nom ne change pas.
async function emoji(run, t) {
  await run.reset();
  await run.page.run(() => { window.__looksOn = true; });
  if (!(await openLook(run, t))) return;
  await run.clickSelector('[data-fk="look-emoji"]');
  for (const key of ['a', 'b', 'c']) await run.page.press(key);
  let now = await run.page.run(lookWindow);
  if (now.note !== t('lk.emojiBad') || now.applyGrey !== 'true') run.note('émoji', `« abc » devait être refusé avec sa phrase, « Appliquer » grisé (${now.note} ; ${now.applyGrey})`);
  await run.page.press('Enter');
  await delay(150);
  now = await run.page.run(lookWindow);
  const lines = await run.page.run(() => window.__lookLines());
  if (!now || lines.length !== 0) run.note('émoji', `Entrée ne devait rien écrire ni fermer la fenêtre avec « abc » (${JSON.stringify(lines)})`);
  for (let i = 0; i < 3; i++) await run.page.press('Backspace');
  await run.page.press('🧾');
  now = await run.page.run(lookWindow);
  if (now.note !== '' || now.previewIcon !== 'emoji:🧾' || now.glyph !== null) run.note('émoji', `« 🧾 » devait être accepté : l'aperçu l'affiche, aucune icône cochée (${JSON.stringify([now.note, now.previewIcon, now.glyph])})`);
  await run.page.press('Enter');
  await run.expect('Entrée', 'Entrée devait appliquer et fermer la fenêtre', state => state.modal === null);
  await delay(100);
  const facts = await run.page.run(folderFacts, 'Formation', null);
  if (!facts || facts.icon !== 'emoji:🧾' || facts.emojiHidden !== 'true') run.note('liste', `la ligne devait montrer l'émoji, caché pour la lecture d'écran (${JSON.stringify(facts)})`);
  if (facts && (Math.abs(facts.size[0] - 15) > 1 || Math.abs(facts.size[1] - 15) > 1)) run.note('liste', `l'émoji devait avoir la taille de l'icône (15 px : ${facts.size.join(' × ')})`);
  const names = await run.page.run(() => [...document.querySelectorAll('.ls-row.folder .t')].map(node => node.textContent));
  if (!names.includes('Formation')) run.note('liste', `le nom du dossier devait rester « Formation » (${names.join(', ')})`);
}

// Ctrl+Z défait le changement (la phrase le dit), Ctrl+Y le refait ; « Rétablir » rend le dossier d'origine.
async function undoAndReset(run, t) {
  await run.reset();
  await run.page.run(() => { window.__looksOn = true; });
  if (!(await openLook(run, t))) return;
  await run.clickSelector('[data-fk="look-color-blue"]');
  await run.clickSelector('[data-fk="look-ok"]');
  await run.expect('Appliquer', 'Appliquer devait fermer la fenêtre', state => state.modal === null);
  await run.click('Formation');
  await run.page.chord('Control', 'z');
  await run.expect('Ctrl+Z', 'Ctrl+Z devait défaire la couleur, avec sa phrase', state => state.notices.at(-1) === t('undo.look', { name: 'Formation' }));
  let facts = await run.page.run(folderFacts, 'Formation', null);
  if (!facts || facts.look !== null || facts.icon !== '#i-folder') run.note('Ctrl+Z', `le dossier devait avoir repris son aspect d'origine (${JSON.stringify(facts)})`);
  await run.page.chord('Control', 'y');
  await run.expect('Ctrl+Y', 'Ctrl+Y devait remettre la couleur', state => state.notices.at(-1) === t('redo.look', { name: 'Formation' }));
  facts = await run.page.run(folderFacts, 'Formation', null);
  if (!facts || facts.look !== 'blue') run.note('Ctrl+Y', `le dossier devait être bleu de nouveau (${JSON.stringify(facts)})`);
  const found = await openLook(run, t);
  if (!found) return;
  if (found.color !== 'look-color-blue') run.note('fenêtre « Apparence »', `la fenêtre devait montrer la couleur d'aujourd'hui (${found.color})`);
  await run.clickSelector('[data-fk="look-reset"]');
  const reset = await run.page.run(lookWindow);
  if (reset.previewLook !== null || reset.previewIcon !== '#i-folder' || reset.color !== 'look-color-default') run.note('« Rétablir »', `l'aperçu devait reprendre le dossier d'origine (${JSON.stringify([reset.previewLook, reset.previewIcon, reset.color])})`);
  await run.clickSelector('[data-fk="look-ok"]');
  await run.expect('Appliquer', 'Appliquer devait fermer la fenêtre', state => state.modal === null);
  const lines = await run.page.run(() => window.__lookLines());
  if (lines.length !== 1 || lines[0].value !== '') run.note('« Rétablir »', `la cellule devait être vide, la ligne gardée (${JSON.stringify(lines)})`);
}

// Au clavier : Maj+F10 sur le dossier ouvre son menu et les flèches amènent le clavier sur l'article ; la fenêtre ouverte, Tab ne sort pas d'elle et visite le champ et les trois boutons ; Échap la ferme et
// rend le clavier à la liste. (Entrée sur un `<button>` ne fait pas de clic avec ce pilote de Firefox : le pilote envoie la touche, Firefox n'en tire pas de clic, mesuré le 27/11 sur un bouton nu ;
// l'activation de l'article au clavier se mesure sous Chromium, labo/run-apparence.mjs, étape 1.)
async function keyboardOnly(run, t) {
  await run.reset();
  await run.page.run(() => { window.__looksOn = true; });
  await run.click('Formation');
  await run.page.chord('Shift', 'F10');
  const state = await run.expect('menu', 'Maj+F10 devait ouvrir le menu du dossier', now => now.menu.length > 0);
  if (state.menu.findIndex(item => item.label === t('lk.menu')) < 0) { run.note('clavier', `l'article « ${t('lk.menu')} » devait être dans le menu ouvert au clavier`); await run.page.press('Escape'); return; }
  // l'ouverture au clavier pose déjà le clavier sur un article : on lit où il est avant chaque pas
  const onItem = () => run.page.run(() => { const node = document.activeElement; return node && node.classList.contains('menu-item') ? node.querySelector('.menu-label').textContent.trim() : null; });
  for (let i = 0; i < 12 && (await onItem()) !== t('lk.menu'); i++) await run.page.press('ArrowDown');
  if ((await onItem()) !== t('lk.menu')) run.note('clavier', `les flèches devaient amener le clavier sur « ${t('lk.menu')} »`);
  await run.page.press('Escape');
  await run.expect('Échap dans le menu', 'Échap devait fermer le menu', now => now.menu.length === 0);
  if (!(await openLook(run, t))) return;
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    await run.page.press('Tab');
    const now = await run.page.run(() => ({ inside: Boolean(document.activeElement.closest('.mod.lk-win')), fk: document.activeElement.dataset ? document.activeElement.dataset.fk || null : null }));
    if (!now.inside) { run.note('clavier', `Tab devait rester dans la fenêtre (le clavier est parti : ${JSON.stringify(now)})`); break; }
    seen.add(now.fk);
  }
  for (const key of ['look-emoji', 'look-ok', 'look-reset', 'look-cancel']) if (!seen.has(key)) run.note('clavier', `Tab devait visiter ${key} (${[...seen].join(', ')})`);
  await run.page.press('Escape');
  await run.expect('Échap', 'Échap devait fermer la fenêtre', now => now.modal === null);
}

// Les mesures de l'apparence des dossiers, dans la langue de la page ; rend les écarts { kind, text }.
export async function apparenceProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'apparence des dossiers');
  for (const step of [menuItem, windowShape, colorAndGlyph, emoji, undoAndReset, keyboardOnly]) {
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
