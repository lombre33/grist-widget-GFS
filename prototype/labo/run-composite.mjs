// Un fichier qui tient à plus qu'une ligne (décision du porteur, 04/11 : tout se fait depuis l'explorateur, pour toutes les apps ; contrats 2.4 `appel`, 5.4 points 10 et 11 : un formulaire de Form+ et son lien public),
// dans un VRAI Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier. L'app active (la sonde ZF, labo/sondes/zf-composite/) répond aux appels `supprimer` et `dupliquer` de GFS comme le fera Form+
// après les consignes 020 et 021 ; elle écrit elle-même sa copie par le courtier de GFS (le vrai script d'API de Grist). Le sondage de la sonde : `body[data-sonde]` ; ses réponses : `body[data-supprimer]`
// (`oui`, `nu`, `non`, `echec`, `muet`, ou rien : GFS_INCONNU) et `body[data-dupliquer]` (`oui`, `refus`, `echec`, `muet`, ou rien). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   1. L'app n'est pas ouverte (une autre l'est) : « Mettre à la corbeille » et « Dupliquer » sont grisés, le clic, Suppr et Ctrl+C puis Ctrl+V disent d'ouvrir l'app ; rien n'est écrit, la table de la corbeille n'existe pas.
//   2. L'app ouverte : la question de la table de la corbeille passe avant l'appel (un refus n'appelle pas l'app) ; puis l'app ferme ce qui est lié, la ligne part à la corbeille dans UN lot, la phrase de l'app s'ajoute.
//   3. Les autres réponses de l'app : « non » (sa phrase seule, rien ne part), une erreur, un appel inconnu, le silence (le délai de GFS) : la phrase le dit, rien n'est écrit.
//   4. « Dupliquer » : l'app reçoit le fichier et le premier nom libre, écrit sa copie par le courtier, GFS la lit et la montre ; ses refus se disent comme ceux de la corbeille.
//   5. Restaurer : la ligne revient à son numéro, valeurs identiques ; la phrase de l'app, longue, tient dans le panneau.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { createI18n } from '../js/i18n.js';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const run = `composite-${lang}-${scheme}`;
const APP = lang === 'fr' ? 'Sonde ZF' : 'Probe ZF';
const SAID = { trash: 'Son lien public est fermé.', refused: 'Ce formulaire est en cours de publication.', copy: 'Elle n’est pas publiée.', title: 'Il faut un titre.' };
const FAULT = { delete: 'Le lien public n’a pas pu être fermé.' };
// Le délai de GFS devant une app muette (20 s) est ramené à 1,5 s pour cette mesure seule (le fichier publié n'est pas touché).
const PATIENCE = { fichier: 'app-files.js', de: 'const APP_PATIENCE_MS = 20000;', vers: 'const APP_PATIENCE_MS = 1500;' };
const lab = await startLab({ lang, colorScheme: scheme, probes: ['zf', 'q'], patches: [PATIENCE] });
await lab.fitPanel(undefined, 700, 400);
const { page } = lab;
const warnings = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });

// Les formulaires de la sonde : une table du préfixe de l'app, remplie par GFS (accès complet) ; GFS les relit en repartant.
const now = Math.floor(Date.now() / 1000);
await lab.frame.evaluate(async stamp => {
  const columns = [{ id: 'Nom', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'DateModif', type: 'DateTime' }];
  await grist.docApi.applyUserActions([['AddTable', 'SondeZf_Fichiers', columns]]);
  await grist.docApi.applyUserActions([['BulkAddRecord', 'SondeZf_Fichiers', [null, null, null], { Nom: ['Inscription atelier', 'Enquête', 'Bilan'], Type: ['formulaire', 'formulaire', 'formulaire'], DateModif: [stamp - 60, stamp - 120, stamp - 180] }]]);
}, now);
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);

const ZF = /zf-composite\//;
const Q = /q-liens\//;
const frameOf = re => page.frames().find(each => re.test(each.url()));
const count = re => page.frames().filter(each => re.test(each.url())).length;
const readProbe = each => each.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}')).catch(() => ({}));
const waitFor = async (label, test, tries = 80) => {
  for (let i = 0; i < tries; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
const modal = frame.locator('.mod.ask');
const toast = frame.locator('#toast');
const row = name => frame.locator('.ls-row', { has: frame.locator('.t', { hasText: new RegExp(`^${name.replace(/[()]/g, '\\$&')}$`) }) }).first();
const names = () => frame.locator('.ls-row:not(.folder) .t').allInnerTexts();
const shot = name => lab.shotPanel(run, name, frame);
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
// Ce que le document retient d'une table : ses lignes (id et colonnes), ou null quand elle n'existe pas.
const table = name => frame.evaluate(async tableId => {
  if (!(await grist.docApi.listTables()).includes(tableId)) return null;
  const data = await grist.docApi.fetchTable(tableId);
  const columns = Object.keys(data).filter(each => each !== 'id' && !each.startsWith('manualSort'));
  return data.id.map((id, i) => ({ id, ...Object.fromEntries(columns.map(each => [each, data[each][i]])) }));
}, name);
const files = async () => ((await table('SondeZf_Fichiers')) || []).map(each => each.Nom);
const bin = () => table('GFS_Corbeille');
// La dernière phrase de GFS, mot pour mot, une fois dite.
const said = async text => {
  await toast.filter({ hasText: exact(text) }).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  return (await toast.innerText().catch(() => '')).trim();
};
const quiet = () => toast.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
const ready = async () => waitFor('le contexte de la sonde ZF', async () => { const each = frameOf(ZF); return Boolean(each) && (await readProbe(each)).contexte === true; }, 120);
const answer = (name, value) => frameOf(ZF).evaluate(([key, mode]) => { if (mode) document.body.dataset[key] = mode; else delete document.body.dataset[key]; }, [name, value]);
const showFiles = async name => { if (!(await frame.locator('.ex').isVisible())) await frame.locator('#floater-files').click(); await row(name).waitFor(); };
const openMenu = async name => { await row(name).click({ button: 'right' }); await frame.locator('.menu').waitFor(); };
const item = label => frame.locator('.menu .menu-item', { hasText: new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\…]/g, '\\$&')}`) }).first();
const greyed = async label => (await item(label).getAttribute('aria-disabled')) === 'true';
const fits = async () => toast.evaluate(node => {
  const box = node.getBoundingClientRect();
  return { inPanel: box.left >= 0 && box.right <= window.innerWidth && box.top >= 0 && box.bottom <= window.innerHeight, clipped: node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1 };
});

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 0. la sonde ZF est installée, puis une autre app (la sonde Q) prend sa place : l\'app des fichiers n\'est pas ouverte ===');
await lab.openApp('sonde-zf', ZF, frame);
await ready();
await lab.openApp('sonde-q', Q, frame);
check('la sonde Q est ouverte, la sonde ZF est partie', count(Q) === 1 && count(ZF) === 0, { q: count(Q), zf: count(ZF) });
await showFiles('Inscription atelier');
check('l\'explorateur montre les trois formulaires de la sonde ZF', JSON.stringify((await names()).sort()) === JSON.stringify(['Bilan', 'Enquête', 'Inscription atelier']), await names());

say('=== 1. l\'app n\'est pas ouverte : les deux gestes sont grisés et disent d\'ouvrir l\'app ===');
await openMenu('Inscription atelier');
check('le menu de la ligne grise « Mettre à la corbeille » et « Dupliquer »', await greyed(t('trash.move')) && await greyed(t('ex.duplicate')), await frame.locator('.menu .menu-item').allInnerTexts());
await item(t('trash.move')).click({ force: true }); // un article grisé reste cliquable pour la personne : le clic dit pourquoi
check('un clic sur « Mettre à la corbeille » grisé dit d\'ouvrir l\'app, mot pour mot', await said(t('trash.openApp', { app: APP })) === t('trash.openApp', { app: APP }));
await quiet();
await openMenu('Inscription atelier');
await item(t('ex.duplicate')).click({ force: true });
check('un clic sur « Dupliquer » grisé le dit aussi', await said(t('copy.openApp', { app: APP })) === t('copy.openApp', { app: APP }));
await quiet();
await row('Inscription atelier').click();
await page.keyboard.press('Delete');
check('Suppr dit la même chose, sans rien mettre à la corbeille', await said(t('trash.openApp', { app: APP })) === t('trash.openApp', { app: APP }) && (await names()).includes('Inscription atelier'));
await quiet();
await page.keyboard.press('Control+c');
await page.keyboard.press('Control+v');
check('Ctrl+C puis Ctrl+V le disent pour la copie', await said(t('copy.openApp', { app: APP })) === t('copy.openApp', { app: APP }));
await quiet();
check('rien n\'est écrit : trois formulaires, pas de table de corbeille', JSON.stringify((await files()).sort()) === JSON.stringify(['Bilan', 'Enquête', 'Inscription atelier']) && (await bin()) === null, { fichiers: await files(), corbeille: await bin() });
await shot('1-app-fermee');

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 2. la sonde ZF s\'ouvre : la question de la table passe avant l\'appel, puis l\'app ferme, puis UN lot ===');
await lab.openApp('sonde-zf', ZF, frame);
await ready();
await answer('supprimer', 'oui');
await showFiles('Inscription atelier');
await openMenu('Inscription atelier');
check('app ouverte : « Mettre à la corbeille » et « Dupliquer » sont dégrisés', !(await greyed(t('trash.move'))) && !(await greyed(t('ex.duplicate'))), await frame.locator('.menu .menu-item').allInnerTexts());
await page.keyboard.press('Escape');
await row('Inscription atelier').click();
await page.keyboard.press('Delete');
await modal.waitFor({ state: 'visible', timeout: 8000 });
check('la question de la table de la corbeille est posée AVANT l\'appel : l\'app n\'a rien reçu', (await readProbe(frameOf(ZF))).supprimer.length === 0);
await frame.locator('[data-fk="ask-no"]').click();
await page.waitForTimeout(600);
check('la personne refuse : l\'app n\'est pas appelée, rien n\'est écrit, la ligne reste', (await readProbe(frameOf(ZF))).supprimer.length === 0 && (await bin()) === null && (await names()).includes('Inscription atelier'), { recu: (await readProbe(frameOf(ZF))).supprimer });
await quiet();
await lab.forgetActions();
await page.keyboard.press('Delete');
await modal.waitFor({ state: 'visible', timeout: 8000 });
await frame.locator('[data-fk="ask-yes"]').click();
const moved = `${t('trash.moved', { name: 'Inscription atelier' })} ${SAID.trash}`;
check('la phrase de GFS et celle de l\'app, bout à bout', await said(moved) === moved);
const received = (await readProbe(frameOf(ZF))).supprimer;
check('l\'app a reçu le fichier et la raison, une fois', JSON.stringify(received) === JSON.stringify([{ fichier: { id: '1', type: 'formulaire' }, raison: 'corbeille' }]), received);
const stored = (await bin()) || [];
check('GFS_Corbeille garde la ligne (app, table, fichier, nom, instantané) et la table n\'a plus que deux formulaires', stored.length === 1 && stored[0].App === 'sonde-zf' && stored[0].Table === 'SondeZf_Fichiers' && stored[0].FichierId === '1'
  && stored[0].Nom === 'Inscription atelier' && JSON.parse(stored[0].Instantane).valeurs.Nom === 'Inscription atelier' && JSON.stringify((await files()).sort()) === JSON.stringify(['Bilan', 'Enquête']), { stored, fichiers: await files() });
const verbs = (await lab.actions()).filter(each => /^(AddRecord|RemoveRecord) /.test(each));
check('la ligne a été copiée puis retirée dans le même lot (AddRecord GFS_Corbeille, RemoveRecord SondeZf_Fichiers)', JSON.stringify(verbs) === JSON.stringify(['AddRecord GFS_Corbeille', 'RemoveRecord SondeZf_Fichiers']), verbs);
check('la liste ne montre plus le formulaire', !(await names()).includes('Inscription atelier') && (await row('Enquête').count()) === 1, await names());
const phrase = await fits();
check('la phrase, la plus longue, tient dans le panneau de 700 × 400 sans être coupée', phrase.inPanel && !phrase.clipped, phrase);
await shot('2-a-la-corbeille');
await quiet();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 3. les autres réponses de l\'app ===');
const refused = async (label, mode, expected, started = null) => {
  await answer('supprimer', mode);
  await row('Enquête').click();
  const before = JSON.stringify(await files());
  await page.keyboard.press('Delete');
  const text = await said(expected);
  check(`${label} : la phrase est dite, mot pour mot`, text === expected, { dit: text, attendu: expected });
  check(`${label} : rien n'est écrit (la ligne reste, la corbeille garde une seule ligne)`, JSON.stringify(await files()) === before && ((await bin()) || []).length === 1, { fichiers: await files(), corbeille: (await bin() || []).length });
  await quiet();
  return started === null ? null : Date.now() - started;
};
await refused('« non »', 'non', SAID.refused);
await refused('une erreur de l\'app', 'echec', t('trash.failed', { name: 'Enquête', reason: FAULT.delete }));
await refused('un appel que l\'app ne connaît pas', '', t('trash.failed', { name: 'Enquête', reason: t('app.unknown', { app: APP }) }));
const startedAt = Date.now();
await refused('une app muette (1,5 s de patience)', 'muet', t('trash.failed', { name: 'Enquête', reason: t('app.silent', { app: APP }) }));
check('l\'attente a duré le délai de GFS (1,5 s) et pas moins', Date.now() - startedAt >= 1400, Date.now() - startedAt);
await answer('supprimer', 'nu');
await row('Bilan').click();
await page.keyboard.press('Delete');
check('« nu » ({ fait: true } sans phrase) : la phrase de GFS seule', await said(t('trash.moved', { name: 'Bilan' })) === t('trash.moved', { name: 'Bilan' }));
await quiet();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 4. « Dupliquer » : l\'app copie, par le courtier de GFS ===');
await answer('dupliquer', 'oui');
await row('Enquête').click();
await page.keyboard.press('Control+c');
await page.keyboard.press('Control+v');
const copied = `${t('copy.done', { as: 'Enquête (1)' })} ${SAID.copy}`;
check('la phrase de GFS et celle de l\'app, bout à bout', await said(copied) === copied);
const asked = (await readProbe(frameOf(ZF))).dupliquer;
check('l\'app a reçu le fichier et le premier nom libre', JSON.stringify(asked) === JSON.stringify([{ fichier: { id: '2', type: 'formulaire' }, nom: 'Enquête (1)' }]), asked);
await waitFor('la copie dans la liste', async () => (await names()).includes('Enquête (1)'));
check('la copie, écrite par l\'app, est dans le document et dans la liste, et GFS n\'a écrit aucune ligne', JSON.stringify((await files()).sort()) === JSON.stringify(['Enquête', 'Enquête (1)']) && (await names()).includes('Enquête (1)'), { fichiers: await files(), liste: await names() });
check('la copie prend le clavier', (await frame.locator('.ls-row[aria-selected="true"] .nm .t').first().innerText()).trim() === 'Enquête (1)');
await quiet();
await answer('dupliquer', 'refus');
await row('Enquête').click();
await page.keyboard.press('Control+c');
await page.keyboard.press('Control+v');
check('l\'app ne copie pas (« refus ») : sa phrase seule, aucune ligne de plus', await said(SAID.title) === SAID.title && (await files()).length === 2, await files());
await quiet();
await answer('dupliquer', 'echec');
await page.keyboard.press('Control+v');
const failedCopy = t('copy.failed', { name: 'Enquête', reason: 'La copie n’a pas pu être écrite.' });
check('une erreur de l\'app : la phrase de la copie manquée', await said(failedCopy) === failedCopy && (await files()).length === 2);
await quiet();
await answer('dupliquer', 'muet');
await page.keyboard.press('Control+v');
const silentCopy = t('copy.failed', { name: 'Enquête', reason: t('app.silent', { app: APP }) });
check('une app muette : la phrase le dit, après le délai', await said(silentCopy) === silentCopy && (await files()).length === 2);
await quiet();
await answer('dupliquer', '');
await page.keyboard.press('Control+v');
const unknownCopy = t('copy.failed', { name: 'Enquête', reason: t('app.unknown', { app: APP }) });
check('un appel que l\'app ne connaît pas : la phrase le dit', await said(unknownCopy) === unknownCopy && (await files()).length === 2);
await quiet();

// ---------------------------------------------------------------------------------------------------------------------------------
say('=== 5. restaurer : la ligne revient à son numéro, valeurs identiques ===');
await frame.locator('.tr-row[data-view="trash"]').click();
await row('Inscription atelier').waitFor();
await row('Inscription atelier').click();
await page.keyboard.press('Enter');
check('la phrase de la restauration', await said(t('trash.restored', { name: 'Inscription atelier' })) === t('trash.restored', { name: 'Inscription atelier' }));
const back = ((await table('SondeZf_Fichiers')) || []).find(each => each.Nom === 'Inscription atelier');
check('la ligne est revenue au numéro 1, avec son type et sa date', Boolean(back) && back.id === 1 && back.Type === 'formulaire' && back.DateModif === now - 60, back);
await quiet();
check('GFS n\'a écrit que ce qu\'il fallait : aucun avertissement inattendu dans la console', warnings.every(each => /le geste sur la corbeille a échoué|la copie a échoué/.test(each)), warnings);
await shot('5-restaurer');
await lab.browser.close();
