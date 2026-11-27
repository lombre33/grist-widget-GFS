// « Ajouter des personnes » à un annuaire (module Annuaire ; choix du porteur, 27/11 : « Plusieurs à la suite, un seul ajout »), DEPUIS L'ÉCRAN, dans un VRAI serveur Grist (l'image
// officielle, `bash vrai-serveur.sh`), à 700 × 400, à la vraie souris et au vrai clavier, le propriétaire du document dans le vrai GFS. Ce que Grist fait de l'action
// `BulkAddRecord` (les numéros de ligne neufs, une référence vide à 0, une date en secondes, un oui/non, une colonne laissée à sa valeur par défaut) et la phrase d'un refus (une règle
// d'accès qui interdit de créer) ne se simulent pas : c'est ici. Le faux Grist de test/annuaire-ajout-firefox.mjs mesure le dessin.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-annuaire-ajout-ui.mjs        LAB_LANG=fr|en, LAB_SCHEME=light|dark
import { createServer } from 'node:http';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { chromium, say, check, SHOTS } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { seedAnnuaire } from './jeu-annuaire.mjs';
import { gfsFrame } from './lab-droits.mjs';
import { rowsOf, apply } from './lab-rest.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const TAG = `annuaire-ajout-${lang}-${scheme}`;
const CONFIG = {
  v: 1, name: 'Nom', title: 'Fonction', email: 'Email', phone: 'Tel', manager: 'Responsable', relations: [], columns: ['email'],
  levels: [{ label: 'Pôle', path: ['Structure', 'Pole'] }, { label: 'Direction', path: ['Structure', 'Direction'] }, { label: 'Service', path: ['Service'] }],
  fields: [{ col: 'Contrat', filter: true }, { col: 'Teletravail', filter: true }, { col: 'Arrivee', filter: false }],
};
const KNOWN = ['Hélène Marchetti', 'Emma Rolland', 'Nathan Roussel', 'Camille Durand'];

const shot = async (frame, name) => (await frame.frameElement()).screenshot({ path: join(SHOTS, `${TAG}-${name}.png`) });
const LIGHT_READER_OFF = /la lecture légère des fichiers est éteinte pour cette session/;
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && !LIGHT_READER_OFF.test(problem));
const names = async run => ((await rowsOf(run, 'Personnes')) || []).map(row => row.Nom);

// Ouvre la fenêtre de l'annuaire (le bouton du titre de l'explorateur).
async function openAnnuaire(frame, page) {
  await frame.locator('.ex-title-row button', { has: frame.locator('use[href="#i-annuaire"]') }).click();
  await frame.locator('.mod.an').waitFor({ state: 'visible' });
  await frame.locator('.an-person').first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(400);
}

// Tape dans un champ de la fenêtre (vrai clavier) ; vide d'abord le champ.
async function typeInto(frame, fk, text) {
  const input = frame.locator(`[data-fk="${fk}"]`);
  await input.click();
  await input.press('Control+a');
  await input.pressSequentially(text, { delay: 8 });
}

// Un choix dans la liste avec recherche que le bouton `fk` ouvre.
async function pickFrom(frame, fk, value) {
  await frame.locator(`[data-fk="${fk}"]`).click();
  await frame.locator('.mod.pk').waitFor({ state: 'visible' });
  await frame.locator(`.mod.pk [data-fk="pick-${value}"]`).click();
  await frame.locator('.mod.pk').waitFor({ state: 'detached' });
}

const noteOf = async frame => (await frame.locator('.mod.an-edit .mod-note').innerText()).replace(/\s+/g, ' ').trim();

async function play(run) {
  const { page } = run;
  say('--- 0. le document et l\'annuaire (18 personnes, la fonction est une référence aux postes) ---');
  await seedAnnuaire(run.frame);
  await run.frame.evaluate(async config => {
    const { AnnuaireStore } = await import('/prototype/js/annuaire/annuaire-store.js');
    const store = new AnnuaireStore({ port: { doc: grist.docApi }, consent: async () => true });
    await store.create({ name: 'Annuaire de l’établissement', table: 'Personnes', config });
  }, CONFIG);
  await page.reload();
  let frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  const before = await names(run);
  check('18 personnes avant le geste', before.length === 18, before.length);
  const button = frame.locator('.an-crumb [data-fk="add"]');
  check('le bouton « Ajouter » est ouvert (propriétaire prouvé)', (await button.getAttribute('aria-disabled')) !== 'true', await button.getAttribute('title'));
  await shot(frame, '0-liste');

  say('--- 1. la fenêtre : la fiche vide, plusieurs fiches à la suite ---');
  await button.click();
  await frame.locator('.mod.an-edit').waitFor({ state: 'visible' });
  check('le titre dit « Ajouter des personnes » et l\'annuaire est nommé', (await frame.locator('.mod.an-edit h2').innerText()) === t('an.add.title')
    && (await frame.locator('.an-ed-who').innerText()) === 'Annuaire de l’établissement');
  check('le pied demande un nom, la relecture est grisée', (await noteOf(frame)) === t('an.add.nothing') && (await frame.locator('[data-fk="ed-next"]').getAttribute('aria-disabled')) === 'true');
  await shot(frame, '1-vide');
  await typeInto(frame, 'ef:name', 'Mireille Vasseur');
  await pickFrom(frame, 'ef:title', 5);
  await typeInto(frame, 'ef:email', 'mireille.vasseur@exemple.fr');
  await typeInto(frame, 'ef:phone', '01 02 03 04 77');
  await pickFrom(frame, 'ef:Contrat', 'Titulaire');
  await frame.locator('[data-fk="ef:Teletravail"]').click();
  await pickFrom(frame, 'ef:manager', 3);
  await frame.locator('[data-fk="ef:Arrivee"]').fill('2026-12-01');
  await frame.locator('[data-fk="ed-draft-add"]').click();
  await typeInto(frame, 'ef:name', 'Octave Lenoir');
  await typeInto(frame, 'ef:email', 'octave.lenoir@exemple.fr');
  await frame.locator('[data-fk="ed-draft-add"]').click();
  await typeInto(frame, 'ef:name', 'Zéphyrine Test');
  await typeInto(frame, 'ef:email', 'camille.durand@exemple.fr');
  const pills = await frame.locator('.an-ed-draft-b').allInnerTexts();
  check('trois pastilles, qui portent les noms saisis', JSON.stringify(pills) === JSON.stringify(['Mireille Vasseur', 'Octave Lenoir', 'Zéphyrine Test']), pills);
  check('le pied compte trois personnes prêtes', (await noteOf(frame)) === t('an.add.count', { n: 3 }), await noteOf(frame));
  await shot(frame, '2-trois');

  say('--- 2. une adresse déjà dans l\'annuaire : on ne relit pas, la fiche en cause s\'ouvre ---');
  await frame.locator('[data-fk="ed-next"]').click();
  const said = t('an.add.dupEmailDir', { email: 'camille.durand@exemple.fr', name: 'Camille Durand' });
  check('le pied dit à qui est l\'adresse', (await noteOf(frame)) === said, await noteOf(frame));
  check('la fiche en cause est ouverte et son champ marqué', (await frame.locator('.an-ed-draft.is-current .an-ed-draft-b').innerText()) === 'Zéphyrine Test'
    && (await frame.locator('[data-fk="ef:email"]').getAttribute('aria-invalid')) === 'true');
  check('rien n\'est écrit', (await names(run)).length === 18);
  await frame.locator('[data-fk="ed-draft-x:2"]').click();
  check('la croix retire la fiche : deux pastilles', (await frame.locator('.an-ed-draft').count()) === 2, await frame.locator('.an-ed-draft').count());

  say('--- 3. la relecture, puis un seul ajout ---');
  await frame.locator('[data-fk="ed-next"]').click();
  const cards = await frame.locator('.an-ed-new h3').allInnerTexts();
  check('la relecture montre deux cartes', JSON.stringify(cards) === JSON.stringify(['Mireille Vasseur', 'Octave Lenoir']), cards);
  const goText = (await frame.locator('[data-fk="ed-next"]').innerText()).trim();
  check('le bouton dit « Ajouter 2 personnes »', goText === t('an.add.go', { n: 2 }), goText);
  await shot(frame, '3-relecture');
  await frame.locator('[data-fk="ed-next"]').click();
  await frame.locator('.mod.an-edit').waitFor({ state: 'detached', timeout: 20000 });
  const after = (await rowsOf(run, 'Personnes')) || [];
  check('Grist a deux lignes de plus (20) et les 18 autres n\'ont pas changé', after.length === 20 && JSON.stringify(after.slice(0, 18).map(row => row.Nom)) === JSON.stringify(before), after.length);
  const mireille = after.find(row => row.Nom === 'Mireille Vasseur') || {};
  const octave = after.find(row => row.Nom === 'Octave Lenoir') || {};
  check('Mireille : fonction (une référence), adresse, téléphone, contrat, télétravail, responsable',
    mireille.Fonction === 5 && mireille.Email === 'mireille.vasseur@exemple.fr' && mireille.Tel === '01 02 03 04 77' && mireille.Contrat === 'Titulaire'
    && mireille.Teletravail === true && mireille.Responsable === 3, JSON.stringify(mireille));
  check('Mireille : la date est celle du 1er décembre 2026 (minuit, temps universel)', mireille.Arrivee === Date.UTC(2026, 11, 1) / 1000, mireille.Arrivee);
  check('Octave : le nom et l\'adresse, le reste à la valeur par défaut de Grist (aucune fonction, aucun responsable, pas de télétravail)',
    octave.Email === 'octave.lenoir@exemple.fr' && !octave.Fonction && !octave.Responsable && !octave.Teletravail && !octave.Tel && !octave.Contrat, JSON.stringify(octave));
  check('les deux lignes ont des numéros neufs, à la suite', mireille.id === 19 && octave.id === 20, [mireille.id, octave.id]);
  const toast = (await frame.locator('.an-foot').innerText().catch(() => '')).replace(/\s+/g, ' ');
  check('le pied dit « 2 personnes ajoutées : … »', toast.includes(t('an.add.done', { n: 2, names: 'Mireille Vasseur, Octave Lenoir' })), toast);
  await frame.locator('.an-person').first().waitFor();
  const listed = await frame.locator('.an-person').allInnerTexts();
  check('la liste relue montre les deux personnes', ['Mireille Vasseur', 'Octave Lenoir'].every(name => listed.some(text => text.includes(name))), listed.length);
  check('la fonction de Mireille s\'écrit comme le poste que Grist montre (pas un nom de personne)', listed.some(text => text.includes('Mireille Vasseur') && text.includes('Gestionnaire de marchés · Catégorie B')),
    listed.find(text => text.includes('Mireille')));
  await shot(frame, '4-apres');

  say('--- 4. Grist refuse (une règle d\'accès interdit de créer) : sa phrase est dite, la fenêtre reste, rien n\'est écrit ---');
  const rule = await apply(run, [['AddRecord', '_grist_ACLResources', -1, { tableId: 'Personnes', colIds: '*' }],
    ['AddRecord', '_grist_ACLRules', null, { resource: -1, aclFormula: '', permissionsText: '-C', rulePos: 1, memo: 'essai : personne ne crée' }]]);
  check('la règle d\'essai est posée', rule.status === 200, rule.text);
  await page.reload();
  frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  await frame.locator('.an-crumb [data-fk="add"]').click();
  await frame.locator('.mod.an-edit').waitFor({ state: 'visible' });
  await typeInto(frame, 'ef:name', 'Rejetée Par Grist');
  await frame.locator('[data-fk="ed-next"]').click();
  await frame.locator('[data-fk="ed-next"]').click();
  await page.waitForTimeout(1500);
  const refusal = await noteOf(frame);
  say('  la phrase que Grist a donnée :', refusal);
  check('la fenêtre est toujours là, le refus est dit (« Grist n\'a pas ajouté les personnes : … »)', refusal.startsWith(t('an.add.refused', { reason: '' }).trim().slice(0, 20)) && refusal.length > 40
    && (await frame.locator('.mod.an-edit .mod-note.is-warn').count()) === 1, refusal);
  check('on peut réessayer (le bouton n\'est pas grisé)', (await frame.locator('[data-fk="ed-next"]').getAttribute('aria-disabled')) !== 'true');
  check('rien n\'est écrit', (await names(run)).length === 20);
  await shot(frame, '5-refus');
  await frame.locator('[data-fk="ed-cancel"]').click();
  await frame.locator('[data-fk="ed-cancel"]').click();
  await frame.locator('.mod.an-edit').waitFor({ state: 'detached' });
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
