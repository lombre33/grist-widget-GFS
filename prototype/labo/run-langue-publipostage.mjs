// Le choix de langue de GFS avec la vraie app (consigne 019 ; contrats 5.2, point 6), Publipostage+ à `f6d3fd0` ou après, dans un vrai Grist (grist-static), à 700 × 400, à la vraie
// souris et au vrai clavier. Tant que la référence de GFS est à `dc00b9d`, la passe n'y peut pas passer : cette version de l'app ne lit pas `contexte.langue`. run-langue.mjs mesure le côté de GFS avec une sonde ; ici l'app elle-même lit `contexte.langue` au départ, suit l'événement `langue` comme son propre changement
// de langue (la question « Enregistrer / Abandonner / Annuler » d'abord, puis le rechargement qui rouvre le modèle) et grise son choix de langue. LAB_LANG=fr|en est la langue de Grist,
// LAB_SCHEME=light|dark. Ce que la passe mesure :
//   1. le départ : l'app parle la langue de GFS, ses Réglages grisent les deux cases de langue (jamais masquées) et disent où choisir ;
//   2. rien ne reste à enregistrer : GFS change de langue (explorateur ouvert, l'app cachée derrière), l'app se recharge dans l'autre langue et rouvre le même modèle, dans le même cadre ;
//      son adresse garde la langue de sa création, GFS ne dit rien, rien n'est écrit dans le document ;
//   3. un rechargement qui ne vient pas de l'app (F5) : la page repart dans la langue de l'adresse de son cadre, puis rattrape celle de GFS (`contexte.langue` fait foi) ;
//   4. « comme Grist » ramène l'app à la langue de Grist ;
//   5. des modifications attendent : la question de l'app est posée derrière l'explorateur (cadre caché, inerte), la personne la voit en fermant l'explorateur ; « Annuler » laisse la langue
//      d'avant, « Abandonner » recharge sans garder ce qui a été tapé, « Enregistrer » enregistre d'abord ; un changement qui redit la langue de l'app ne pose aucune question.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const other = lang === 'fr' ? 'en' : 'fr';
const run = `langue-publipostage-${lang}-${scheme}`;
const NAMES = { fr: 'Français', en: 'English' };
const WORDS = {
  fr: { buttons: ['Annuler', 'Abandonner', 'Enregistrer'], note: 'La langue se choisit dans Grist Factory Suite (bouton Langue de l’explorateur).', theme: 'Thème', unsaved: 'Modifications non enregistrées' },
  en: { buttons: ['Cancel', 'Discard', 'Save'], note: 'The language is chosen in Grist Factory Suite (Language button in the explorer).', theme: 'Theme', unsaved: 'Unsaved changes' },
};
const USUAL = 'Feuille d’émargement'; // le modèle ★ du document d'essai : celui que l'app ouvre d'elle-même
const OPEN = 'Contrat de prestation'; // celui que la personne ouvre : la page doit le retrouver après chaque rechargement voulu
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
const errors = [];
page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('GFS')) warnings.push(m.text()); });
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
// La personne a un modèle ★ (par défaut) : c'est celui que l'app ouvre d'elle-même, le modèle ouvert au double-clic doit passer devant.
await lab.frame.evaluate(() => grist.docApi.applyUserActions([['UpdateRecord', 'Publipostage_Modeles', 1, { EstParDefaut: true }]]));

let frame = lab.frame;
let app = null;
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const toast = async () => ((await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()).replace(/\s+/g, ' ') : '');
const explorerHidden = () => frame.locator('.ex').isHidden();
const frames = () => page.frames().filter(f => /\/apps\/publipostage\//.test(f.url())).length;
// Ce que la personne voit dans l'app : le modèle ouvert (numéro, nom, texte) et le coin d'état.
const shown = () => app.evaluate(() => ({
  id: String(Templates.getCurrentId()), name: document.getElementById('template-name').value,
  text: document.querySelector('.ProseMirror').textContent, status: document.getElementById('status-msg').textContent,
}));
const waitShown = async (name, ms = 20000) => {
  for (let i = 0; i < ms / 100; i++) {
    const seen = await shown().catch(() => null);
    if (seen && seen.name === name) return seen;
    await page.waitForTimeout(100);
  }
  return shown().catch(() => null);
};
const waitStarted = async () => {
  await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
  await page.waitForTimeout(600);
};
const goRoot = async () => { if (await frame.locator('.crumbs [data-path=""]').count()) await frame.locator('.crumbs [data-path=""]').click(); };
const showFiles = async () => {
  await frame.locator('#floater-files').click();
  await frame.locator('.ls-row').first().waitFor();
  await goRoot();
  await frame.locator('.ls-row', { hasText: 'Quittance de loyer' }).first().waitFor();
};
const closeExplorer = async () => {
  await frame.locator('.ex-foot .btn').nth(1).click();
  await frame.locator('#floaters').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
};
// Ce que le document retient : les modèles (tous leurs champs, la date comprise) et les réglages de la section.
const snapshot = () => frame.evaluate(async () => JSON.stringify({
  modeles: await grist.docApi.fetchTable('Publipostage_Modeles'), vue: (await grist.docApi.fetchTable('_grist_Views_section')).options,
}));
const contentOf = name => frame.evaluate(async n => {
  const data = await grist.docApi.fetchTable('Publipostage_Modeles');
  return data.Contenu[data.Nom.indexOf(n)];
}, name);
// La langue de GFS (celle de son explorateur) et son choix retenu.
const gfsLang = () => frame.evaluate(() => document.documentElement.lang);
const stored = () => frame.evaluate(() => { try { return localStorage.getItem('gfs.langue'); } catch (error) { return 'REFUSÉ'; } });
const chooseIn = async name => { await frame.locator('.tb-lang').click(); await frame.locator('.menu').waitFor(); await frame.locator('.menu-item', { hasText: new RegExp(`^${name}$`) }).click(); };
const chooseAuto = async () => { await frame.locator('.tb-lang').click(); await frame.locator('.menu').waitFor(); await frame.locator('.menu-item').first().click(); };
const flip = async () => { const now = await gfsLang(); await chooseIn(NAMES[now === 'fr' ? 'en' : 'fr']); };
// La langue de l'app, relevée dans la page : sa langue, une chaîne de l'interface, ce que GFS lui a dit, l'adresse de son cadre.
const appLang = () => app.evaluate(() => ({
  lang: I18n.getLang(), html: document.documentElement.lang, theme: document.querySelector('[data-settings-tab="theme"]').textContent.trim(),
  gfs: GfsLink.language(), hash: location.hash, language: new URLSearchParams(location.search).get('language'),
})).catch(() => null);
// Le rechargement de la page de l'app, voulu par elle : la marque posée avant a disparu, et la page a fini de démarrer dans la langue attendue.
const mark = () => app.evaluate(() => { window.__avant = true; });
const reloadedIn = async want => {
  try {
    await app.waitForFunction(w => !window.__avant && typeof I18n !== 'undefined' && I18n.getLang() === w && Boolean(document.getElementById('status-msg') && document.getElementById('status-msg').textContent), want, { timeout: 45000 });
  } catch (error) { say(`(pas arrivé : l'app dans la langue ${want})`); return false; }
  await page.waitForTimeout(800);
  return true;
};
// Les Réglages de l'app, onglet Langue : les cases (valeur, cochée, grisée) et la phrase qui dit où choisir.
const settingsState = async () => {
  await app.locator('#v2-btn-settings').click();
  await app.locator('[data-settings-tab="language"]').click();
  await page.waitForTimeout(200);
  return app.evaluate(() => {
    const radios = [...document.querySelectorAll('input[name="settings-lang"]')];
    const note = document.getElementById('settings-language-gfs-note');
    const box = note.getBoundingClientRect();
    return {
      radios: radios.map(r => ({ value: r.value, checked: r.checked, disabled: r.disabled, greyed: r.parentElement.classList.contains('is-disabled'), described: r.getAttribute('aria-describedby') })),
      note: note.hidden ? null : note.textContent.trim(), noteShown: !note.hidden && box.height > 0 && box.bottom <= innerHeight, labelsShown: radios.every(r => r.parentElement.getBoundingClientRect().height > 0),
    };
  });
};
const closeSettings = async () => { await app.locator('#settings-close').click(); await page.waitForTimeout(200); };
const dialog = () => app.evaluate(() => {
  const overlay = document.getElementById('pp-dialog-modal');
  if (!overlay || getComputedStyle(overlay).display === 'none') return null;
  const box = overlay.querySelector('.modal-content').getBoundingClientRect();
  return {
    title: (overlay.querySelector('h2, h3, .pp-modal-title') || { textContent: '' }).textContent.trim(),
    buttons: [...overlay.querySelectorAll('.pp-modal-actions button')].filter(b => !b.hidden).map(b => b.textContent),
    inPanel: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
  };
});
const dialogButton = label => app.locator('#pp-dialog-modal .pp-modal-actions button', { hasText: label });
const typeAtEnd = async text => {
  const box = await app.locator('.ProseMirror p').first().boundingBox();
  await page.mouse.click(box.x + box.width - 3, box.y + box.height / 2);
  await page.keyboard.press('End');
  await page.keyboard.type(text);
};

// ---------- 0. GFS repart, la personne ouvre un modèle : l'app démarre dessus ----------
// Le premier départ de l'app écrit lui-même dans le document (des colonnes ajoutées à ses tables) : il passe par la fenêtre des apps, sans consigne, avant la première mesure.
await lab.openModules(frame);
await frame.locator('[data-open="publipostage"]').click();
app = await lab.appFrame(/publipostage/);
await waitStarted();
await restart();
await row(OPEN).dblclick();
app = await lab.appFrame(/publipostage/);
await waitStarted();
let seen = await waitShown(OPEN);
const base = await snapshot();
let state = await appLang();
say('au départ :', state, seen && seen.name, 'adresse du cadre :', app.url());

// ---------- 1. le départ ----------
check('l\'app ouverte dans GFS parle la langue de GFS (celle de Grist), que son adresse et son contexte lui ont donnée',
  state.lang === lang && state.html === lang && state.theme === WORDS[lang].theme && state.gfs === lang && state.language === lang, state);
check('le modèle demandé est ouvert, la langue de GFS n\'est pas retenue (aucun choix de la personne)', seen.name === OPEN && (await stored()) === null, { seen, stored: await stored() });
let settings = await settingsState();
say('Réglages, onglet Langue :', settings);
check('Réglages > Langue : les deux cases sont grisées (jamais masquées), celle de la langue de GFS est cochée, les cases ne répondent pas à la souris',
  settings.radios.length === 2 && settings.radios.every(r => r.disabled && r.greyed && r.described === 'settings-language-gfs-note') && settings.radios.find(r => r.checked).value === lang && settings.labelsShown, settings);
check('et la phrase dit où choisir (« bouton Langue de l\'explorateur »), dans la langue de l\'app, tenue dans le panneau', settings.note === WORDS[lang].note && settings.noteShown, settings);
await lab.shotPanel(run, '1-reglages-gries', frame);
// La vraie souris sur la case grisée (Playwright refuse de cliquer un contrôle grisé : on pose le pointeur nous-mêmes).
const greyedBox = await app.locator('label:has(input[name="settings-lang"][value="' + other + '"])').boundingBox();
await page.mouse.click(greyedBox.x + greyedBox.width / 2, greyedBox.y + greyedBox.height / 2);
await page.waitForTimeout(800);
check('cliquer une case grisée ne change rien : pas de rechargement, la langue de l\'app reste', (await appLang()).lang === lang && (await shown()).name === OPEN);
await closeSettings();

// ---------- 2. GFS change de langue, rien ne reste à enregistrer ----------
await mark();
await showFiles();
await chooseIn(NAMES[other]);
check('GFS passe dans l\'autre langue et la retient (explorateur ouvert, l\'app est cachée derrière)', (await gfsLang()) === other && (await stored()) === other && !(await explorerHidden()));
let ok = await reloadedIn(other);
seen = await waitShown(OPEN);
state = await appLang();
say('après le changement :', state, seen && seen.name, 'adresse du cadre :', app.url(), 'phrase de GFS :', await toast());
check('l\'app se recharge d\'elle-même dans l\'autre langue (même cadre, un seul cadre) et rouvre le modèle où la personne était, pas le ★',
  ok && state.lang === other && state.html === other && state.theme === WORDS[other].theme && seen.name === OPEN && seen.name !== USUAL && frames() === 1, { ok, state, seen });
check('GFS ne dit rien, l\'explorateur reste ouvert dans sa nouvelle langue, aucun avertissement de GFS', (await toast()) === '' && !(await explorerHidden()) && (await gfsLang()) === other && warnings.length === 0, { phrase: await toast(), warnings });
check('l\'adresse du cadre redevient celle que GFS a donnée (plus de fragment) et garde la langue de sa création : GFS ne l\'a pas rechargé', state.hash === '' && state.language === lang && state.gfs === other, { hash: state.hash, language: state.language, gfs: state.gfs });
check('rien n\'est écrit dans le document par ce changement de langue (ni modèle, ni ★, ni réglage de la vue)', (await snapshot()) === base);
await closeExplorer();
settings = await settingsState();
check('l\'app rechargée grise toujours ses cases et dit où choisir, dans la nouvelle langue',
  settings.radios.every(r => r.disabled && r.greyed) && settings.radios.find(r => r.checked).value === other && settings.note === WORDS[other].note && settings.noteShown, settings);
await lab.shotPanel(run, '2-reglages-autre-langue', frame);
await closeSettings();

// ---------- 3. un rechargement qui ne vient pas de l'app : l'adresse de son cadre garde l'ancienne langue ----------
await mark();
await app.evaluate(() => location.reload()).catch(() => {});
ok = await reloadedIn(other);
seen = await waitShown(USUAL);
state = await appLang();
say('après F5 :', state, seen && seen.name, 'adresse du cadre :', app.url());
check('F5 sur le cadre de l\'app : la page repart dans la langue de son adresse (celle de la création du cadre), puis rattrape la langue de GFS (`contexte.langue` fait foi) ; un F5 ne vient pas de l\'app, elle rouvre le modèle habituel (le ★)',
  ok && state.lang === other && state.language === lang && state.gfs === other && frames() === 1 && state.hash === '' && seen.name === USUAL, { ok, state, seen });
check('ce rechargement n\'écrit rien non plus, et GFS ne dit rien', (await snapshot()) === base && (await toast()) === '');

// ---------- 4. « comme Grist » ----------
await showFiles();
await row(OPEN).dblclick();
seen = await waitShown(OPEN);
await mark();
await showFiles();
await chooseAuto();
ok = await reloadedIn(lang);
seen = await waitShown(OPEN);
state = await appLang();
check('« comme Grist » ramène GFS et l\'app à la langue de Grist (le choix retenu disparaît) et l\'app rouvre le modèle où elle était',
  ok && state.lang === lang && state.gfs === lang && (await gfsLang()) === lang && (await stored()) === null && seen.name === OPEN, { ok, state, seen, stored: await stored() });
await closeExplorer();

// ---------- 5. des modifications attendent ----------
// L'enregistrement automatique de l'app (toutes les 2,5 s) peut passer entre la frappe et le changement de langue : elle enregistre alors, se recharge sans question, et l'essai recommence dans
// l'autre sens (jamais plus de huit fois).
const pendingFlip = async token => {
  for (let attempt = 1; attempt <= 8; attempt++) {
    if (!(await explorerHidden())) await closeExplorer();
    const typed = `${token}${attempt}`;
    await typeAtEnd(` ${typed}`);
    await showFiles();
    await mark();
    await flip();
    for (let i = 0; i < 35 && !(await dialog()); i++) await page.waitForTimeout(100);
    if (await dialog()) return { typed, attempt };
    say(`(essai ${attempt} : l'enregistrement automatique est passé, l'app s'est rechargée sans question)`);
    await reloadedIn(await gfsLang());
    await waitShown(named);
  }
  return null;
};
const named = (await shown()).name;
// Ce que la personne voit pendant que l'explorateur est ouvert : le cadre de l'app est caché (et inerte) derrière lui.
const behindExplorer = async () => ({ frameShown: await (await app.frameElement()).isVisible(), inert: await frame.evaluate(() => document.getElementById('frames').inert), explorerOpen: !(await explorerHidden()) });

// « Annuler » : la question est posée, la langue d'avant reste.
let episode = await pendingFlip('ANNULE');
let askedLang = (await appLang()).lang; // la question est dans la langue que l'app parle encore
let asked = await dialog();
const behind = await behindExplorer();
say('question posée :', asked, 'derrière l\'explorateur :', behind, 'langue de l\'app :', askedLang, 'langue de GFS :', await gfsLang());
check('des modifications attendent : l\'app pose sa question (Annuler, Abandonner, Enregistrer) dans sa langue du moment, GFS ne dit rien',
  Boolean(episode) && Boolean(asked) && asked.buttons.join('|') === WORDS[askedLang].buttons.join('|') && asked.title === WORDS[askedLang].unsaved && (await toast()) === '', { asked, phrase: await toast() });
check('mesuré : explorateur ouvert, le cadre de l\'app est caché et inerte derrière lui, la question n\'est pas visible de la personne', behind.explorerOpen && behind.inert && !behind.frameShown, behind);
await closeExplorer();
asked = await dialog();
check('en fermant l\'explorateur, la personne la voit : elle tient dans le panneau', Boolean(asked) && asked.inPanel && (await behindExplorer()).frameShown && !(await behindExplorer()).inert, asked);
await lab.shotPanel(run, '3-question', frame);
await dialogButton(WORDS[askedLang].buttons[0]).click();
await page.waitForTimeout(800);
seen = await shown();
state = await appLang();
check('« Annuler » : l\'app garde sa langue d\'avant, le modèle ouvert et ce qui a été tapé ; GFS, lui, reste dans la sienne et ne dit rien',
  state.lang === askedLang && seen.name === named && seen.text.includes(episode.typed) && !(await dialog()) && (await gfsLang()) !== askedLang && (await toast()) === '', { state, seen, gfs: await gfsLang() });
// GFS redit la langue de l'app (un changement de plus) : rien à apprendre, aucune question, aucun rechargement.
await mark();
await showFiles();
await (askedLang === lang ? chooseAuto() : chooseIn(NAMES[askedLang]));
await page.waitForTimeout(1200);
check('un changement de GFS qui redit la langue de l\'app ne pose aucune question et ne la recharge pas', !(await dialog()) && (await app.evaluate(() => Boolean(window.__avant))) && (await gfsLang()) === askedLang);
await closeExplorer();

// « Abandonner » : ce qui a été tapé n'est pas gardé, l'app se recharge dans la langue de GFS et rouvre le modèle.
episode = await pendingFlip('ABANDONNE');
askedLang = (await appLang()).lang;
await closeExplorer();
let target = await gfsLang();
check('GFS change de langue de nouveau, des modifications attendent : la question revient', Boolean(episode) && Boolean(await dialog()), await dialog());
await dialogButton(WORDS[askedLang].buttons[1]).click();
ok = await reloadedIn(target);
seen = await waitShown(named);
state = await appLang();
check('« Abandonner » : l\'app se recharge dans la langue de GFS et rouvre le même modèle, sans ce qui a été tapé',
  ok && state.lang === target && seen.name === named && !seen.text.includes(episode.typed) && !(await contentOf(named)).includes(episode.typed) && frames() === 1 && (await toast()) === '', { ok, state, seen });

// « Enregistrer » : le modèle est enregistré d'abord (l'écriture de l'app passe par GFS pendant que son appel attend), puis la page se recharge.
episode = await pendingFlip('ENREGISTRE');
askedLang = (await appLang()).lang;
await closeExplorer();
target = await gfsLang();
await dialogButton(WORDS[askedLang].buttons[2]).click();
ok = await reloadedIn(target);
seen = await waitShown(named);
state = await appLang();
check('« Enregistrer » : le modèle est enregistré avec ce qui a été tapé, puis l\'app se recharge dans la langue de GFS et le rouvre',
  Boolean(episode) && ok && state.lang === target && seen.name === named && (await contentOf(named)).includes(episode.typed) && seen.text.includes(episode.typed), { ok, state, seen });
await lab.shotPanel(run, '4-apres-enregistrement', frame);

// ---------- fin ----------
await showFiles();
await chooseAuto();
ok = await reloadedIn(lang);
state = await appLang();
check('« comme Grist » ramène tout à la langue de Grist en fin de passe', ok && state.lang === lang && (await gfsLang()) === lang && (await stored()) === null && frames() === 1, state);
check('aucune erreur de page, aucun avertissement de GFS pendant la passe', errors.length === 0 && warnings.length === 0, { errors, warnings: warnings.map(text => text.slice(0, 120)) });
await lab.browser.close();
