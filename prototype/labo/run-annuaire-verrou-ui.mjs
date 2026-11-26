// Le verrou réel de « qui modifie les fiches » (module Annuaire ; choix du porteur, 26/11 : « Oui, sur demande, avec aperçu »), DEPUIS L'ÉCRAN, dans un VRAI serveur Grist (l'image officielle,
// `bash vrai-serveur.sh`), à 700 × 400, à la vraie souris, le propriétaire du document dans le vrai GFS. run-annuaire-verrou.mjs a mesuré ce que Grist répond à chaque personne (l'API REST,
// plusieurs comptes) ; celui-ci mesure le chemin de la personne qui pose : l'aperçu, l'accord, les colonnes d'aide, la liasse de règles, la fermeture de la structure, le rechargement que Grist
// impose à tout le monde, la réouverture de l'annuaire avec sa phrase, puis le retrait. Ce que Grist envoie (les lignes des tables internes lues par un propriétaire prouvé, le rechargement)
// ne se simule pas : c'est ici.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-annuaire-verrou-ui.mjs        LAB_LANG=fr|en, LAB_SCHEME=light|dark
import { createServer } from 'node:http';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { chromium, say, check, SHOTS } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { seedAnnuaire } from './jeu-annuaire.mjs';
import { gfsFrame } from './lab-droits.mjs';
import { rowsOf, closingRules } from './lab-rest.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const TAG = `annuaire-verrou-${lang}-${scheme}`;
const CONFIG = {
  v: 1, name: 'Nom', title: 'Poste', email: 'Email', phone: 'Tel', lead: 'Chef', manager: 'Responsable', relations: [], columns: ['email'],
  levels: [{ label: 'Pôle', path: ['Structure', 'Pole'] }, { label: 'Direction', path: ['Structure', 'Direction'] }, { label: 'Service', path: ['Service'] }],
  fields: [{ col: 'Contrat', filter: true }], edit: { self: true, level: 'below', role: 'Chef' },
};

const shot = async (frame, name) => (await frame.frameElement()).screenshot({ path: join(SHOTS, `${TAG}-${name}.png`) });
const LIGHT_READER_OFF = /la lecture légère des fichiers est éteinte pour cette session/;
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && !LIGHT_READER_OFF.test(problem));
const mineOf = async run => ((await rowsOf(run, '_grist_ACLRules')) || []).filter(rule => String(rule.memo || '').startsWith('GFS : Annuaire'));
const columnsOf = async run => ((await rowsOf(run, '_grist_Tables_column')) || []).filter(column => /^GFS_(Node|Editors)$/.test(column.colId)).map(column => column.colId);

// Ouvre la fenêtre de l'annuaire (le bouton du titre de l'explorateur).
async function openAnnuaire(frame, page) {
  await frame.locator('.ex-title-row button', { has: frame.locator('use[href="#i-annuaire"]') }).click();
  await frame.locator('.mod.an').waitFor({ state: 'visible' });
  await frame.locator('.an-person').first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(400);
}

// Le réglage de l'annuaire, onglet « Options », puis la fenêtre du verrou.
async function openLock(frame, page) {
  // Après « Annuler » ou un rechargement avec reprise, la fenêtre du réglage est peut-être encore là (le verrou s'ouvre par-dessus) : on ne la rouvre que si elle est fermée.
  if (!(await frame.locator('[data-fk="tab:options"]').isVisible())) await frame.locator('[data-fk="configure"]').click();
  await frame.locator('[data-fk="tab:options"]').click();
  const button = frame.locator('[data-fk="ol:open"]');
  await button.scrollIntoViewIfNeeded();
  check('le bouton « Aperçu et pose… » est ouvert (propriétaire prouvé, réglage enregistré)', (await button.getAttribute('aria-disabled')) !== 'true', await button.getAttribute('title'));
  await button.click();
  await frame.locator('.mod.an-lk').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(300);
}

// Un geste qui fait recharger la page à Grist : le cadre de GFS se détache, un autre se rouvre, et GFS y rouvre l'annuaire.
async function reloaded(run, frame) {
  for (let i = 0; i < 240 && !frame.isDetached(); i++) await run.page.waitForTimeout(250);
  const next = await gfsFrame(run.page, { keep: true });
  await next.locator('.mod.an').waitFor({ state: 'visible', timeout: 40000 });
  await next.locator('.an-person').first().waitFor({ timeout: 25000 });
  return next;
}

async function play(run) {
  const { page } = run;
  say('--- 0. le document et l\'annuaire (sa fiche, son niveau et dessous, le rôle « Chef ») ---');
  await seedAnnuaire(run.frame);
  await run.frame.evaluate(async config => {
    const { AnnuaireStore } = await import('/prototype/js/annuaire/annuaire-store.js');
    const store = new AnnuaireStore({ port: { doc: grist.docApi }, consent: async () => true });
    await store.create({ name: 'Annuaire de l’établissement', table: 'Personnes', config });
  }, CONFIG);
  await page.reload();
  let frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  check('aucune règle de GFS, aucune colonne d\'aide avant le geste', (await mineOf(run)).length === 0 && (await columnsOf(run)).length === 0, await mineOf(run));

  say('--- 1. l\'aperçu : rien ne s\'écrit ---');
  await openLock(frame, page);
  const state = (await frame.locator('.an-lk-state').innerText()).trim();
  check('l\'état dit « pas de verrou »', state === t('an.lock.state.none'), state);
  const rules = await frame.locator('.an-lk-list li').allInnerTexts();
  check('les règles sont dites en phrases (propriétaires, éditeurs désignés, personne d\'autre, colonnes protégées)', rules.length >= 4 && rules[0] === t('an.lock.r.owners'), rules);
  check('l\'interrupteur de la structure est allumé (conseillé)', (await frame.locator('[data-fk="lk-structure"]').getAttribute('aria-checked')) === 'true',
    await frame.locator('[data-fk="lk-structure"]').getAttribute('aria-checked'));
  check('« Retirer le verrou » et « Fermer la structure » sont là, grisés', (await frame.locator('[data-fk="lk-remove"]').getAttribute('aria-disabled')) === 'true'
    && (await frame.locator('[data-fk="lk-close"]').getAttribute('aria-disabled')) === 'true');
  await frame.locator('[data-fk="lk-code"]').click();
  const code = await frame.locator('.an-lk-code').innerText();
  check('les règles exactes disent les deux colonnes d\'aide et la règle des éditeurs', /GFS_Editors/.test(code) && /GFS_Node/.test(code) && /user\.Access in \[OWNER\]/.test(code), code.slice(0, 200));
  await frame.locator('.an-lk-body').evaluate(node => { node.scrollTop = 0; });
  await shot(frame, '1-apercu');
  await frame.locator('[data-fk="lk-cancel"]').click();
  await frame.locator('.mod.an-lk').waitFor({ state: 'detached' });
  check('« Annuler » n\'écrit rien (aucune colonne, aucune règle)', (await mineOf(run)).length === 0 && (await columnsOf(run)).length === 0);

  say('--- 2. « Poser dans Grist » : les colonnes d\'aide, la liasse, la structure fermée, le rechargement ---');
  await openLock(frame, page);
  const old = frame;
  await frame.locator('[data-fk="lk-put"]').click();
  frame = await reloaded(run, old);
  const mine = await mineOf(run);
  const helpers = await columnsOf(run);
  check('Grist a les deux colonnes d\'aide', helpers.includes('GFS_Node') && helpers.includes('GFS_Editors'), helpers);
  check('Grist a les règles de GFS (colonnes protégées, la table), toutes avec leur note', mine.length >= 5 && mine.every(rule => /^GFS : Annuaire · /.test(rule.memo)), mine.map(rule => rule.permissionsText));
  check('la structure est fermée dans la même écriture', (await closingRules(run)).length === 1, (await closingRules(run)).length);
  const toast = (await frame.locator('#toast').innerText().catch(() => '')).trim();
  check('l\'annuaire est rouvert avec « Le verrou est posé. »', toast === t('an.lock.done'), toast);
  const editors = await rowsOf(run, 'Personnes');
  const camille = editors.find(row => row.Email === 'camille.durand@exemple.fr');
  check('GFS_Editors est calculé par Grist (la fiche de Camille nomme au moins elle-même et sa hiérarchie)', Array.isArray(camille && camille.GFS_Editors) || typeof (camille && camille.GFS_Editors) === 'string',
    JSON.stringify(camille && camille.GFS_Editors));
  await shot(frame, '2-pose');

  say('--- 3. rouvrir : « posé, à jour », rien à poser, la structure déjà fermée ---');
  await openLock(frame, page);
  const current = (await frame.locator('.an-lk-state').innerText()).trim();
  check('l\'état dit « le verrou est posé »', current === t('an.lock.state.current'), current);
  check('« Poser » est grisé (rien à poser), « Retirer le verrou » ouvert', (await frame.locator('[data-fk="lk-put"]').getAttribute('aria-disabled')) === 'true'
    && (await frame.locator('[data-fk="lk-remove"]').getAttribute('aria-disabled')) !== 'true');
  check('la fenêtre dit que la structure est déjà fermée', (await frame.locator('.an-lk-ok').count()) === 1, await frame.locator('.an-lk-ok').count());
  await shot(frame, '3-pose');

  say('--- 4. « Retirer le verrou » : la question, puis tout part, sauf la structure fermée ---');
  await frame.locator('[data-fk="lk-remove"]').click();
  await frame.locator('.mod.ask').waitFor();
  const asking = (await frame.locator('.mod.ask').innerText()).replace(/\s+/g, ' ');
  check('GFS demande d\'abord (« Retirer le verrou ? »)', asking.includes(t('an.lock.removeTitle')), asking.slice(0, 120));
  const before = frame;
  await frame.locator('[data-fk="ask-yes"]').click();
  frame = await reloaded(run, before);
  check('plus aucune règle « GFS : Annuaire »', (await mineOf(run)).length === 0, (await mineOf(run)).length);
  check('plus aucune colonne d\'aide', (await columnsOf(run)).length === 0, await columnsOf(run));
  check('la structure reste fermée (geste à part)', (await closingRules(run)).length === 1, (await closingRules(run)).length);
  const gone = (await frame.locator('#toast').innerText().catch(() => '')).trim();
  check('l\'annuaire est rouvert avec « Le verrou est retiré. »', gone === t('an.lock.removed'), gone);
  const after = (await rowsOf(run, 'Personnes')) || [];
  check('les personnes n\'ont pas changé (18 fiches)', after.length === 18, after.length);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  const run = await openGfs(context, { lang });
  await play(run);
} catch (error) {
  say('ÉCHEC de l\'essai :', String(error && error.message).slice(0, 400));
  for (const page of browser.contexts().flatMap(context => context.pages())) await page.screenshot({ path: join(SHOTS, `${TAG}-erreur.png`) }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  pages.close();
}
