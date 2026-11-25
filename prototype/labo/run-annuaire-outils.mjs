// « À vérifier », « Écrire au groupe », « Ma présence » et l'onglet « Options » du module Annuaire (demande du porteur du 25/11), dans un VRAI serveur Grist (l'image officielle,
// `bash vrai-serveur.sh`), à 700 × 400, à la vraie souris et au vrai clavier. « À vérifier » est réservé aux propriétaires du document : GFS les reconnaît par l'API REST du serveur
// (`isOwner`), que grist-static n'a pas. Le document est celui de run-annuaire.mjs, plus deux colonnes (une date de départ, un oui/non « fiche masquée ») et de quoi faire parler les
// contrôles : un doublon, une adresse manquante, une personne sans rattachement, un responsable qui n'existe pas, un départ dépassé, une fiche masquée, quarante-cinq agents aux
// adresses longues. On mesure :
// 1. ce qu'un vrai Grist rend d'un oui/non (jamais de case vide : « non » partout), d'une date vide et d'une référence qui ne pointe plus rien ;
// 2. la pastille de la barre et la fenêtre « À vérifier » (ses comptes, « Comparer », « Masquer » : UNE case change, rien d'autre) ;
// 3. « Écrire au groupe » (la jauge, les messages, le CSV, le presse-papiers) ; rien ne s'écrit dans le document ;
// 4. « Ma présence » : l'interrupteur de la fiche change UNE case de la table des personnes ; la personne masquée se retrouve grisée ;
// 5. l'onglet « Options » : « Enregistrer » ne réécrit que la ligne de l'annuaire (`GFS_Annuaires`), jamais une colonne absente.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-annuaire-outils.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
import { createServer } from 'node:http';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { chromium, say, check, contrastAudit, SHOTS } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { seedAnnuaire } from './jeu-annuaire.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const TAG = `annuaire-outils-${lang}-${scheme}`;

// Le document des mesures : les deux colonnes, puis les personnes qui font parler les contrôles (45 agents aux adresses longues : de quoi dépasser le lien d'un message).
const OUTILS = {
  columns: [['AddColumn', 'Personnes', 'Depart', { type: 'Date', isFormula: false }], ['AddColumn', 'Personnes', 'Masquee', { type: 'Bool', isFormula: false }]],
  config: {
    v: 1, name: 'Nom', title: 'Poste', email: 'Email', phone: 'Tel', lead: 'Chef', manager: 'Responsable', relations: [], columns: ['email'],
    levels: [{ label: 'Pôle', path: ['Structure', 'Pole'] }, { label: 'Direction', path: ['Structure', 'Direction'] }, { label: 'Service', path: ['Service'] }],
    fields: [{ col: 'Contrat', filter: true }, { col: 'Teletravail', filter: true }],
    checks: ['dup', 'mail', 'att', 'resp', 'dep'], leave: 'Depart', presence: { on: true, col: 'Masquee' }, mail: { per: 40, to: 'bcc' },
  },
};

const shot = async (frame, name) => (await frame.frameElement()).screenshot({ path: join(SHOTS, `${TAG}-${name}.png`) });
const inside = async (page, frame, locator) => {
  const box = await locator.boundingBox();
  const panel = await (await frame.frameElement()).boundingBox();
  return Boolean(box) && box.x >= panel.x - 1 && box.y >= panel.y - 1 && box.x + box.width <= panel.x + panel.width + 1 && box.y + box.height <= panel.y + panel.height + 1;
};

// Ce que le serveur retient des tables qui comptent : de quoi dire, après un geste, ce qui a changé et rien d'autre.
const snap = async rest => ({ people: await rest.rows('Personnes'), annuaires: await rest.rows('GFS_Annuaires'), tables: await rest.tables(), columns: await rest.columns('Personnes') });
const changes = (a, b) => {
  const out = [];
  for (const row of b.people) {
    const before = a.people.find(each => each.id === row.id);
    if (!before) { out.push(`+${row.Nom}`); continue; }
    for (const key of Object.keys(row)) if (JSON.stringify(row[key]) !== JSON.stringify(before[key])) out.push(`${row.Nom}.${key}=${JSON.stringify(row[key])}`);
  }
  if (a.people.length !== b.people.length) out.push(`${b.people.length - a.people.length} lignes de plus`);
  if (JSON.stringify(a.tables) !== JSON.stringify(b.tables)) out.push('tables changées');
  if (JSON.stringify(a.columns) !== JSON.stringify(b.columns)) out.push('colonnes changées');
  if (JSON.stringify(a.annuaires) !== JSON.stringify(b.annuaires)) out.push('annuaires changés');
  return out;
};

async function seed(run) {
  const { frame } = run;
  await seedAnnuaire(frame);
  const info = await frame.evaluate(async seed => {
    const api = grist.docApi;
    await api.applyUserActions(seed.columns);
    const day = iso => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000);
    const people = [
      ['Louis Girard', 'Directeur du numérique (doublon)', 'l.girard@exemple.fr', 6, 0, null, false],
      ['Paul Sansmail', 'Agent', '', 1, 0, null, false],
      ['Nora Seule', 'Agente', 'nora.seule@exemple.fr', 0, 0, null, false],
      ['Éric Perdu', 'Agent', 'eric.perdu@exemple.fr', 4, 999, null, false],
      ['Rémi Parti', 'Agent', 'remi.parti@exemple.fr', 4, 0, day('2025-06-30'), false],
      ['Sacha Caché', 'Archiviste', 'sacha.cache@exemple.fr', 4, 0, null, true],
      ...Array.from({ length: 45 }, (_, i) => [`Agent Essai ${String(i + 1).padStart(2, '0')}`, 'Agent', `agent.essai.${String(i + 1).padStart(2, '0')}@universite-exemple.fr`, 4, 0, null, false]),
    ];
    const blank = await api.fetchTable('Personnes');
    await api.applyUserActions([['BulkAddRecord', 'Personnes', people.map(() => null), {
      Nom: people.map(row => row[0]), Poste: people.map(row => row[1]), Email: people.map(row => row[2]), Structure: people.map(row => row[3]), Responsable: people.map(row => row[4]),
      Depart: people.map(row => row[5]), Masquee: people.map(row => row[6]) }]]);
    const { AnnuaireStore } = await import('/prototype/js/annuaire/annuaire-store.js');
    const store = new AnnuaireStore({ port: { doc: api }, consent: async () => true });
    await store.create({ name: 'Annuaire de l’établissement', table: 'Personnes', config: seed.config });
    return { oldMasquee: [...new Set(blank.Masquee)], oldDepart: [...new Set(blank.Depart)] };
  }, OUTILS);
  const rows = await run.rest.rows('Personnes');
  const girard = rows.filter(row => row.Nom === 'Louis Girard');
  check('un vrai Grist rend un oui/non à « non » partout (jamais de case vide) : seule la fiche masquée est cochée', info.oldMasquee.length === 1 && info.oldMasquee[0] === false
    && rows.filter(row => row.Masquee === true).length === 1 && rows.filter(row => row.Masquee === false).length === rows.length - 1, info);
  check('une date de départ jamais écrite est vide (null) ; une date écrite est un nombre de secondes', info.oldDepart.length === 1 && info.oldDepart[0] === null
    && rows.find(row => row.Nom === 'Rémi Parti').Depart === Math.floor(Date.parse('2025-06-30T00:00:00Z') / 1000), info.oldDepart);
  check('une référence vers une ligne qui n’existe pas garde son numéro', rows.find(row => row.Nom === 'Éric Perdu').Responsable === 999);
  check('le doublon est bien deux lignes de même nom', girard.length === 2, girard.length);
}

async function openAnnuaire(run) {
  const { frame } = run;
  await frame.locator('.ex-title-row button', { has: frame.locator('use[href="#i-annuaire"]') }).click();
  await frame.locator('.mod.an').waitFor({ state: 'visible' });
  await frame.locator('.an-person').first().waitFor({ timeout: 20000 });
  await run.page.waitForTimeout(300);
}

// 2. La pastille et « À vérifier ».
async function playCheck(run) {
  const { page, frame, rest } = run;
  say('--- 2. la pastille et « À vérifier » ---');
  const badge = frame.locator('[data-fk="check"] .an-chk-n');
  check('la pastille de la barre compte six points : un doublon, une adresse manquante, deux sans rattachement, un responsable introuvable, un départ dépassé',
    (await badge.count()) === 1 && (await badge.innerText()) === '6', (await badge.count()) ? await badge.innerText() : `aucune pastille (« ${await frame.locator('[data-fk="check"]').getAttribute('title')} »)`);
  await shot(frame, '1-liste');
  await frame.locator('[data-fk="check"]').click();
  const win = frame.locator('.mod.an-chk');
  await win.waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  check('« À vérifier » tient dans la page de 700 × 400', await inside(page, frame, win), await win.boundingBox());
  const counts = (await win.locator('.an-chk-k').evaluateAll(buttons => buttons.map(button => `${button.dataset.kind}=${button.querySelector('.an-pill').textContent}`))).join(' ');
  check('les contrôles comptent : tout 6, doublon 1, e-mail 1, rattachement 2, responsable 1, départ 1', counts === 'all=6 dup=1 mail=1 att=2 resp=1 dep=1', counts);
  await shot(frame, '2-a-verifier');
  await win.locator('[data-fk^="chk-compare:"]').click();
  await page.waitForTimeout(300);
  check('« Comparer » met les deux fiches du doublon côte à côte ; ce qui diffère porte son mot', (await win.locator('.an-chk-cmp thead th').count()) === 3 && (await win.locator('.an-chk-cmp tr.is-diff').count()) >= 1,
    await win.locator('.an-chk-cmp').innerText());
  await shot(frame, '3-comparer');
  await win.locator('[data-fk="ck:dep"]').click();
  await page.waitForTimeout(300);
  const before = await snap(rest);
  await win.locator('[data-fk^="chk-hide:"]').click();
  await page.waitForTimeout(1500);
  const after = await snap(rest);
  const done = changes(before, after);
  check('« Masquer » ne change qu’une case : celle de Rémi Parti, cochée', done.length === 1 && done[0] === 'Rémi Parti.Masquee=true', done);
  check('le point a disparu du compte (cinq restent) et le pied le dit', (await win.locator('.an-chk-k').first().innerText()).includes('5'), await win.locator('.mod-note').innerText());
  await win.locator('[data-fk="chk-close"]').click();
  await win.waitFor({ state: 'detached' });
}

// 3. « Écrire au groupe ».
async function playMail(run) {
  const { page, frame, rest } = run;
  say('--- 3. « Écrire au groupe » ---');
  const before = await snap(rest);
  await frame.locator('[data-fk="mail"]').click();
  const win = frame.locator('.mod.an-mail');
  await win.waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  check('« Écrire au groupe » tient dans la page de 700 × 400', await inside(page, frame, win), await win.boundingBox());
  check('la jauge dit « trop long » (68 adresses), l’option « un seul message » est grisée et sans lien', (await win.locator('.an-mbar-b').getAttribute('data-over')) === 'true'
    && (await win.locator('[data-fk="mail-single"]').getAttribute('aria-disabled')) === 'true' && (await win.locator('a[data-fk="mail-single"]').count()) === 0, await win.locator('.an-mbar').innerText());
  const href = await win.locator('a[data-fk="mail-b:0"]').getAttribute('href');
  check('le premier message est un lien « mailto: » en Cci de quarante adresses au plus, sous 1 800 caractères', /^mailto:\?bcc=/.test(href) && href.split(',').length <= 40 && href.length <= 1800, href.length);
  check('le second message est grisé tant que le premier n’est pas ouvert', (await win.locator('[data-fk="mail-b:1"]').getAttribute('aria-disabled')) === 'true');
  await shot(frame, '4-ecrire');
  await frame.evaluate(() => { window.__mailtoSeen = []; document.addEventListener('click', event => { const link = event.target.closest && event.target.closest('a[href^="mailto:"]'); if (link) { window.__mailtoSeen.push(link.href); event.preventDefault(); } }, true); });
  await win.locator('a[data-fk="mail-b:0"]').click();
  await page.waitForTimeout(500);
  check('le clic suit le lien du premier message ; le second se dégrise', (await frame.evaluate(() => window.__mailtoSeen.length)) === 1 && (await win.locator('a[data-fk="mail-b:1"]').count()) === 1);
  await win.locator('[data-fk="mail-copy"]').click();
  await page.waitForTimeout(600);
  const copied = await frame.evaluate(() => navigator.clipboard.readText().catch(() => null));
  check('« Copier » met les 68 adresses dans le presse-papiers (séparées par « ; »), ou le dit quand le navigateur refuse', copied === null ? (await win.locator('.mod-note').innerText()).length > 0 : copied.split('; ').length === 68,
    copied === null ? await win.locator('.mod-note').innerText() : copied.split('; ').length);
  await page.keyboard.press('Escape');
  await win.waitFor({ state: 'detached' });
  check('« Écrire au groupe » n’a rien écrit dans le document', changes(before, await snap(rest)).length === 0, changes(before, await snap(rest)));
}

// 4. « Ma présence ».
async function playPresence(run) {
  const { page, frame, rest } = run;
  say('--- 4. « Ma présence » ---');
  await frame.locator('.an-search input').click();
  await page.keyboard.type('sacha');
  await page.waitForTimeout(300);
  const row = frame.locator('.an-person', { hasText: 'Sacha Caché' });
  check('la fiche masquée se voit grisée, avec sa pastille, pour un administrateur', (await row.count()) === 1 && (await row.getAttribute('class')).includes('is-masked') && (await row.locator('.an-masked').count()) === 1);
  await row.click();
  await page.waitForTimeout(300);
  const presence = frame.locator('.an-side [data-fk="presence"]');
  check('la fiche offre « Apparaître dans l’annuaire », décoché et actif', (await presence.count()) === 1 && (await presence.getAttribute('aria-checked')) === 'false' && (await presence.getAttribute('aria-disabled')) === null);
  await shot(frame, '5-presence');
  const before = await snap(rest);
  await presence.click();
  await page.waitForTimeout(1500);
  const shown = changes(before, await snap(rest));
  check('l’interrupteur ne change qu’une case : celle de Sacha Caché, décochée', shown.length === 1 && shown[0] === 'Sacha Caché.Masquee=false', shown);
  check('la fiche n’est plus grisée et l’interrupteur est allumé', (await frame.locator('.an-person.is-masked').count()) === 0 && (await frame.locator('.an-side [data-fk="presence"]').getAttribute('aria-checked')) === 'true');
  await frame.locator('.an-side [data-fk="presence"]').click();
  await page.waitForTimeout(1500);
  check('le même interrupteur la masque de nouveau (la case redevient cochée)', changes(before, await snap(rest)).length === 0 && (await frame.locator('.an-person.is-masked').count()) === 1);
  await frame.locator('.an-search input').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
}

// 5. L'onglet « Options ».
async function playOptions(run) {
  const { page, frame, rest } = run;
  say('--- 5. l’onglet « Options » ---');
  await frame.locator('[data-fk="configure"]').click();
  const setup = frame.locator('.mod.an-set');
  await setup.waitFor({ state: 'visible' });
  await setup.locator('[data-fk="tab:options"]').click();
  await page.waitForTimeout(300);
  check('l’onglet « Options » tient dans la page de 700 × 400', await inside(page, frame, setup), await setup.boundingBox());
  check('il montre « Ma présence » allumée avec sa colonne, les cinq contrôles allumés, la colonne de départ', (await setup.locator('[data-fk="op:on"]').getAttribute('aria-checked')) === 'true'
    && (await setup.locator('[data-fk="op:col"]').innerText()) === 'Masquee' && (await setup.locator('[data-fk="op:leave"]').innerText()) === 'Depart'
    && (await setup.locator('.an-ob .an-sw[aria-checked="true"]').count()) === 6, await setup.locator('.an-ob').allInnerTexts());
  await shot(frame, '6-options');
  await setup.locator('[data-fk="om:less"]').click();
  await setup.locator('[data-fk="om:to"]').click();
  await setup.locator('[data-fk="oc:mail"]').click();
  const before = await snap(rest);
  await setup.locator('[data-fk="set-save"]').click();
  await setup.waitFor({ state: 'detached', timeout: 15000 });
  await page.waitForTimeout(1200);
  const after = await snap(rest);
  const done = changes(before, after);
  check('« Enregistrer » ne réécrit que la ligne de l’annuaire : ni table, ni colonne, ni personne ne change', done.length === 1 && done[0] === 'annuaires changés', done);
  const config = JSON.parse(after.annuaires[0].Config);
  check('la définition écrite garde les niveaux et dit les nouvelles options : 35 adresses par message, « À », sans le contrôle e-mail ; la présence et le départ restent',
    config.mail.per === 35 && config.mail.to === 'to' && !config.checks.includes('mail') && config.checks.includes('dup') && config.leave === 'Depart' && config.presence.on
    && config.presence.col === 'Masquee' && config.levels.length === 3, config);
  check('la pastille ne compte plus l’adresse manquante (quatre points)', (await frame.locator('[data-fk="check"] .an-chk-n').innerText()) === '4', await frame.locator('[data-fk="check"] .an-chk-n').innerText());
}

// 6. La lisibilité de ces fenêtres.
async function playContrast(run) {
  const { page, frame } = run;
  say('--- 6. la lisibilité ---');
  for (const [open, selector, what] of [['[data-fk="check"]', '.mod.an-chk', '« À vérifier »'], ['[data-fk="mail"]', '.mod.an-mail', '« Écrire au groupe »']]) {
    await frame.locator(open).click();
    await frame.locator(selector).waitFor({ state: 'visible' });
    const low = await contrastAudit(frame, selector);
    check(`les textes de ${what} se lisent (4,5:1)`, low.failures.length === 0, low.failures.slice(0, 3));
    await page.keyboard.press('Escape');
    await frame.locator(selector).waitFor({ state: 'detached' });
  }
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${PAGE_PORT}` }).catch(() => {});
  const run = await openGfs(context, { lang });
  check('GFS est à 700 × 400 dans le vrai Grist', Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await seed(run);
  await openAnnuaire(run);
  await playCheck(run);
  await playMail(run);
  await playPresence(run);
  await playOptions(run);
  await playContrast(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
void t;
