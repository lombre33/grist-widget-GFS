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
//   9. un navigateur qui refuse de retenir : le choix vaut pour la page, la fenêtre le dit.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const panelWidth = Number(process.env.LAB_W || 700);
const run = `theme-${lang}-${scheme}${panelWidth === 700 ? '' : `-${panelWidth}`}`;
const WORDS = {
  fr: { button: 'Thème', title: 'Thème', reset: 'Revenir à Grist Factory', close: 'Fermer', names: ['Grist Factory', 'Pop', 'Papier', 'Brut', 'Néon'], saved: 'S’applique tout de suite, reste sur ce navigateur.',
    notKept: 'Ce choix vaut pour cette page seulement : ton navigateur refuse de le garder.', check: /^Couleurs calculées : contraste de \d,\d:1 au moins/, origin: /^Ambiance d’origine : contraste de \d,\d:1 au moins/ },
  en: { button: 'Theme', title: 'Theme', reset: 'Back to Grist Factory', close: 'Close', names: ['Grist Factory', 'Pop', 'Paper', 'Raw', 'Neon'], saved: 'Applies right away, stays on this browser.',
    notKept: 'This choice only holds for this page: your browser refuses to keep it.', check: /^Computed colors: contrast of at least \d\.\d:1/, origin: /^Original look: contrast of at least \d\.\d:1/ },
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
const later = await frame.evaluate(() => ({ own: document.querySelector('input[value="own"]').disabled, pick: document.querySelector('[data-fk="col:pick"]').getAttribute('aria-disabled'), why: [...document.querySelectorAll('.th-adj')].map(p => p.textContent.trim()).filter(Boolean) }));
check('« La mienne » est grisée, avec sa raison dite dans la fenêtre', later.own === true && later.pick === 'true' && later.why.length === 1, later);
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

// ---------- 9. un navigateur qui refuse de retenir ----------
await frame.locator('#floater-files').click();
await frame.locator('.ex').waitFor({ state: 'visible' });
await frame.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
await openWindow();
await tile('papier').click();
await page.waitForTimeout(300);
win = await windowState();
now = await page_();
check('sans stockage : le choix vaut pour la page, la fenêtre le dit', now.ambiance === 'papier' && win.note === words.notKept, { ambiance: now.ambiance, note: win.note });
await shot('9-sans-stockage');
await lab.browser.close();
say('avertissements GFS :', warnings);
check('aucun avertissement ni erreur de GFS', warnings.length === 0, warnings);
