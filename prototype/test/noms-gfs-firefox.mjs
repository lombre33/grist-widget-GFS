// La fenêtre de mise à jour des noms de GFS (js/ui/names-window.js, retour n° 1 du porteur du 25/11 : tout en anglais) sous Firefox, le navigateur du porteur (règle du 03/11 : toute interface ajoute ses
// mesures à test/interfaces-firefox.test.mjs). La vraie fenêtre, sur la base commune des fenêtres du widget, jouée dans la page de l'explorateur (`window.__namesWindow`, test/pages/explorateur.js) à 700 × 400, à la
// vraie souris et au vrai clavier : elle tient dans la page avec son seul bouton « Mettre à jour » (le clavier dessus), Échap ne la ferme pas, un clic sur le voile non plus, le bloc des noms est dans le tour de Tab et
// s'ouvre à la souris (cinq paires et « … et 4 autres ») et la fenêtre tient toujours, le clic lance la mise à jour, le résultat se dit en vert lisible et « Continuer » la ferme avec l'état `done` ; après un refus de Grist, le texte
// en rouge lisible, « Réessayer » et « Continuer sans mettre à jour », et Échap vaut ce dernier (état `skipped`).
import { createI18n } from '../kit/js/i18n.js';
import { NAMES_STRINGS } from '../kit/js/names-update/strings.js';
import { Run } from './corbeille-firefox.mjs';

const MIN_CONTRAST = 4.5;

// ---------- ce qui s'exécute dans la page ----------
function snapshot() {
  const modal = document.querySelector('.mod.names');
  if (!modal) return null;
  const box = modal.getBoundingClientRect();
  // Le contenu d'un `<details>` fermé n'est pas à l'écran (Firefox lui rend pourtant une boîte) : on ne le compte pas.
  // Ce que le corps de la fenêtre fait défiler (`overflow-y: auto`) n'est pas « dehors » vers le bas ni vers le haut : la personne l'atteint en défilant ; seul le côté compte alors.
  const scrolling = getComputedStyle(modal.querySelector('.names-body')).overflowY === 'auto';
  const outside = [...modal.querySelectorAll('*')].filter(node => !node.closest('details:not([open]) > :not(summary)')).filter(node => {
    const at = node.getBoundingClientRect();
    const scrolled = scrolling && node.closest('.names-body');
    const beyond = at.bottom > box.bottom + 1 || at.top < box.top - 1;
    return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1 || (beyond && !scrolled));
  }).map(node => node.className || node.tagName).slice(0, 5);
  const inPage = box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight;
  const body = modal.querySelector('.names-body');
  const buttons = [...modal.querySelectorAll('.mod-foot button:not([hidden])')].map(button => {
    const at = button.getBoundingClientRect();
    const foot = modal.querySelector('.mod-foot').getBoundingClientRect();
    return { fk: button.dataset.fk, text: button.textContent.trim(), disabled: button.disabled, visible: at.width > 0 && at.top >= foot.top - 1 && at.bottom <= foot.bottom + 1 && at.bottom <= window.innerHeight };
  });
  const details = modal.querySelector('details');
  const active = document.activeElement;
  return {
    title: modal.querySelector('.mod-head h2').textContent.trim(),
    text: body.textContent.replace(/\s+/g, ' ').trim(),
    fits: inPage && outside.length === 0 ? [] : [inPage ? 'dans la page' : 'hors de la page', ...outside],
    scrolls: body.scrollHeight > body.clientHeight + 1,
    buttons,
    focus: active && active.dataset && active.dataset.fk ? active.dataset.fk : (active ? `${active.tagName}${active.tagName === 'SUMMARY' ? ':summary' : ''}` : null),
    detailsOpen: details ? details.open : null,
    pairs: [...modal.querySelectorAll('.names-pairs li')].map(item => item.textContent.replace(/\s+/g, ' ').trim()),
    scrims: document.querySelectorAll('.mod-scrim').length,
  };
}

// Le point du voile à côté de la fenêtre (le premier des quatre côtés qui laisse 8 px au moins), s'il y en a un.
function veilSpot() {
  const scrim = document.querySelector('.mod-scrim');
  if (!scrim) return null;
  const box = scrim.firstElementChild.getBoundingClientRect();
  const [width, height] = [document.documentElement.clientWidth, document.documentElement.clientHeight];
  const gaps = [box.left, width - box.right, box.top, height - box.bottom];
  const spots = [[box.left / 2, height / 2], [(box.right + width) / 2, height / 2], [width / 2, box.top / 2], [width / 2, (box.bottom + height) / 2]];
  const at = gaps.findIndex(gap => gap >= 8);
  const spot = at < 0 ? null : spots[at].map(Math.round);
  const hit = spot ? document.elementFromPoint(spot[0], spot[1]) : null;
  return spot && hit && hit.classList.contains('mod-scrim') ? spot : null;
}

// Le contraste (WCAG 2) d'un texte de la fenêtre sur son fond, tel que Firefox le rend.
function contrastOf(selector) {
  const parse = text => (text.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const channel = value => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const luminance = rgb => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  const element = document.querySelector(selector);
  if (!element) return null;
  let background = null;
  for (let node = element; node && !background; node = node.parentElement) {
    const own = getComputedStyle(node).backgroundColor;
    if (own && own !== 'transparent' && !/rgba\(.*, 0\)$/.test(own)) background = own;
  }
  const [hi, lo] = [luminance(parse(getComputedStyle(element).color)), luminance(parse(background || 'rgb(255, 255, 255)'))].sort((a, b) => b - a);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

// ---------- la conduite ----------
const open = (run, kind) => run.page.run(kind => window.__namesWindow(kind), kind);
const stateOf = run => run.page.run(snapshot);
async function waitFor(run, check, ms = 4000) {
  const started = Date.now();
  let state = await stateOf(run);
  while (!check(state) && Date.now() - started < ms) { await new Promise(resolve => setTimeout(resolve, 60)); state = await stateOf(run); }
  return { state, ok: check(state) };
}

async function done(run, t) {
  await run.reset();
  await open(run, 'fait');
  const first = await waitFor(run, state => state && state.buttons.length > 0);
  const shown = first.state;
  if (!shown) { run.note('fenêtre absente', 'la fenêtre ne s\'ouvre pas'); return; }
  if (shown.title !== t('kit.names.title')) run.note('titre', `le titre devait être « ${t('kit.names.title')} » (il est « ${shown.title} »)`);
  if (shown.fits.length) run.note('mise en page', `la fenêtre devait tenir dans la page à 700 × 400 sans rien qui dépasse (${shown.fits.join(', ')})`);
  if (shown.buttons.length !== 1 || shown.buttons[0].fk !== 'names-ok' || shown.buttons[0].text !== t('kit.names.start')) {
    run.note('boutons', `un seul bouton « ${t('kit.names.start')} » devait s'offrir, ni Annuler ni Fermer (${JSON.stringify(shown.buttons)})`);
  }
  if (!shown.buttons.every(button => button.visible)) run.note('boutons', `le bouton devait se voir sans défiler (${JSON.stringify(shown.buttons)})`);
  if (shown.focus !== 'names-ok') run.note('clavier', `le clavier devait être sur « ${t('kit.names.start')} » (il est sur « ${shown.focus} »)`);
  for (const key of ['kit.names.quick']) if (!shown.text.includes(t(key).slice(0, 40))) run.note('texte', `la fenêtre devait dire « ${t(key).slice(0, 40)}… »`);
  // Échap ne ferme rien avant la mise à jour, un clic sur le voile non plus (charte, 09/11).
  await run.page.press('Escape');
  if (!(await stateOf(run))) run.note('Échap', 'Échap ne devait pas fermer la fenêtre avant la mise à jour');
  const spot = await run.page.run(veilSpot);
  if (spot) await run.page.click(...spot);
  if (!(await stateOf(run))) run.note('voile', 'un clic sur le voile ne devait pas fermer la fenêtre');
  // Le titre du bloc des noms est dans le tour de Tab et s'ouvre à la vraie souris (dans ce Firefox sans écran, Entrée n'a aucune action par défaut sur un
  // `<summary>`, mesuré le 25/11 : l'activation au clavier se mesure sous Chromium, labo/run-noms-gfs.mjs) ; la fenêtre tient toujours, ses boutons à leur place.
  let focus = (await stateOf(run)).focus;
  for (let step = 0; step < 4 && focus !== 'SUMMARY:summary'; step += 1) { await run.page.press('Tab'); focus = (await stateOf(run)).focus; }
  if (focus !== 'SUMMARY:summary') run.note('clavier', `Tab devait atteindre le titre du bloc des noms (il est sur « ${focus} »)`);
  else {
    await run.clickSelector('.mod.names summary');
    const listed = (await waitFor(run, state => state && state.detailsOpen === true)).state;
    if (!listed || listed.detailsOpen !== true) run.note('liste', 'un clic sur le titre devait ouvrir le bloc des noms');
    else {
      if (listed.pairs.length !== 6 || !/GFS_Rangement.*GFS_Filing/.test(listed.pairs[0]) || !/4/.test(listed.pairs[5])) run.note('liste', `cinq paires puis « … et 4 autres » devaient se lire (${JSON.stringify(listed.pairs)})`);
      if (listed.fits.length) run.note('liste ouverte', `la fenêtre devait tenir dans la page, liste ouverte (${listed.fits.join(', ')})`);
      if (!listed.buttons.every(button => button.visible)) run.note('liste ouverte', `le bouton devait rester visible, liste ouverte (${JSON.stringify(listed.buttons)})`);
    }
  }
  // Le clic (à la vraie souris) lance la mise à jour ; le résultat se dit, lisible ; « Continuer » ferme avec l'état `done`.
  if (!(await run.clickSelector('[data-fk="names-ok"]'))) return;
  const result = await waitFor(run, state => state && state.buttons.some(button => button.text === t('kit.names.continue')));
  if (!result.ok) { run.note('résultat', `« ${t('kit.names.continue')} » devait s'offrir après la mise à jour (${result.state ? JSON.stringify(result.state.buttons) : 'fenêtre fermée'})`); return; }
  if (!/9/.test(result.state.text) || !result.state.text.includes(t('kit.names.doneNoCount', { tables: 9 }).slice(0, 25))) run.note('résultat', `le résultat devait dire les neuf tables (« ${result.state.text.slice(0, 120)} »)`);
  const ratio = await run.page.run(contrastOf, '.names-ok');
  if (ratio !== null && ratio < MIN_CONTRAST) run.note('contraste', `le résultat devait avoir un contraste de ${MIN_CONTRAST}:1 au moins (il est de ${ratio}:1)`);
  await run.clickSelector('[data-fk="names-ok"]');
  const closed = await waitFor(run, state => state === null);
  if (!closed.ok) run.note('fin', '« Continuer » devait fermer la fenêtre');
  const answer = await run.page.until(() => window.__names, [], 2000).catch(() => null);
  if (answer !== 'done') run.note('fin', `GFS devait recevoir l'état « done » (il reçoit « ${answer} »)`);
}

async function refused(run, t) {
  await run.reset();
  await open(run, 'refus');
  await waitFor(run, state => state && state.buttons.length > 0);
  if (!(await run.clickSelector('[data-fk="names-ok"]'))) return;
  const result = await waitFor(run, state => state && state.buttons.length === 2);
  if (!result.ok) { run.note('refus', `« ${t('kit.names.retry')} » et « ${t('kit.names.skip')} » devaient s'offrir (${result.state ? JSON.stringify(result.state.buttons) : 'fenêtre fermée'})`); return; }
  const texts = result.state.buttons.map(button => button.text);
  if (!texts.includes(t('kit.names.retry')) || !texts.includes(t('kit.names.skip'))) run.note('refus', `les boutons devaient être « ${t('kit.names.skip')} » et « ${t('kit.names.retry')} » (${texts.join(' | ')})`);
  if (result.state.fits.length) run.note('refus', `la fenêtre devait tenir dans la page (${result.state.fits.join(', ')})`);
  if (!result.state.buttons.every(button => button.visible)) run.note('refus', `les deux boutons devaient se voir (${JSON.stringify(result.state.buttons)})`);
  const ratio = await run.page.run(contrastOf, '.names-alert');
  if (ratio !== null && ratio < MIN_CONTRAST) run.note('contraste', `le refus devait avoir un contraste de ${MIN_CONTRAST}:1 au moins (il est de ${ratio}:1)`);
  await run.page.press('Escape');
  const closed = await waitFor(run, state => state === null);
  if (!closed.ok) run.note('refus', 'Échap devait valoir « Continuer sans mettre à jour » après un refus');
  const answer = await run.page.until(() => window.__names, [], 2000).catch(() => null);
  if (answer !== 'skipped') run.note('refus', `GFS devait recevoir l'état « skipped » (il reçoit « ${answer} »)`);
}

// Les mesures de la fenêtre de mise à jour des noms, dans la langue de la page (`language`) ; rend les écarts { kind, text }.
export async function nomsGfsProblems(page, language, tag) {
  const found = [];
  const t = createI18n({ strings: NAMES_STRINGS, language }).t;
  const run = new Run(page, tag, found, 'mise à jour des noms de GFS');
  for (const step of [done, refused]) {
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
