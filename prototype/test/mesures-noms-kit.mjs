// La fenêtre de mise à jour des noms du kit (kit 0.29, js/names-update/) sous Firefox, le navigateur du porteur : les mesures que `interfaces-firefox.test.mjs` joue dans un vrai Firefox sans écran
// (test/firefox.mjs), à 700 × 400, à la vraie souris et au vrai clavier (`input.performActions` : jamais `dispatchEvent`). La page est celle que le kit garde pour ses propres essais
// (kit/navigateur/noms.html : un faux document qui se comporte comme le vrai Grist, la vraie fenêtre, sous la politique d'une app hébergée). Ce que mesure surtout cette passe, qui est déjà jouée
// sous Chromium (kit/navigateur/scenarios-noms.mjs) : le `<details>` qui s'ouvre au clavier (Entrée sur son titre, que la base des fenêtres met dans le tour de Tab), la mise en page du cadre
// et le contraste tels que Firefox les rend. Les cas : un propriétaire (le cas normal), une table que Sync+ utilise, un refus de Grist.
export const NAMES_PAGE = '/kit/navigateur/noms.html';

const WORDS = {
  fr: { start: 'Mettre à jour', next: 'Continuer', skip: 'Continuer sans mettre à jour', retry: 'Réessayer', list: 'Voir les noms qui changent', done: /^Terminé : 7 tables mises à jour, 56 lignes vérifiées/, refused: /Rien n’a changé/, held: 'Une table garde son ancien nom' },
  en: { start: 'Update', next: 'Continue', skip: 'Continue without updating', retry: 'Try again', list: 'See the names that change', done: /^Done: 7 tables updated, 56 rows checked/, refused: /Nothing changed/, held: 'One table keeps its old name' },
};

// ---------- ce qui s'exécute dans la page ----------
const rectOf = selector => {
  const element = document.querySelector(selector);
  if (!element) return null;
  const box = element.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom, cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
};
const buttonsOf = () => [...document.querySelectorAll('#nu-modal .pp-modal-actions button:not([hidden])')].map(button => button.textContent);
const isOpen = () => { const modal = document.querySelector('#nu-modal'); return Boolean(modal) && getComputedStyle(modal).display !== 'none'; };
const focusText = () => { const active = document.activeElement; return active ? active.textContent.trim() : null; };
const bodyText = () => document.querySelector('#nu-modal .nu-body').textContent;
const detailsOpen = () => document.querySelector('.nu-details').open;
// Le contraste (WCAG 2) d'un texte sur son fond, tel que Firefox le rend : le fond est celui du cadre, ou celui du bouton pour le bouton.
const contrastOf = selector => {
  const parse = text => (text.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const channel = value => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const luminance = rgb => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  const element = document.querySelector(selector);
  if (!element) return null;
  const own = getComputedStyle(element).backgroundColor;
  const background = parse(/rgba\(.*, 0\)$/.test(own) || own === 'transparent' ? getComputedStyle(document.querySelector('#nu-modal .pp-modal-box')).backgroundColor : own);
  const [hi, lo] = [luminance(parse(getComputedStyle(element).color)), luminance(background)].sort((a, b) => b - a);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};

// ---------- ce que l'essai fait de la page ----------
const inPanel = (box, gap = 12) => box && box.x >= gap - 0.5 && box.y >= gap - 0.5 && box.right <= 700 - gap + 0.5 && box.bottom <= 400 - gap + 0.5;

async function openCase(page, site, language, mode, name) {
  await page.view({ width: 700, height: 400, scale: 1, mode });
  await page.goto(`${site.url}${NAMES_PAGE}?case=${name}`);
  await page.run(language => { try { localStorage.setItem('kit_lang', language); } catch (error) { /* le stockage peut être refusé : la langue du navigateur vaut */ } }, language);
  await page.goto(`${site.url}${NAMES_PAGE}?case=${name}`);
  await page.until(isOpen, [], 8000).catch(() => null);
}
async function clickButton(page, text) {
  const index = (await page.run(buttonsOf)).indexOf(text);
  if (index < 0) return false;
  const box = await page.run(index => { const button = [...document.querySelectorAll('#nu-modal .pp-modal-actions button:not([hidden])')][index].getBoundingClientRect(); return { x: button.x + button.width / 2, y: button.y + button.height / 2 }; }, index);
  await page.click(box.x, box.y);
  return true;
}

// Le cas normal : ce que la fenêtre dit et où elle tient, le clavier, le bloc qu'on ouvre, le clic, le résultat.
async function normalCase(page, site, language, mode, tag, words, found) {
  const note = (kind, text) => found.push({ kind: `fenêtre de mise à jour des noms : ${kind}`, text: `${tag} : ${text}` });
  await openCase(page, site, language, mode, 'ready');
  if (!(await page.run(isOpen))) { note('fenêtre absente', 'la fenêtre ne s\'ouvre pas pour un propriétaire'); return; }
  const box = await page.run(rectOf, '#nu-modal .pp-modal-box');
  const actions = await page.run(rectOf, '#nu-modal .pp-modal-actions');
  if (!inPanel(box) || actions.bottom > 388.5) note('hors du panneau', `le cadre (${Math.round(box.x)}, ${Math.round(box.y)}, ${Math.round(box.right)}, ${Math.round(box.bottom)}) sort des 700 × 400 avec 12 px de marge, ou le bouton est coupé`);
  for (const [what, selector] of [['la phrase « quelques secondes »', '.nu-strong'], ['le titre de la liste des noms', '.nu-details summary']]) {
    const part = await page.run(rectOf, selector);
    if (!part || part.bottom > actions.y) note('sous le pli', `${what} est sous le bouton : il faut défiler pour la lire`);
  }
  const buttons = await page.run(buttonsOf);
  if (buttons.join() !== words.start) note('boutons', `les boutons sont « ${buttons.join(' / ')} » au lieu de « ${words.start} » seul (fenêtre bloquante)`);
  if ((await page.run(focusText)) !== words.start) note('focus', `le focus n'est pas sur « ${words.start} »`);
  if (await page.run(detailsOpen)) note('liste ouverte', 'la liste des noms est ouverte avant tout geste');
  await page.press('Tab');
  if (!String(await page.run(focusText)).startsWith(words.list)) note('Tab', `Tab depuis le bouton ne va pas au titre de la liste (« ${await page.run(focusText)} »)`);
  // Le titre de la liste s'ouvre à la vraie souris : dans ce Firefox sans écran, Entrée n'a AUCUNE action par défaut (mesuré le 25/11 sur une page nue : ni sur un bouton ni sur un `<summary>`, les
  // trois événements de touche arrivent mais pas le clic), donc l'activation au clavier du titre est mesurée sous Chromium (kit/navigateur/scenarios-noms.mjs) ; ici, qu'il est dans le tour de Tab (ci-dessus).
  const summary = await page.run(rectOf, '.nu-details summary');
  await page.click(summary.cx, summary.cy);
  if (!(await page.run(detailsOpen))) note('clic', 'un clic sur le titre n\'ouvre pas la liste');
  else if ((await page.run(() => document.querySelectorAll('.nu-pairs li').length)) !== 6) note('liste', 'la liste ouverte ne montre pas cinq paires et « … autres »');
  const listBox = await page.run(rectOf, '.nu-pairs');
  const scrolls = await page.run(() => document.querySelector('#nu-modal .pp-modal-body').scrollHeight > document.querySelector('#nu-modal .pp-modal-body').clientHeight);
  if (listBox && listBox.bottom > actions.y + 0.5 && !scrolls) note('liste', 'la liste ouverte passe sous le bouton sans que le contenu défile');
  const afterOpen = await page.run(rectOf, '#nu-modal .pp-modal-box');
  if (!inPanel(afterOpen)) note('hors du panneau', 'la fenêtre sort du panneau quand la liste est ouverte');
  const summaryAgain = await page.run(rectOf, '.nu-details summary');
  await page.click(summaryAgain.cx, summaryAgain.cy);
  if (await page.run(detailsOpen)) note('clic', 'un second clic ne referme pas la liste');
  await page.press('Tab');
  if ((await page.run(focusText)) !== words.start) note('Tab', `le tour de Tab ne revient pas à « ${words.start} »`);
  await page.press('Escape');
  await page.click(5, 5);
  if (!(await page.run(isOpen))) note('bloquante', 'Échap ou un clic sur le voile a fermé la fenêtre avant la mise à jour');
  for (const [what, selector] of [['le titre', '.nu-box h3'], ['le texte', '.nu-text'], ['le titre de la liste', '.nu-details summary'], ['le bouton principal', '.pp-modal-primary']]) {
    const ratio = await page.run(contrastOf, selector);
    if (ratio === null || ratio < 4.5) note('contraste', `${what} : ${ratio}:1 (4,5:1 au moins)`);
  }
  await clickButton(page, words.start);
  await page.until(() => /^(Terminé|Done)/.test(document.querySelector('#nu-modal .nu-body').textContent), [], 8000).catch(() => null);
  const text = await page.run(bodyText);
  if (!words.done.test(text)) note('résultat', `le texte final est « ${text.slice(0, 120)} »`);
  const ratio = await page.run(contrastOf, '.nu-ok');
  if (ratio === null || ratio < 4.5) note('contraste', `le résultat : ${ratio}:1 (4,5:1 au moins)`);
  if ((await page.run(buttonsOf)).join() !== words.next || (await page.run(focusText)) !== words.next) note('fin', `« ${words.next} » n'est pas seul avec le focus`);
  await clickButton(page, words.next);
  const outcome = await page.run(() => window.kit.outcome);
  if (!outcome || outcome.state !== 'done' || (await page.run(isOpen))) note('fin', `la fenêtre ne se ferme pas sur « ${words.next} » (réponse : ${JSON.stringify(outcome && outcome.state)})`);
}

// Une table que Sync+ utilise garde son nom ; un refus de Grist : deux boutons, Échap continue sans mettre à jour.
async function otherCases(page, site, language, mode, tag, words, found) {
  const note = (kind, text) => found.push({ kind: `fenêtre de mise à jour des noms : ${kind}`, text: `${tag} : ${text}` });
  await openCase(page, site, language, mode, 'sync');
  const text = await page.run(bodyText);
  const held = await page.run(rectOf, '.nu-held');
  const actions = await page.run(rectOf, '#nu-modal .pp-modal-actions');
  if (!text.includes(words.held) || !text.includes('Publipostage_Modeles')) note('Sync+', 'la fenêtre ne dit pas qu\'une table garde son ancien nom parce que Sync+ s\'en sert');
  if (held && held.bottom > actions.y) note('sous le pli', 'le bandeau Sync+ est sous le bouton');
  const ratio = await page.run(contrastOf, '.nu-held');
  if (ratio === null || ratio < 4.5) note('contraste', `le bandeau Sync+ : ${ratio}:1`);
  await clickButton(page, words.start);
  await page.until(() => /^(Terminé|Done)/.test(document.querySelector('#nu-modal .nu-body').textContent), [], 8000).catch(() => null);
  const tables = await page.run(() => window.kit.doc.tables());
  if (!tables.Publipostage_Modeles || !tables.Publipostage_Modeles.includes('id_sync') || !tables.Publipostage_Modeles.includes('Nom')) note('Sync+', 'la table de Sync+ a perdu son nom ou ses colonnes');

  await openCase(page, site, language, mode, 'refuse');
  await clickButton(page, words.start);
  await page.until(() => /Rien n’a changé|Nothing changed/.test(document.querySelector('#nu-modal .nu-body').textContent), [], 8000).catch(() => null);
  if ((await page.run(buttonsOf)).join() !== [words.skip, words.retry].join()) note('refus', `les boutons après un refus sont « ${(await page.run(buttonsOf)).join(' / ')} »`);
  if (!words.refused.test(await page.run(bodyText))) note('refus', 'le texte du refus manque');
  const refusedBox = await page.run(rectOf, '#nu-modal .pp-modal-box');
  if (!inPanel(refusedBox)) note('hors du panneau', 'la fenêtre du refus sort du panneau');
  await page.press('Escape');
  const outcome = await page.run(() => window.kit.outcome);
  if (!outcome || outcome.state !== 'skipped' || (await page.run(isOpen))) note('refus', 'Échap après un refus ne vaut pas « Continuer sans mettre à jour »');
}

export async function namesWindowProblems(page, site, language, mode) {
  const words = WORDS[language];
  const tag = `${language}, 700 × 400, ${mode === 'dark' ? 'sombre' : 'clair'}`;
  const found = [];
  await normalCase(page, site, language, mode, tag, words, found);
  await otherCases(page, site, language, mode, tag, words, found);
  return found;
}

// Ce que la page a écrit de gênant dans la console (une clé de traduction inconnue, une erreur), depuis `since`.
export function namesLogs(page, since) {
  return page.logs.slice(since).filter(entry => entry.level === 'error' || (entry.level === 'warning' && /I18n|clé|chargé deux fois/.test(entry.text || ''))).map(entry => ({
    kind: 'fenêtre de mise à jour des noms : console', text: `la page a écrit « ${String(entry.text).slice(0, 140)} »` }));
}
