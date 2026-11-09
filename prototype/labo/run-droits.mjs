// Les permissions lues par GFS (étape 6 ; contrats 11.4 point 7, 11.9 point 8 et 5.2 point 8), jouées dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`), à 700 × 400, à la vraie souris
// et au vrai clavier. Le serveur d'essai ne connaît qu'une personne à la fois (GRIST_DEFAULT_EMAIL) : deux temps, entre lesquels on relance le serveur (voir LISEZ-MOI.md, « Les droits »).
//   PHASE=proprietaire  la personne d'essai crée le document et le partage, GFS lit les règles : « Pas protégé » sans règle ; les règles de GFS (« Encadré » partout, structure fermée) posées par
//                       action, comme le fera l'étape 7 : « Protégé » ; un partage public : le panneau le liste (page, table, lignes, colonnes cachées) sans jamais montrer sa clé ; le rôle d'une app :
//                       `proprietaire: true`.
//   PHASE=editeur       le serveur relancé sous editor@example.com, le même document : le même mot (un éditeur lit les mêmes règles, mesuré), « tu n'es pas propriétaire », les liens publics cachés,
//                       aucune clé de lien dans la page, et le rôle d'une app : `proprietaire: false`.
//   PHASE=lecteur       idem sous viewer@example.com.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" PHASE=proprietaire node run-droits.mjs
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check, probeDeclares } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { PAGE_PORT, openGfs, contrastProblems, windowFits } from './lab-pdf.mjs';
import { SHOTS } from './lab-common.mjs';
import { join } from 'node:path';
import { gfsFrame, chip, chipWord, openPanel, closePanel, apply, shareWithEditorAndViewer, fits } from './lab-droits.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.DROITS_ETAT || '/tmp/droits-gfs-etat.json';
const { t } = createI18n(lang);
const SECRET = 'cle-secrete-0123456789';
// La sonde V est « toujours là » (elle s'ouvre sans case à cocher) : elle note le contexte que GFS lui rend.
const ALWAYS = probeDeclares('sonde-v', { permanente: true });

const shot = async (frame, name) => (await frame.frameElement()).screenshot({ path: join(SHOTS, `droits-${lang}-${scheme}-${name}.png`) });
const text = async frame => (await frame.locator('.mod.rt').innerText()).replace(/\s+/g, ' ');

// Le contexte qu'une app (la sonde V) a reçu de GFS : son champ `role`.
async function roleSeenBy(page, frame) {
  if (await frame.locator('#floater-apps').isVisible()) await frame.locator('#floater-apps').click();
  else await frame.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
  await frame.locator('.mod').waitFor();
  await frame.locator('[data-open="sonde-v"]').click();
  let target;
  for (let i = 0; i < 60 && !target; i++) { target = page.frames().find(each => /v-personne\/index\.html/.test(each.url())); await page.waitForTimeout(250); }
  for (let i = 0; i < 60; i++) {
    const seen = await target.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}')).catch(() => ({}));
    if (seen.contexte) return seen.contexte.role;
    await page.waitForTimeout(250);
  }
  return undefined;
}

const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));

async function playOwner(run, id) {
  const { page } = run;
  let frame = run.frame;
  say('--- 1. le document sans aucune règle ---');
  check('le pied dit « Permissions » avant toute table de GFS ou d\'app', /Permissions/.test(await chipWord(frame, 'none')), await chip(frame).innerText());
  await apply(page, id, [['AddTable', 'GFS_Rangement', [{ id: 'Cle', type: 'Text' }]], ['AddTable', 'Publipostage_Modeles', [{ id: 'Nom', type: 'Text' }]], ['AddTable', 'Autres', [{ id: 'X', type: 'Text' }]]]);
  await page.reload();
  frame = await gfsFrame(page);
  check('deux tables de GFS et d\'app, aucune règle : « Pas protégé »', (await chipWord(frame, 'pas')) === t('rights.chip.pas'), await chip(frame).innerText());
  await openPanel(page, frame);
  let panel = await text(frame);
  check('le panneau : le mot, la phrase, les deux tables « Ouvert », la structure ouverte, propriétaire, aucun lien', [t('rights.chip.pas'), t('rights.lead.pas'), 'GFS_Rangement', 'Publipostage_Modeles', t('rights.level.ouvert'), t('rights.structure.open'), t('rights.role.true'), t('rights.links.none')].every(part => panel.includes(part)), panel);
  check('la table de la personne (« Autres ») n\'y est pas : GFS ne parle pas des tables de données', !panel.includes('Autres') && !panel.includes('Clients'), panel);
  check('il tient dans le panneau et ses textes tiennent la charte (4,5:1)', await fits(frame, '.mod.rt'), [await contrastProblems(frame, '.mod'), await windowFits(frame)]);
  await shot(frame, '1-pas-protege');
  await closePanel(page, frame);

  say('--- 2. les règles de GFS (Encadré) et la structure fermée ---');
  const resource = (n, tableId) => ['AddRecord', '_grist_ACLResources', -n, { tableId, colIds: '*' }];
  const rule = (n, resourceRef, formula, rights, memo) => ['AddRecord', '_grist_ACLRules', null, { resource: resourceRef, aclFormula: formula, permissionsText: rights, memo }];
  const status = await apply(page, id, [resource(1, 'GFS_Rangement'), resource(2, 'Publipostage_Modeles'), resource(3, '*'),
    rule(1, -1, 'user.Access != OWNER', '-CRUD', 'GFS : Encadré'), rule(2, -2, 'user.Access != OWNER', '-CRUD', 'GFS : Encadré'),
    ['AddRecord', '_grist_ACLRules', null, { resource: -3, aclFormula: 'user.Access != OWNER', permissionsText: '-S', memo: 'GFS : Encadré' }]]);
  check('les règles sont posées par une seule action', status === 200, status);
  frame = await gfsFrame(page);
  check('GFS relit les règles : « Protégé »', (await chipWord(frame, 'protege')) === t('rights.chip.protege'), await chip(frame).innerText());
  await openPanel(page, frame);
  panel = await text(frame);
  check('le panneau : « Protégé », deux tables « Encadré », la structure fermée', [t('rights.chip.protege'), t('rights.lead.protege'), t('rights.level.encadre'), t('rights.structure.closed')].every(part => panel.includes(part)) && !panel.includes(t('rights.level.ouvert')), panel);
  await shot(frame, '2-protege');
  await closePanel(page, frame);

  say('--- 3. un lien public ---');
  await apply(page, id, [
    ['AddRecord', '_grist_Shares', null, { linkId: SECRET, options: '{"publish":true}' }],
  ]);
  const ids = await page.evaluate(async doc => {
    const get = async table => (await (await fetch(`/api/docs/${doc}/tables/${table}/records`)).json()).records;
    const shares = await get('_grist_Shares'); const pages = await get('_grist_Pages'); const sections = await get('_grist_Views_section'); const views = await get('_grist_Views');
    const clients = pages.map(entry => entry.fields).find(fields => views.find(view => view.id === fields.viewRef).fields.name === 'Clients');
    return { share: shares.at(-1).id, page: pages.find(entry => entry.fields.viewRef === clients.viewRef).id, sections: sections.filter(entry => entry.fields.parentId === clients.viewRef).map(entry => entry.id) };
  }, id);
  const fields = await page.evaluate(async ([doc, sections]) => (await (await fetch(`/api/docs/${doc}/tables/_grist_Views_section_field/records`)).json()).records.filter(entry => sections.includes(entry.fields.parentId)).map(entry => entry.id), [id, ids.sections]);
  await apply(page, id, [['UpdateRecord', '_grist_Pages', ids.page, { shareRef: ids.share }], ...ids.sections.map(section => ['UpdateRecord', '_grist_Views_section', section, { shareOptions: '{"publish":true,"form":true}' }]),
    ...fields.map(field => ['UpdateRecord', '_grist_Views_section_field', field, { widgetOptions: '{"formIsHidden":true}' }])]);
  await openPanel(page, frame);
  panel = await text(frame);
  check('le panneau liste le partage : la page, la table qu\'il remplit, ses lignes, les colonnes qu\'aucun champ ne montre', panel.includes(t('rights.link.page', { page: 'Clients' })) && panel.includes(t('rights.link.fills', { table: 'Clients', n: 1 })) && panel.includes(t('rights.link.hidden', { columns: 'Nom' })), panel);
  check('la clé du lien n\'apparaît nulle part dans la page de GFS', !(await frame.evaluate(() => document.documentElement.outerHTML)).includes(SECRET));
  check('il tient dans le panneau et reste lisible (4,5:1)', await fits(frame, '.mod.rt'), [await contrastProblems(frame, '.mod'), await windowFits(frame)]);
  await shot(frame, '3-lien-public');
  await closePanel(page, frame);

  say('--- 4. le rôle donné aux apps ---');
  const role = await roleSeenBy(page, frame);
  check('la sonde V reçoit `role` : propriétaire prouvé, aucun espace', JSON.stringify(role) === '{"proprietaire":true,"responsableDe":[]}', role);
}

async function playOther(run, who) {
  const { page } = run;
  const frame = run.frame;
  say(`--- ${who} : le même document ---`);
  // Mesuré : les règles refusent la lecture d'une table aux non-propriétaires, donc Grist leur rend les tables des règles VIDES. GFS ne dit alors ni « Protégé » ni « Pas protégé ».
  check('le pied reste « Permissions » : ni « Pas protégé » ni « Protégé » quand GFS ne peut pas lire les règles', (await chipWord(frame, 'none')) === t('rights.chip.none'), await chip(frame).innerText());
  await openPanel(page, frame);
  const panel = await text(frame);
  check('le panneau dit pourquoi (propriétaire seul), qu\'on n\'est pas propriétaire, cache les tables et les liens publics', panel.includes(t('rights.lead.ownerOnly')) && panel.includes(t('rights.role.false')) && panel.includes(t('rights.links.owner-only')) && !panel.includes('GFS_Rangement') && !panel.includes('Clients') && !panel.includes(t('rights.chip.pas')), panel);
  check('la clé du lien n\'apparaît nulle part dans la page de GFS', !(await frame.evaluate(() => document.documentElement.outerHTML)).includes(SECRET));
  check('il tient dans le panneau et reste lisible (4,5:1)', await fits(frame, '.mod.rt'), [await contrastProblems(frame, '.mod'), await windowFits(frame)]);
  await shot(frame, `${who}-panneau`);
  await closePanel(page, frame);
  const role = await roleSeenBy(page, frame);
  check('la sonde V reçoit `role.proprietaire: false`', JSON.stringify(role) === '{"proprietaire":false,"responsableDe":[]}', role);
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  if (phase === 'proprietaire') {
    const run = await openGfs(context, { lang, probes: ['v'], patches: [ALWAYS] });
    await shareWithEditorAndViewer(run.page, run.docId);
    writeFileSync(STATE, JSON.stringify({ docId: run.docId, path: run.path }));
    await playOwner(run, run.docId);
    const bad = unexpected(run);
    check('aucune erreur de GFS dans la console', bad.length === 0, bad);
  } else {
    const { path } = JSON.parse(readFileSync(STATE, 'utf8'));
    const run = await openGfs(context, { lang, probes: ['v'], patches: [ALWAYS], path });
    await playOther(run, phase);
    const bad = unexpected(run);
    check('aucune erreur de GFS dans la console', bad.length === 0, bad);
  }
} finally {
  await browser.close();
  pages.close();
}
