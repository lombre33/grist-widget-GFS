// L'accessibilité renforcée, second temps (décision du porteur du 04/11, feu vert du 10/11 ; css/acces.css ; contrats 5.2, point 10), dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris et au vrai
// clavier (Playwright). LAB_LANG=fr|en, LAB_SCHEME=light|dark. Ce que la passe mesure, interrupteur de la fenêtre « Thème » allumé à la souris :
//   1. le texte et les cibles : aucun texte de GFS sous 14 px, aucune commande sous 36 × 36 px, dans l'explorateur, le menu « Réglages », la fenêtre « Thème » et la fenêtre « Apps et extensions » (labo/mesures-acces.mjs) ;
//   2. l'anneau de focus, au vrai clavier (Tab, que le Firefox sans écran ne peut pas montrer : pas de focus du système) : 3 px pleins de deux couleurs à 3:1 l'une de l'autre, jamais coupé par la zone qui défile,
//      dans l'explorateur, dans la fenêtre « Thème » et dans la fenêtre « Apps et extensions » ;
//   3. la barre de GFS au-dessus d'une app : 36 px par bouton, et la zone que l'app doit laisser libre (`contexte.barre`) dit exactement la barre mesurée et 4 px autour ;
//   4. la page est sans mouvement ; la ligne choisie a sa barre de 6 px en vraie bordure ; éteint, tout est comme avant (ligne de 28 px, barre d'ombre) ;
//   5. le contraste forcé du système (Chromium : `forcedColors: 'active'`) : la ligne choisie se lit sans couleur ni ombre (une bordure).
// Rien de tout cela n'écrit dans le document (ni table, ni ligne de GFS_Rangement) : seule la clé `gfs.acces` du navigateur.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { BAR_WIDTH, MIN_TARGET, MIN_TEXT, barOf, focusStop, forcedLook, forcedTheme, motionOf, ringFaults, sweep } from './mesures-acces.mjs';
import { openThemeWindow, settingsButton } from './reglages-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `acces-${lang}-${scheme}`;
const GAP = 4;

const lab = await startLab({ lang, colorScheme: scheme, probes: true });
const { page } = lab;
await lab.fitPanel(undefined, 700, 400);
say('semis :', await seedFiles(lab.frame));
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
let frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);

const waitFor = async (label, test, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
const ambiance = () => frame.evaluate(() => document.documentElement.getAttribute('data-ambiance'));
const stored = () => frame.evaluate(() => { try { return localStorage.getItem('gfs.acces'); } catch (error) { return 'REFUSÉ'; } });
const closeAll = async () => { await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(150); };

// ---------- l'interrupteur, à la souris ----------
check('au départ, rien n\'est posé sur la page (aspect d\'origine) et la ligne de la liste mesure 28 px', await ambiance() === null && await frame.evaluate(() => document.querySelector('.ls-row').getBoundingClientRect().height) === 28, await ambiance());
const rowsBefore = await frame.evaluate(barOf);
check('sans l\'interrupteur, la ligne choisie garde sa barre d\'ombre de 3 px (aucune bordure)', await (async () => { await frame.locator('.ls-row .nm').nth(3).click(); const bar = await frame.evaluate(barOf); return bar.chosen && bar.chosen.width === 0 && /3px/.test(bar.chosen.shadow); })(), rowsBefore);
await openThemeWindow(frame);
await frame.locator('.th-acc').click();
await waitFor('l\'accessibilité renforcée', async () => (await ambiance()) === 'renforcee');
check('un clic sur l\'interrupteur allume l\'accessibilité renforcée : la page porte `renforcee`, la clé `gfs.acces` est écrite', await ambiance() === 'renforcee' && await stored() === 'renforcee', { ambiance: await ambiance(), stored: await stored() });

// ---------- 1. le texte et les cibles, dans la fenêtre « Thème » (ouverte), puis ailleurs ----------
const sizes = async (label, expectOpen) => {
  const seen = await frame.evaluate(`(${sweep})(${MIN_TEXT}, ${MIN_TARGET})`);
  check(`${label} : aucun texte sous ${MIN_TEXT} px, aucune commande sous ${MIN_TARGET} × ${MIN_TARGET} px`, seen.texts.length === 0 && seen.targets.length === 0, { texts: seen.texts.slice(0, 6), targets: seen.targets.slice(0, 6) });
  if (expectOpen) check(`${label} : la fenêtre est bien ouverte`, await frame.locator(expectOpen).count() > 0, expectOpen);
};
await sizes('la fenêtre « Thème »', '.th-win');
const themeBox = await frame.evaluate(() => { const win = document.querySelector('.th-win'); const body = win.querySelector('.th-body'); const box = win.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, h: Math.round(box.height), scrolls: body.scrollHeight > body.clientHeight + 1, viewport: innerHeight }; });
check('la fenêtre « Thème » tient dans 700 × 400 sans défilement du corps, avec des lignes de 36 px et du texte de 14 px', themeBox.top >= 0 && themeBox.bottom <= themeBox.viewport && !themeBox.scrolls, themeBox);

// ---------- 2. l'anneau de focus, dans la fenêtre « Thème » : Tab, de commande en commande ----------
const ring = async (label, selector) => {
  await frame.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
  await frame.evaluate(selector => { const first = document.querySelector(selector); if (first) first.setAttribute('tabindex', '-1'); if (first) first.focus(); if (first) first.removeAttribute('tabindex'); }, selector);
  const keys = new Set();
  const faults = [];
  for (let step = 0; step < 60; step += 1) {
    await page.keyboard.press('Tab');
    const stop = await frame.evaluate(focusStop);
    if (!stop || keys.has(stop.key)) break;
    keys.add(stop.key);
    faults.push(...ringFaults(stop).map(fault => `${fault.kind} : ${fault.text}`));
  }
  check(`${label} : l'anneau de focus (3 px, deux couleurs, jamais coupé) à chacune des ${keys.size} commandes que le clavier visite`, keys.size >= 4 && faults.length === 0, { stops: keys.size, faults: faults.slice(0, 4) });
};
await ring('la fenêtre « Thème »', '.th-win .mod-head');
await frame.locator('.th-win .btn.primary').click();
await page.waitForTimeout(200);

// ---------- 1 et 2, suite : l'explorateur, le menu « Réglages », la fenêtre « Apps et extensions » ----------
await sizes('l\'explorateur', null);
check('chaque ligne de la liste mesure 37 px (un bouton de 36 px et le filet de 1 px du bas), sans que le filet passe dans le texte', await frame.evaluate(() => [...document.querySelectorAll('.ls-row')].every(row => Math.abs(row.getBoundingClientRect().height - 37) < 0.5)), null);
await ring('l\'explorateur', '.ex-head');
await frame.locator('.ls-row .nm').nth(3).click();
const bar = await frame.evaluate(barOf);
check(`la ligne choisie a une bordure de ${BAR_WIDTH} px (un vrai trait, sans ombre), l'en-tête et les autres lignes la même, de la couleur du fond`, bar.chosen.width === BAR_WIDTH && bar.chosen.shadow === 'none' && bar.plain.width === BAR_WIDTH && bar.head.width === BAR_WIDTH && bar.chosen.color !== bar.plain.color, bar);
await settingsButton(frame).click();
await frame.locator('.menu:not(.menu-sub)').waitFor();
await sizes('le menu « Réglages »', '.menu');
await closeAll();
await lab.openModules(frame);
await page.waitForTimeout(300);
await sizes('la fenêtre « Apps et extensions »', '.mod');
await ring('la fenêtre « Apps et extensions »', '.mod .mod-head');
await closeAll();

// ---------- 4. aucun mouvement ----------
const motion = await frame.evaluate(motionOf);
check('la page est sans mouvement : aucune transition ni animation qui dure, défilement « auto »', motion.moving === 0 && motion.smooth === 'auto', motion);

// ---------- 3. la barre de GFS au-dessus d'une app, et la zone que l'app doit laisser libre ----------
await lab.openApp('sonde-r', /r-barre\//, frame);
let app = null;
for (let i = 0; i < 60 && !app; i++) {
  const found = page.frames().filter(f => /r-barre\//.test(f.url()) && !f.isDetached());
  app = found.length ? found.at(-1) : null;
  if (!app) await page.waitForTimeout(250);
}
await frame.waitForFunction(() => { const el = document.querySelector('.app-frame'); return Boolean(el) && !el.classList.contains('app-frame--hidden'); }, null, { timeout: 15000 });
const probe = () => app.evaluate(() => ({ contextes: [], ...JSON.parse((document.body && document.body.dataset.sonde) || '{}') }));
await waitFor('le contexte', async () => (await probe()).contextes.length >= 1);
await app.evaluate(() => window.sondeR.contexte());
await waitFor('le contexte demandé', async () => (await probe()).contextes.length >= 2);
const context = (await probe()).contextes.at(-1);
const geometry = await frame.evaluate(() => {
  const dock = document.getElementById('floaters').getBoundingClientRect();
  const stage = document.getElementById('stage').getBoundingClientRect();
  return { rect: { x: dock.left - stage.left, y: dock.top - stage.top, largeur: dock.width, hauteur: dock.height }, stage: { largeur: stage.width, hauteur: stage.height },
    buttons: [...document.querySelectorAll('#floaters .floater')].map(button => { const box = button.getBoundingClientRect(); return [Math.round(box.width * 10) / 10, Math.round(box.height * 10) / 10]; }) };
});
const expectedZone = (rect, stage) => {
  const x0 = Math.max(0, Math.round(rect.x) - GAP), y0 = Math.max(0, Math.round(rect.y) - GAP);
  const x1 = Math.min(stage.largeur, Math.round(rect.x + rect.largeur) + GAP), y1 = Math.min(stage.hauteur, Math.round(rect.y + rect.hauteur) + GAP);
  return { x: x0, y: y0, largeur: x1 - x0, hauteur: y1 - y0 };
};
say('la barre renforcée :', { geometry, barre: context.barre });
check('les quatre boutons de la barre de GFS mesurent 36 × 36 px au moins', geometry.buttons.length === 4 && geometry.buttons.every(([width, height]) => width >= MIN_TARGET - 0.05 && height >= MIN_TARGET - 0.05), geometry.buttons);
check('l\'app reçoit la zone qu\'elle doit laisser libre : la barre agrandie, mesurée, et 4 px autour', JSON.stringify(context.barre && context.barre.zone) === JSON.stringify(expectedZone(geometry.rect, geometry.stage)), { zone: context.barre && context.barre.zone, attendue: expectedZone(geometry.rect, geometry.stage) });
await frame.locator('#floater-place').focus();
await page.keyboard.press('Tab');
await page.keyboard.press('Shift+Tab');
const barRing = await frame.evaluate(focusStop);
check('l\'anneau de focus de la barre de GFS : 3 px, deux couleurs, jamais coupé', barRing && ringFaults(barRing).length === 0, barRing && ringFaults(barRing));

// ---------- 5. le contraste forcé du système, accessibilité renforcée allumée ----------
// Les règles de l'accessibilité renforcée (`:root[data-ambiance="renforcee"] …`) pèsent plus que celles du contraste forcé si celles-ci ne le rattrapent pas : la barre de la ligne choisie, la bordure de la vignette et
// le bouton enfoncé doivent encore se lire. (Mesuré une première fois le 10/11 : la barre restait de la couleur de ses voisines.)
await page.emulateMedia({ forcedColors: 'active' });
await page.waitForTimeout(300);
await frame.locator('#floater-files').click();
await frame.locator('.ex').waitFor();
await frame.locator('.ls-row .nm').nth(3).click();
const forced = await frame.evaluate(forcedLook);
check('contraste forcé : la ligne choisie a sa barre de 6 px, d\'une autre couleur du système que celle des autres lignes, et rien ne bouge au choix', forced.forced && forced.row.width === BAR_WIDTH && forced.row.plainWidth === BAR_WIDTH && forced.row.color !== forced.row.plainColor && forced.row.shadow === 'none', forced.row);
check('contraste forcé : le bouton « Liste » enfoncé a un contour de 2 px au moins, l\'autre n\'en a pas', forced.bar && forced.bar.on >= 2 && forced.bar.off === 0, forced.bar);
await frame.locator('.tb-group .tb').nth(1).click();
await frame.locator('.th-grid').waitFor();
await frame.locator('.th').nth(1).click();
const tile = (await frame.evaluate(forcedLook)).tile;
check('contraste forcé : la vignette choisie a une bordure plus épaisse que les autres', tile && tile.width > tile.plainWidth, tile);
await openThemeWindow(frame);
const amb = await frame.evaluate(forcedTheme);
check('contraste forcé : la vignette d\'ambiance cochée a une bordure plus épaisse que les autres', amb.checked > amb.other, amb);
await frame.locator('.th-acc').click();
await waitFor('l\'accessibilité éteinte', async () => (await ambiance()) === null);
const ambOff = await frame.evaluate(forcedTheme);
check('contraste forcé : l\'interrupteur dessine son état (la poignée change de côté et de couleur)', amb.handle.left !== ambOff.handle.left && amb.handle.background !== ambOff.handle.background, { allume: amb.handle, eteint: ambOff.handle });
await frame.locator('.th-win .btn.primary').click();
await page.emulateMedia({ forcedColors: 'none' });

// ---------- éteint : tout comme avant (l'interrupteur vient d'être éteint, à la souris) ----------
await frame.locator('.tb-group .tb').nth(0).click();
await frame.locator('.ls-row').first().waitFor();
await page.waitForTimeout(300);
const off = await frame.evaluate(() => ({ row: document.querySelector('.ls-row').getBoundingClientRect().height, size: parseFloat(getComputedStyle(document.querySelector('.ls-row')).fontSize) }));
check('éteint, la page est celle d\'avant : ligne de 28 px, texte de 12,5 px, plus de `gfs.acces`', await ambiance() === null && off.row === 28 && off.size === 12.5 && await stored() === null, { ...off, stored: await stored() });
await lab.browser.close();
