// Le thème de GFS (décision du porteur, 03/11 ; contrats 5.2, point 10), dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier (Playwright : événements du pointeur et
// du clavier du navigateur, jamais dispatchEvent). LAB_LANG=fr|en, LAB_SCHEME=light|dark, LAB_W (largeur du panneau, 700 ; sous 520 le bouton ne garde que son icône). Ce que la passe mesure :
//   1. le départ : rien n'est posé sur la page (aspect d'origine), le bouton « Thème » est à côté de « Langue » ;
//   2. la fenêtre, à la souris : cinq vignettes, la charte d'origine choisie, le fond inerte, le clavier dedans, tout dans 700 × 400 ;
//   3. un choix : l'ambiance est posée sur la page tout de suite (`data-ambiance`, jetons de couleur et de forme), retenue (`gfs.theme`), les vignettes montrent la couleur choisie ;
//   4. le clavier : Entrée ouvre, les flèches choisissent, Tab traverse la fenêtre sans s'arrêter sur chaque vignette, Échap ferme et rend le clavier au bouton ;
//   5. chaque ambiance, dans le mode de Grist : la page est lisible (contraste de 4,5:1 au moins pour chaque texte de l'explorateur et de la fenêtre, mesuré sur les couleurs affichées) ;
//   6. retenu sur le navigateur : GFS rechargé repart dans l'ambiance choisie ;
//   7. les apps suivent : la sonde M (labo/sondes/m-ambiance/) reçoit l'ambiance dans son contexte, puis l'événement `ambiance` à chaque changement (`null` au retour à l'origine), sans que son cadre
//      soit rechargé ;
//   8. « Revenir à Grist Factory » : la page retrouve l'aspect d'origine, les deux clés disparaissent ;
//   9. la couleur libre, avec le sélecteur de couleur des documents (celui du kit, sous-module `kit/`) : « Choisir ma couleur » ouvre la palette sous le bouton (souris et clavier : flèches, Début, Fin,
//      Tab, Entrée, Échap, clic dehors, clic sur le voile), une pastille pose la couleur tout de suite (page, clé `gfs.couleur`, bouton, apps), « Personnalisé… » ouvre la fenêtre « Couleur personnalisée »
//      par-dessus la fenêtre « Thème » (Échap ne ferme que celle du dessus, un code faux grise « Appliquer », « Appliquer » pose la couleur), « Celle de l'ambiance » rend la couleur à l'ambiance,
//      « La mienne » reprend la dernière couleur à soi (ou ouvre la palette faute d'en avoir), tout dans 700 × 400, contraste de 4,5:1 compris ;
//   10. un navigateur qui refuse de retenir : le choix (l'ambiance et la couleur) vaut pour la page, la fenêtre le dit ;
//   11. un kit qui ne se charge pas (le sous-module n'est pas servi) : « La mienne » et son bouton sont grisés, la raison est dite dans la fenêtre, un seul avertissement de GFS, les ambiances marchent.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const panelWidth = Number(process.env.LAB_W || 700);
const run = `theme-${lang}-${scheme}${panelWidth === 700 ? '' : `-${panelWidth}`}`;
const WORDS = {
  fr: { button: 'Thème', title: 'Thème', reset: 'Revenir à Grist Factory', close: 'Fermer', names: ['Grist Factory', 'Pop', 'Papier', 'Brut', 'Néon'], saved: 'S’applique tout de suite, reste sur ce navigateur.',
    notKept: 'Ce choix vaut pour cette page seulement : ton navigateur refuse de le garder.', check: /^Couleurs calculées : contraste de \d,\d:1 au moins/, origin: /^Ambiance d’origine : contraste de \d,\d:1 au moins/,
    own: 'La mienne', none: 'Celle de l’ambiance', pick: 'Choisir ma couleur', customBtn: 'Personnalisé…', custom: 'Couleur personnalisée', apply: 'Appliquer', cancel: 'Annuler', palette: 'Palette de couleurs',
    missing: 'Le sélecteur de couleur ne s’est pas chargé : GFS garde la couleur de l’ambiance. Recharge la page pour réessayer.' },
  en: { button: 'Theme', title: 'Theme', reset: 'Back to Grist Factory', close: 'Close', names: ['Grist Factory', 'Pop', 'Paper', 'Raw', 'Neon'], saved: 'Applies right away, stays on this browser.',
    notKept: 'This choice only holds for this page: your browser refuses to keep it.', check: /^Computed colors: contrast of at least \d\.\d:1/, origin: /^Original look: contrast of at least \d\.\d:1/,
    own: 'My own', none: 'The look’s color', pick: 'Choose my color', customBtn: 'Custom…', custom: 'Custom color', apply: 'Apply', cancel: 'Cancel', palette: 'Color palette',
    missing: 'The color picker did not load: GFS keeps the look’s color. Reload the page to try again.' },
};
const words = WORDS[lang];
const IDS = ['defaut', 'pop', 'papier', 'brut', 'neon'];

const lab = await startLab({ lang, colorScheme: scheme, probes: true });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && /GFS/.test(m.text())) warnings.push(m.text().slice(0, 200)); });
await lab.fitPanel(undefined, panelWidth, 400);
say('semis :', await seedFiles(lab.frame));
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
let frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);
const shot = name => lab.shotPanel(run, name, frame);
const reload = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(500);
};
const waitFor = async (label, test) => {
  for (let i = 0; i < 60; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
const button = () => frame.locator('.tb-theme');
const stored = () => frame.evaluate(() => { try { return { theme: localStorage.getItem('gfs.theme'), couleur: localStorage.getItem('gfs.couleur') }; } catch (error) { return 'REFUSÉ'; } });
// Ce que la page porte : l'ambiance, le nombre de jetons posés en ligne sur <html>, quelques valeurs calculées qui disent la forme et la couleur.
const page_ = () => frame.evaluate(() => {
  const root = document.documentElement;
  const css = (selector, property) => { const node = document.querySelector(selector); return node ? getComputedStyle(node)[property] : null; };
  return {
    ambiance: root.getAttribute('data-ambiance'), inline: [...root.style].filter(name => name.startsWith('--')).length, grist: [...root.style].filter(name => !name.startsWith('--')), accent: getComputedStyle(root).getPropertyValue('--accent').trim(), mode: getComputedStyle(root).colorScheme,
    newRadius: css('.btn.primary', 'borderTopLeftRadius'), titleWeight: css('.ex-title', 'fontWeight'), titleFont: (css('.ex-title', 'fontFamily') || '').slice(0, 24), exBg: css('.ex', 'backgroundColor'),
  };
});
const windowState = () => frame.evaluate(() => {
  const win = document.querySelector('.th-win');
  if (!win) return null;
  const box = win.getBoundingClientRect();
  const body = win.querySelector('.mod-body');
  const checked = [...win.querySelectorAll('input[name="amb"]')].find(input => input.checked);
  return {
    box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }, viewport: { w: innerWidth, h: innerHeight }, scrolls: body.scrollHeight > body.clientHeight + 1,
    tiles: win.querySelectorAll('.amb').length, checked: checked ? checked.value : null, inertExplorer: document.querySelector('.ex').inert, inertFrames: document.getElementById('frames').inert,
    focus: document.activeElement ? (document.activeElement.dataset.fk || document.activeElement.className || document.activeElement.tagName) : null, inside: win.contains(document.activeElement),
    check: win.querySelector('.th-check').textContent.replace(/\s+/g, ' ').trim(), note: win.querySelector('.mod-note').textContent.trim(), names: [...win.querySelectorAll('.amb-name')].map(n => n.textContent),
    adjusted: !win.querySelector('.th-adj').hidden && win.querySelector('.th-adj').textContent.trim() !== '',
  };
});
const openWindow = async () => { await button().click(); await frame.locator('.th-win').waitFor(); };
const closeWindow = async () => { await frame.locator('.th-win [data-fk="close"]').click(); await frame.locator('.th-win').waitFor({ state: 'detached' }); };
const tile = id => frame.locator('.amb', { has: frame.locator(`input[value="${id}"]`) });
const pickButton = () => frame.locator('.th-win [data-fk="col:pick"]');
const colorLabel = text => frame.locator('.th-win label.rd', { hasText: text });
const openPalette = async () => { await pickButton().click(); await frame.locator('.menu-panel').waitFor(); };
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const inside = (box, view) => box.x >= 0 && box.y >= 0 && box.x + box.w <= view.w && box.y + box.h <= view.h;
// Le groupe « Couleur » de la fenêtre « Thème » : quel choix est coché, ce que montre le bouton, où est le clavier.
const colorBox = () => frame.evaluate(() => {
  const win = document.querySelector('.th-win');
  if (!win) return null;
  const pick = win.querySelector('[data-fk="col:pick"]');
  const active = document.activeElement;
  return {
    own: win.querySelector('input[name="col"][value="own"]').checked, amb: win.querySelector('input[name="col"][value="amb"]').checked, pick: pick.textContent.trim(), expanded: pick.getAttribute('aria-expanded'),
    swatch: getComputedStyle(win.querySelector('.sw')).backgroundColor, focus: active ? (active.dataset.fk || active.className || active.tagName) : null, panel: Boolean(document.querySelector('.menu-panel')),
    why: [...win.querySelectorAll('.th-adj')].filter(node => !node.hidden).map(node => node.textContent.trim()),
  };
});
// La palette de couleur (le panneau sous le bouton), telle qu'on la voit : sa place, ses pastilles, où est le clavier.
const panelState = () => frame.evaluate(() => {
  const panel = document.querySelector('.menu-panel');
  if (!panel) return null;
  const box = panel.getBoundingClientRect();
  const pick = document.querySelector('.th-win [data-fk="col:pick"]').getBoundingClientRect();
  const active = document.activeElement;
  const mid = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
  const where = node => {
    if (!node) return null;
    if (node.classList.contains('cp-swatch')) return `pastille ${node.dataset.color}`;
    return node.classList.contains('cp-custom') ? 'perso' : (node.classList.contains('cp-none') ? 'ambiance' : (node.dataset.fk || node.className || node.tagName));
  };
  const round = rect => ({ x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) });
  return {
    box: round(box), anchor: round(pick), viewport: { w: innerWidth, h: innerHeight }, scrolls: panel.scrollHeight > panel.clientHeight + 1, onTop: Boolean(mid && panel.contains(mid)),
    swatches: panel.querySelectorAll('.cp-grid .cp-swatch').length, expanded: document.querySelector('.th-win [data-fk="col:pick"]').getAttribute('aria-expanded'), in: panel.contains(active), focus: where(active),
    marked: [...panel.querySelectorAll('.cp-swatch.is-active')].map(node => node.dataset.color), custom: panel.querySelector('.cp-custom').classList.contains('is-active'), none: panel.querySelector('.cp-none').classList.contains('is-active'),
    words: { custom: panel.querySelector('.cp-custom').textContent.trim(), none: panel.querySelector('.cp-none').textContent.trim(), group: panel.querySelector('.cp-grid').getAttribute('aria-label') },
    winOpen: Boolean(document.querySelector('.th-win')),
  };
});
// La fenêtre « Couleur personnalisée » (posée par-dessus la fenêtre « Thème »).
const editorState = () => frame.evaluate(() => {
  const win = document.querySelector('.th-edit');
  if (!win) return null;
  const box = win.getBoundingClientRect();
  const body = win.querySelector('.mod-body');
  const active = document.activeElement;
  const hex = win.querySelector('.cp-hex');
  const apply = win.querySelector('[data-fk="tc-apply"]');
  const theme = document.querySelector('.th-win');
  const mid = document.elementFromPoint(box.x + box.width / 2, box.y + 14);
  return {
    box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }, viewport: { w: innerWidth, h: innerHeight }, scrolls: body.scrollHeight > body.clientHeight + 1, onTop: Boolean(mid && win.contains(mid)),
    in: win.contains(active), onHex: active === hex, title: win.querySelector('h2').textContent, hex: hex.value, invalid: hex.getAttribute('aria-invalid'), apply: apply.textContent.trim(), applyOff: apply.disabled,
    cancel: win.querySelector('[data-fk="tc-cancel"]').textContent.trim(), themeOpen: Boolean(theme), themeInert: theme ? theme.parentNode.inert : null, explorerInert: document.querySelector('.ex').inert,
  };
});

// Le contraste de chaque texte à l'écran, mesuré sur les couleurs AFFICHÉES : la couleur du texte, posée sur la pile des fonds de ses ancêtres (le canvas fait le mélange, y compris pour les `color-mix`).
const audit = scope => frame.evaluate(selector => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixel = layers => {
    ctx.clearRect(0, 0, 1, 1);
    for (const color of layers) { ctx.fillStyle = '#000'; ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); }
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const failures = [];
  let seen = 0;
  let gradients = 0;
  for (const root of document.querySelectorAll(selector)) {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const own = [...el.childNodes].some(node => node.nodeType === 3 && node.textContent.trim());
      const style = getComputedStyle(el);
      if (!own || style.visibility === 'hidden' || style.display === 'none' || el.closest('[hidden], .sr-only, [aria-hidden="true"]')) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      let layers = [];
      let stops = null; // les arrêts pleins d'un dégradé qui porte le texte (le bouton plein de Pop) : le texte doit se lire sur chacun
      let behind = false;
      for (let node = el; node; node = node.parentElement) {
        const s = getComputedStyle(node);
        const solid = (s.backgroundImage.match(/rgba?\([^)]*\)/g) || []).filter(color => !/rgba\(/.test(color) || /,\s*1\)$/.test(color));
        if (s.backgroundImage !== 'none') { if (solid.length && !stops) stops = solid; else behind = true; }
        layers.unshift(s.backgroundColor);
        if (stops || /^rgb\(/.test(s.backgroundColor)) break; // opaque : plus rien derrière
      }
      if (stops) layers = [layers[0]];
      if (behind) gradients += 1;
      const candidates = stops || [null];
      const style_ = style.color;
      const worst = candidates.map(stop => { const stack = ['#fff', ...(stop ? [stop] : layers)]; return ratio(pixel([...stack, style_]), pixel(stack)); }).reduce((a, b) => Math.min(a, b));
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      const value = worst;
      seen += 1;
      if (value < need) failures.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} « ${el.textContent.trim().slice(0, 24)} » ${value.toFixed(2)}:1`);
    }
  }
  return { seen, gradients, failures };
}, scope);

say('panneau :', await (await frame.frameElement()).boundingBox());
say('apparence posée par Grist :', await frame.evaluate(() => document.documentElement.getAttribute('data-grist-appearance')));

// ---------- 1. le départ ----------
let now = await page_();
check('rien n\'est posé sur la page : l\'aspect d\'origine', now.ambiance === null && now.inline === 0, now);
check('rien n\'est retenu', JSON.stringify(await stored()) === JSON.stringify({ theme: null, couleur: null }), await stored());
const toolbar = await frame.evaluate(() => [...document.querySelectorAll('.ex-title-row > button')].map(node => ({ cls: node.className, text: node.innerText.trim(), label: node.getAttribute('aria-label'), tip: node.title, haspopup: node.getAttribute('aria-haspopup') })));
say('barre d\'outils :', toolbar);
const order = toolbar.map(item => item.cls);
check('le bouton « Thème » est juste après « Langue »', order.indexOf('tb tb-theme') === order.indexOf('tb tb-lang') + 1 && order.indexOf('tb tb-lang') >= 0, order);
check('son nom, son info-bulle, sa fenêtre', toolbar.some(item => item.cls === 'tb tb-theme' && (panelWidth < 520 ? item.text === '' : item.text === words.button) && item.haspopup === 'dialog' && /Grist Factory Suite/.test(item.label) && item.label === item.tip), toolbar);
await shot('1-depart');

// ---------- 2. la fenêtre ----------
await openWindow();
let win = await windowState();
say('la fenêtre :', win);
check('la fenêtre : cinq vignettes, nommées', win.tiles === 5 && JSON.stringify(win.names) === JSON.stringify(words.names), win.names);
check('la charte d\'origine est choisie, dite avec « Ambiance d\'origine »', win.checked === 'defaut' && words.origin.test(win.check), { checked: win.checked, check: win.check });
check('le clavier est dans la fenêtre, sur la vignette choisie', win.inside && win.focus === 'amb:defaut', win.focus);
check('le fond est inerte', win.inertExplorer === true && win.inertFrames === true);
check('la fenêtre tient dans le panneau' + (panelWidth >= 520 ? ', sans défilement du corps' : ' (étroit : le corps défile, titre et pied restent en place)'), win.box.x >= 0 && win.box.y >= 0 && win.box.x + win.box.w <= win.viewport.w && win.box.y + win.box.h <= win.viewport.h && (panelWidth < 520 || !win.scrolls), { box: win.box, viewport: win.viewport, scrolls: win.scrolls });
check('« Revenir à Grist Factory » est grisé quand rien n\'est choisi, la note le dit', await frame.locator('.th-win [data-fk="reset"]').getAttribute('aria-disabled') === 'true' && win.note === words.saved, win.note);
const offered = await frame.evaluate(() => ({ own: document.querySelector('input[name="col"][value="own"]').disabled, pick: document.querySelector('[data-fk="col:pick"]').getAttribute('aria-disabled'), why: [...document.querySelectorAll('.th-adj')].filter(p => !p.hidden).map(p => p.textContent.trim()).filter(Boolean) }));
check('« La mienne » est offerte (le sélecteur de couleur du kit est là), son bouton aussi, aucune raison n\'est dite dans la fenêtre', offered.own === false && offered.pick === 'false' && offered.why.length === 0, offered);
await shot('2-fenetre-origine');

// ---------- 3. un choix à la souris ----------
await tile('pop').click();
await page.waitForTimeout(300);
now = await page_();
win = await windowState();
check('Pop : posée sur la page tout de suite (ambiance, jetons en ligne, forme, couleur)', now.ambiance === 'pop' && now.inline > 20 && now.newRadius !== '7px' && now.titleWeight === '800' && /^#[0-9a-f]{6}$/.test(now.accent), now);
check('Pop : retenue sur le navigateur', JSON.stringify(await stored()) === JSON.stringify({ theme: 'pop', couleur: null }), await stored());
check('Pop : la vignette est cochée, la mesure du contraste est dite (« Couleurs calculées »)', win.checked === 'pop' && words.check.test(win.check) && !/^Ambiance d/.test(win.check), win.check);
check('la fenêtre s\'est repeinte avec l\'ambiance et reste dans le panneau', win.inside && win.box.x + win.box.w <= win.viewport.w && win.box.y + win.box.h <= win.viewport.h, win);
const minis = await frame.evaluate(() => [...document.querySelectorAll('.amb-mini')].map(node => ({ ambiance: node.dataset.ambiance, inline: node.style.length, bg: getComputedStyle(node).backgroundColor, radius: getComputedStyle(node.querySelector('.mn-btn')).borderTopLeftRadius })));
say('vignettes :', minis);
check('chaque vignette porte son ambiance et ses jetons (la charte d\'origine aussi, quelle que soit la page)', minis.map(item => item.ambiance).join() === IDS.join() && minis.every(item => item.inline >= 15) && minis.slice(1).every(item => item.inline > 30), minis.map(item => [item.ambiance, item.inline]));
check('les vignettes sont différentes (fond, forme)', new Set(minis.map(item => `${item.bg}|${item.radius}`)).size >= 4, minis);
await shot('3-pop-fenetre');
await page.keyboard.press('Escape');
await frame.locator('.th-win').waitFor({ state: 'detached' });
check('Échap ferme la fenêtre et rend le clavier au bouton « Thème »', await frame.evaluate(() => document.activeElement && document.activeElement.classList.contains('tb-theme')));
check('l\'explorateur n\'est plus inerte', await frame.evaluate(() => !document.querySelector('.ex').inert));
await shot('4-pop-explorateur');

// ---------- 4. le clavier ----------
await page.keyboard.press('Enter');
await frame.locator('.th-win').waitFor();
win = await windowState();
check('Entrée ouvre la fenêtre, le clavier est sur la vignette choisie', win.inside && win.focus === 'amb:pop', win.focus);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
win = await windowState();
now = await page_();
check('flèche droite : la vignette suivante est choisie et posée', win.checked === 'papier' && now.ambiance === 'papier' && win.focus === 'amb:papier', { checked: win.checked, ambiance: now.ambiance, focus: win.focus });
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
check('puis Brut, Néon', (await windowState()).checked === 'neon' && (await page_()).ambiance === 'neon');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(100);
check('la dernière vignette boucle sur la première (Grist Factory) : la page retrouve l\'aspect d\'origine', (await windowState()).checked === 'defaut' && (await page_()).ambiance === null && (await page_()).inline === 0, await page_());
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(100);
check('flèche gauche : Néon', (await windowState()).checked === 'neon');
const tabs = [];
for (let i = 0; i < 7; i++) { await page.keyboard.press('Tab'); tabs.push((await windowState()).focus); }
say('Tab depuis la vignette choisie :', tabs);
check('Tab traverse la fenêtre sans s\'arrêter sur chaque vignette, et reboucle', tabs.slice(0, 5).join() === ['col:amb', 'col:pick', 'reset', 'close', 'amb:neon'].join() && tabs[5] === 'col:amb', tabs);
await page.keyboard.press('Shift+Tab');
check('Maj+Tab revient en arrière (de « Choisir ma couleur » à la couleur de l\'ambiance)', (await windowState()).focus === 'col:amb', (await windowState()).focus);
await page.keyboard.press('Escape');
await frame.locator('.th-win').waitFor({ state: 'detached' });

// ---------- 5. chaque ambiance est lisible ----------
const failures = [];
const fits = [];
for (const id of IDS) {
  await openWindow();
  await tile(id).click();
  await page.waitForTimeout(250);
  const fit = await windowState();
  fits.push([id, fit.box.h, fit.scrolls]);
  const inWindow = await audit('.th-win');
  await closeWindow();
  const inExplorer = await audit('.ex');
  const total = { seen: inWindow.seen + inExplorer.seen, gradients: inWindow.gradients + inExplorer.gradients, failures: [...inWindow.failures, ...inExplorer.failures] };
  say(`contraste affiché, ${id} :`, { textes: total.seen, surFondDégradé: total.gradients, sous4_5: total.failures });
  failures.push(...total.failures.map(item => `${id} : ${item}`));
  await shot(`5-${id}-explorateur`);
  await openWindow();
  await shot(`5-${id}-fenetre`);
  await closeWindow();
}
check('la fenêtre tient dans 700 × 400 sans défilement du corps, dans chaque ambiance', fits.every(([, , scrolls]) => panelWidth < 520 || !scrolls), fits);
check('chaque texte de l\'explorateur et de la fenêtre garde 4,5:1 au moins, dans les cinq ambiances', failures.length === 0, failures.slice(0, 12));

// ---------- 6. retenu sur le navigateur ----------
await openWindow();
await tile('neon').click();
await closeWindow();
await reload();
now = await page_();
check('GFS rechargé repart dans l\'ambiance choisie (Néon), posée dès le départ', now.ambiance === 'neon' && now.inline > 20 && (await stored()).theme === 'neon', now);
await shot('6-neon-apres-rechargement');

// ---------- 7. les apps suivent ----------
const probe = app => app.evaluate(() => ({ contextes: [], evenements: [], ...JSON.parse((document.body && document.body.dataset.sonde) || '{}') }));
const appLook = app => app.evaluate(() => ({ accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), inline: document.documentElement.style.length }));
const app = await lab.openApp('sonde-m', /m-ambiance\//, frame);
await waitFor('le contexte de la sonde', async () => (await probe(app)).contextes.length >= 1);
let seen = await probe(app);
check('l\'app ouverte après le choix reçoit l\'ambiance dans son contexte (Néon, dix-neuf jetons par mode, la forme), sans événement', seen.contextes[0] && seen.contextes[0].id === 'neon' && seen.contextes[0].clair === 19 && seen.contextes[0].sombre === 19 && seen.contextes[0].forme > 10 && seen.contextes[0].couleur === null && seen.evenements.length === 0, seen);
const neonAccent = seen.contextes[0].accentClair;
check('la sonde a posé les couleurs reçues sur sa page (CSSOM)', (await appLook(app)).inline > 10, await appLook(app));
await frame.locator('#floater-files').click();
await frame.locator('.ex').waitFor({ state: 'visible' });
await openWindow();
await tile('brut').click();
await waitFor('l\'événement ambiance', async () => (await probe(app)).evenements.length === 1);
seen = await probe(app);
say('ce que la sonde a reçu :', seen);
check('le changement arrive à l\'app ouverte par l\'événement `ambiance`, une seule fois (Brut)', seen.evenements.length === 1 && seen.evenements[0].id === 'brut' && seen.evenements[0].accentClair !== neonAccent, seen.evenements);
check('GFS n\'a pas touché au cadre de l\'app : le même cadre, un seul', !app.isDetached() && page.frames().filter(f => /m-ambiance\//.test(f.url())).length === 1);
await tile('brut').click(); // le même choix : rien de nouveau
await page.waitForTimeout(300);
check('choisir ce qui vaut déjà n\'envoie rien', (await probe(app)).evenements.length === 1);
// 8. « Revenir à Grist Factory » : la page et l'app retrouvent l'aspect d'origine.
await frame.locator('.th-win [data-fk="reset"]').click();
await waitFor('l\'événement null', async () => (await probe(app)).evenements.length === 2);
seen = await probe(app);
now = await page_();
check('« Revenir à Grist Factory » : la page n\'a plus rien de posé, les deux clés ont disparu', now.ambiance === null && now.inline === 0 && JSON.stringify(await stored()) === JSON.stringify({ theme: null, couleur: null }), { now, stored: await stored() });
check('l\'app reçoit `null` et retire ses couleurs', seen.evenements.length === 2 && seen.evenements[1] === null && (await appLook(app)).inline === 0, { evenements: seen.evenements, look: await appLook(app) });
await shot('8-retour-origine');
await closeWindow();
await frame.locator('.ex-foot .btn', { hasText: new RegExp(`^${words.close}$`) }).click();
await frame.locator('#floaters').waitFor({ state: 'visible' });

// ---------- 9. la couleur libre : le sélecteur de couleur des documents (celui du kit) ----------
await frame.locator('#floater-files').click();
await frame.locator('.ex').waitFor({ state: 'visible' });
await openWindow();
const OWN = '#7a2fb5';
const accentBefore = (await page_()).accent;
const eventsBefore = (await probe(app)).evenements.length;
const lastEvent = async () => { const list = (await probe(app)).evenements; return list[list.length - 1]; };

// la palette, à la souris
await pickButton().click();
await frame.locator('.menu-panel').waitFor();
let pal = await panelState();
say('la palette :', pal);
const colors = await frame.evaluate(() => [...document.querySelectorAll('.menu-panel .cp-grid .cp-swatch')].map(node => node.dataset.color));
check('« Choisir ma couleur » ouvre la palette des documents sous le bouton : cinquante pastilles, le bouton annonce « ouvert », le clavier est sur la première pastille', pal.swatches === 50 && colors.length === 50 && pal.expanded === 'true' && pal.in && pal.focus === `pastille ${colors[0]}`, { pal, colors: colors.length });
check('elle est dans le panneau, sans défilement, par-dessus la fenêtre, et ne cache pas son bouton ; la fenêtre « Thème » reste ouverte', inside(pal.box, pal.viewport) && !pal.scrolls && pal.onTop && (pal.box.y >= pal.anchor.y + pal.anchor.h - 1 || pal.box.y + pal.box.h <= pal.anchor.y + 1) && pal.winOpen, pal);
check('elle parle la langue de GFS, et « Celle de l\'ambiance » y est marquée (aucune couleur à soi)', pal.words.custom === words.customBtn && pal.words.none === words.none && pal.words.group === words.palette && pal.none && !pal.custom && pal.marked.length === 0, pal);
const paletteAudit = await audit('.menu-panel');
check('les textes de la palette gardent 4,5:1 au moins', paletteAudit.seen >= 2 && paletteAudit.failures.length === 0, paletteAudit);
await shot('9-palette');

// une pastille, à la souris
const picked = colors[17];
await frame.locator('.menu-panel .cp-swatch').nth(17).click();
await page.waitForTimeout(300);
now = await page_();
win = await windowState();
let box = await colorBox();
say('après la pastille :', { picked, now, box });
check('un clic sur une pastille pose la couleur : la palette se ferme, le clavier revient au bouton, « La mienne » est cochée, le bouton montre le code et la couleur', box.own && !box.amb && !box.panel && box.expanded === 'false' && box.focus === 'col:pick' && box.pick === picked.toUpperCase() && box.swatch === rgb(picked), box);
check('elle est posée sur la page tout de suite (les dix-neuf jetons de couleur, aucun de forme) et retenue (`gfs.couleur`) ; l\'ambiance reste celle d\'origine', now.inline === 19 && now.accent !== accentBefore && (await stored()).couleur === picked && (await stored()).theme === null, { now, stored: await stored(), accentBefore });
check('la fenêtre dit la mesure du contraste de ces couleurs-là', words.check.test(win.check), win.check);
let event = await lastEvent();
check('l\'app ouverte reçoit la couleur par l\'événement `ambiance` (`couleur`), une seule fois, dans son cadre d\'avant', (await probe(app)).evenements.length === eventsBefore + 1 && event && event.id === 'defaut' && event.couleur === picked && !app.isDetached(), event);
await shot('9-couleur-choisie');

// se rouvrir, se refermer
await openPalette();
pal = await panelState();
check('rouverte, la couleur choisie est marquée et le clavier est sur elle', pal.marked.join() === picked && pal.focus === `pastille ${picked}` && !pal.none && !pal.custom, pal);
await pickButton().click();
await frame.locator('.menu-panel').waitFor({ state: 'detached' });
box = await colorBox();
check('un second clic sur le bouton referme la palette (la fenêtre reste, la couleur aussi)', box && !box.panel && box.expanded === 'false' && box.pick === picked.toUpperCase(), box);
await pickButton().focus();
await page.keyboard.press('Enter');
await frame.locator('.menu-panel').waitFor();
const at = async () => (await panelState()).focus;
check('Entrée sur le bouton ouvre la palette, le clavier est sur la pastille marquée', (await at()) === `pastille ${picked}`, await at());
await page.keyboard.press('ArrowRight');
const right = await at();
await page.keyboard.press('ArrowDown');
const down = await at();
await page.keyboard.press('Home');
const home = await at();
await page.keyboard.press('End');
const end = await at();
await page.keyboard.press('ArrowRight');
const noWrap = await at();
check('les flèches vont d\'une pastille à l\'autre (droite : la suivante, bas : la ligne d\'après), Début et Fin vont aux bouts, sans bouclage', right === `pastille ${colors[18]}` && down === `pastille ${colors[28]}` && home === `pastille ${colors[0]}` && end === `pastille ${colors[49]}` && noWrap === end, { right, down, home, end, noWrap });
await page.keyboard.press('Tab');
const tab1 = await at();
await page.keyboard.press('Tab');
const tab2 = await at();
await page.keyboard.press('Tab');
await frame.locator('.menu-panel').waitFor({ state: 'detached' });
const tab3 = (await windowState()).focus;
check('Tab passe par « Personnalisé… » puis « Celle de l\'ambiance », puis sort de la palette en la refermant : le clavier va au bouton suivant de la fenêtre', tab1 === 'perso' && tab2 === 'ambiance' && tab3 === 'reset', { tab1, tab2, tab3 });
await openPalette();
await page.keyboard.press('Shift+Tab');
await frame.locator('.menu-panel').waitFor({ state: 'detached' });
const back = (await windowState()).focus;
check('Maj+Tab depuis la première pastille sort aussi de la palette, vers le choix de couleur qui précède le bouton', back === 'col:own', back);
await openPalette();
await page.keyboard.press('Escape');
await frame.locator('.menu-panel').waitFor({ state: 'detached' });
box = await colorBox();
check('Échap ne ferme que la palette : la fenêtre « Thème » reste ouverte, le clavier revient au bouton, la couleur n\'a pas changé', box && box.focus === 'col:pick' && box.pick === picked.toUpperCase() && (await stored()).couleur === picked, box);
await openPalette();
await frame.locator('.th-win .mod-head h2').click();
await frame.locator('.menu-panel').waitFor({ state: 'detached' });
check('un clic ailleurs dans la fenêtre referme la palette seule', Boolean(await windowState()));
win = await windowState();
const frameBox = await (await frame.frameElement()).boundingBox();
const aside = win.box.x >= 4 ? { x: 2, y: Math.round(win.viewport.h / 2) } : (win.box.y >= 4 ? { x: Math.round(win.viewport.w / 2), y: 2 } : null);
if (aside) {
  await openPalette();
  await page.mouse.click(frameBox.x + aside.x, frameBox.y + aside.y);
  await frame.locator('.menu-panel').waitFor({ state: 'detached' });
  check('un clic sur le voile, hors de la fenêtre, referme la palette seule : la fenêtre « Thème » reste ouverte', Boolean(await windowState()));
} else say('(la fenêtre occupe tout le panneau : pas de voile à cliquer)');

// « Personnalisé… » : la fenêtre du carré, de la teinte et du code
await openPalette();
await frame.locator('.menu-panel .cp-custom').click();
await frame.locator('.th-edit').waitFor();
let ed = await editorState();
say('la fenêtre de la couleur :', ed);
check('« Personnalisé… » ouvre « Couleur personnalisée » par-dessus la fenêtre « Thème » (titre et boutons dans la langue) et ferme la palette', ed.title === words.custom && ed.apply === words.apply && ed.cancel === words.cancel && ed.onTop && !(await panelState()), ed);
check('le clavier est dans le champ du code, qui porte la couleur choisie ; la fenêtre « Thème » est inerte derrière', ed.in && ed.onHex && ed.hex.toLowerCase() === picked && ed.themeOpen && ed.themeInert === true && ed.explorerInert === true, ed);
check('elle tient dans le panneau' + (panelWidth >= 520 ? ', sans défilement du corps' : ' (étroit : le corps défile)'), inside(ed.box, ed.viewport) && (panelWidth < 520 || !ed.scrolls), ed);
const editAudit = await audit('.th-edit');
check('ses textes gardent 4,5:1 au moins', editAudit.seen > 6 && editAudit.failures.length === 0, editAudit);
await shot('9-couleur-perso');
const cycle = [];
for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); cycle.push((await editorState()).in); }
for (let i = 0; i < 4; i++) { await page.keyboard.press('Shift+Tab'); cycle.push((await editorState()).in); }
check('Tab et Maj+Tab tournent dans la fenêtre de la couleur, sans jamais en sortir', cycle.every(Boolean), cycle);
await frame.locator('.th-edit .cp-hex').click();
await page.keyboard.press('Control+A');
await page.keyboard.type('#12');
ed = await editorState();
check('un code faux est refusé : le champ est marqué, « Appliquer » est grisé', ed.invalid === 'true' && ed.applyOff, ed);
await page.keyboard.press('Control+A');
await page.keyboard.type(OWN);
ed = await editorState();
check('un code valable dégrise « Appliquer »', ed.invalid === null && !ed.applyOff, ed);
await page.keyboard.press('Escape');
await frame.locator('.th-edit').waitFor({ state: 'detached' });
box = await colorBox();
check('Échap ne ferme que la fenêtre de la couleur et n\'applique rien : la fenêtre « Thème » reste ouverte et libre, la couleur n\'a pas changé, le clavier revient au bouton', box && box.focus === 'col:pick' && box.pick === picked.toUpperCase() && (await stored()).couleur === picked && await frame.evaluate(() => !document.querySelector('.th-win').parentNode.inert), box);
await openPalette();
await frame.locator('.menu-panel .cp-custom').click();
await frame.locator('.th-edit').waitFor();
await frame.locator('.th-edit .cp-hex').click();
await page.keyboard.press('Control+A');
await page.keyboard.type(OWN);
await frame.locator('.th-edit [data-fk="tc-apply"]').click();
await frame.locator('.th-edit').waitFor({ state: 'detached' });
await page.waitForTimeout(300);
box = await colorBox();
now = await page_();
check('« Appliquer » pose la couleur composée à la main : retenue, posée, montrée sur le bouton, le clavier revient au bouton', box.own && box.pick === OWN.toUpperCase() && box.swatch === rgb(OWN) && box.focus === 'col:pick' && (await stored()).couleur === OWN && now.accent !== accentBefore, { box, stored: await stored(), now });
event = await lastEvent();
check('l\'app reçoit cette couleur aussi', event && event.couleur === OWN && (await probe(app)).evenements.length === eventsBefore + 2, event);

// « Celle de l'ambiance » rend la couleur ; « La mienne » la reprend
await openPalette();
pal = await panelState();
check('une couleur composée à la main n\'est dans aucune pastille : « Personnalisé… » est marqué', pal.custom && pal.marked.length === 0 && !pal.none, pal);
await frame.locator('.menu-panel .cp-none').click();
await page.waitForTimeout(300);
box = await colorBox();
now = await page_();
check('« Celle de l\'ambiance » rend la couleur : la palette se ferme, la page n\'a plus rien de posé, la clé a disparu, le bouton redit son nom', box.amb && !box.own && !box.panel && box.pick === words.pick && now.ambiance === null && now.inline === 0 && (await stored()).couleur === null, { box, now, stored: await stored() });
event = await lastEvent();
check('l\'app reçoit `null` (ni ambiance ni couleur)', event === null && (await probe(app)).evenements.length === eventsBefore + 3, event);
await colorLabel(words.own).click();
await page.waitForTimeout(300);
box = await colorBox();
check('« La mienne » reprend la dernière couleur à soi, sans rouvrir la palette', box.own && box.pick === OWN.toUpperCase() && !box.panel && (await stored()).couleur === OWN, { box, stored: await stored() });
event = await lastEvent();
check('l\'app la reçoit de nouveau', event && event.couleur === OWN, event);
await colorLabel(words.none).click();
await page.waitForTimeout(250);
check('« Celle de l\'ambiance », choisie à la souris sur son choix, rend aussi la couleur', (await colorBox()).amb && (await stored()).couleur === null);

// sans couleur gardée, « La mienne » ouvre la palette ; refermée sans rien choisir, la fenêtre redit la vérité
await closeWindow();
await openWindow();
await colorLabel(words.own).click();
await frame.locator('.menu-panel').waitFor();
box = await colorBox();
pal = await panelState();
check('faute de couleur à soi gardée, « La mienne » ouvre la palette (la case est cochée le temps du choix)', box.own && box.panel && pal.in && pal.none, { box, pal });
await page.keyboard.press('Escape');
await frame.locator('.menu-panel').waitFor({ state: 'detached' });
box = await colorBox();
check('refermée sans rien choisir, la fenêtre redit la vérité : « Celle de l\'ambiance » est cochée, rien n\'est retenu', box.amb && !box.own && box.focus === 'col:pick' && (await stored()).couleur === null, { box, stored: await stored() });

// tout au clavier : une pastille, puis une couleur composée, puis « Celle de l'ambiance »
await page.keyboard.press('Enter');
await frame.locator('.menu-panel').waitFor();
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
box = await colorBox();
check('au clavier : Entrée ouvre la palette, une flèche et Entrée posent la pastille voisine ; le clavier revient au bouton', box.own && !box.panel && box.focus === 'col:pick' && (await stored()).couleur === colors[1], { box, stored: await stored() });
await page.keyboard.press('Enter');
await frame.locator('.menu-panel').waitFor();
await page.keyboard.press('Tab');
await page.keyboard.press('Enter');
await frame.locator('.th-edit').waitFor();
await page.keyboard.press('Control+A');
await page.keyboard.type('#0a7d5c');
await page.keyboard.press('Enter');
await frame.locator('.th-edit').waitFor({ state: 'detached' });
await page.waitForTimeout(250);
box = await colorBox();
check('au clavier : « Personnalisé… » puis un code et Entrée posent la couleur composée', box.own && box.pick === '#0A7D5C' && box.focus === 'col:pick' && (await stored()).couleur === '#0a7d5c', { box, stored: await stored() });
await page.keyboard.press('Enter');
await frame.locator('.menu-panel').waitFor();
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
await page.keyboard.press('Enter');
await page.waitForTimeout(250);
box = await colorBox();
check('au clavier : « Celle de l\'ambiance » rend la couleur', box.amb && !box.panel && (await stored()).couleur === null, { box, stored: await stored() });

// retenue sur le navigateur
await openPalette();
await frame.locator('.menu-panel .cp-swatch').nth(40).click();
await page.waitForTimeout(250);
await closeWindow();
await reload();
now = await page_();
check('GFS rechargé repart avec la couleur choisie, posée dès le départ', now.inline === 19 && now.accent !== accentBefore && (await stored()).couleur === colors[40], { now, stored: await stored() });
await openWindow();
box = await colorBox();
check('la fenêtre rouverte montre la couleur retenue', box.own && box.pick === colors[40].toUpperCase() && box.swatch === rgb(colors[40]), box);
await frame.locator('.th-win [data-fk="reset"]').click();
await page.waitForTimeout(300);
now = await page_();
check('« Revenir à Grist Factory » rend aussi la couleur : rien n\'est posé, les deux clés ont disparu', now.ambiance === null && now.inline === 0 && JSON.stringify(await stored()) === JSON.stringify({ theme: null, couleur: null }), { now, stored: await stored() });
await closeWindow();

// ---------- 10. un navigateur qui refuse de retenir ----------
if (!(await frame.locator('.ex').isVisible())) { // GFS rechargé s'ouvre sur l'explorateur
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor({ state: 'visible' });
}
await frame.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
await openWindow();
await tile('papier').click();
await page.waitForTimeout(300);
win = await windowState();
now = await page_();
check('sans stockage : le choix vaut pour la page, la fenêtre le dit', now.ambiance === 'papier' && win.note === words.notKept, { ambiance: now.ambiance, note: win.note });
await openPalette();
await frame.locator('.menu-panel .cp-swatch').nth(5).click();
await page.waitForTimeout(300);
win = await windowState();
now = await page_();
check('sans stockage, la couleur vaut aussi pour la page (rien n\'est retenu), et la fenêtre le dit', (await colorBox()).own && now.ambiance === 'papier' && now.inline > 20 && (await stored()).couleur === null && win.note === words.notKept, { now, stored: await stored(), note: win.note });
await shot('10-sans-stockage');

// ---------- 11. un kit qui ne se charge pas ----------
const expected = warnings.length;
await page.route(/\/prototype\/kit\/js\/color-palette\.js/, route => route.fulfill({ status: 404, body: 'absent' }));
await reload();
if (!(await frame.locator('.ex').isVisible())) {
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor({ state: 'visible' });
}
await openWindow();
await page.waitForTimeout(800);
box = await colorBox();
const off = await frame.evaluate(() => ({ own: document.querySelector('input[name="col"][value="own"]').disabled, pick: document.querySelector('[data-fk="col:pick"]').getAttribute('aria-disabled') }));
check('le kit ne se charge pas : « La mienne » et son bouton sont grisés, la raison est dite dans la fenêtre', off.own === true && off.pick === 'true' && box.why.length === 1 && box.why[0] === words.missing, { off, why: box.why });
await pickButton().click({ force: true }); // grisé n'est pas désactivé : un clic arrive jusqu'à GFS, qui n'ouvre rien
await page.waitForTimeout(300);
check('un clic sur le bouton grisé n\'ouvre rien', !(await colorBox()).panel);
await tile('pop').click();
await page.waitForTimeout(300);
check('le reste marche : les ambiances se choisissent et se posent', (await page_()).ambiance === 'pop' && (await windowState()).checked === 'pop');
await shot('11-kit-absent');
const told = warnings.slice(expected);
check('GFS le dit par un seul avertissement', told.length === 1 && /sélecteur de couleur du kit/.test(told[0]), told);
warnings.length = expected;
await closeWindow();
await openWindow();
await page.waitForTimeout(800);
box = await colorBox();
check('réouverte, la fenêtre le dit encore (le navigateur garde l\'échec jusqu\'au rechargement) et GFS ne le redit pas', box.why.length === 1 && box.why[0] === words.missing && warnings.length === expected, { why: box.why, warnings: warnings.slice(expected) });
await page.unroute(/\/prototype\/kit\/js\/color-palette\.js/);
await reload();
if (!(await frame.locator('.ex').isVisible())) {
  await frame.locator('#floater-files').click();
  await frame.locator('.ex').waitFor({ state: 'visible' });
}
await openWindow();
await pickButton().click();
await frame.locator('.menu-panel').waitFor();
box = await colorBox();
check('après le rechargement, le kit est servi de nouveau : « La mienne » est offerte et la palette s\'ouvre', box.panel && box.why.length === 0, box);
await lab.browser.close();
say('avertissements GFS :', warnings);
check('aucun avertissement ni erreur de GFS', warnings.length === 0, warnings);
