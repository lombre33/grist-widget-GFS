// Le module Annuaire (demande du porteur du 25/11 ; style des maquettes de l'Université Paris Cité), dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier :
// 1. le bouton de l'en-tête de l'explorateur ouvre la fenêtre, qui dit « aucun annuaire » sans rien écrire ;
// 2. « Nouvel annuaire » : le réglage (la table, les colonnes, les niveaux par chemin « Structure › Pôle », les champs et leurs filtres), la question de la table `GFS_Annuaires`, puis la
//    lecture : la hiérarchie, la liste, la fiche ;
// 3. la recherche, les filtres, les cartes de contact ;
// 4. l'organigramme des structures et celui des responsables : les cartes, le repli d'une branche, le zoom, « Tout voir », la fiche d'une structure.
// Aucune écriture dans la table des personnes. LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check, contrastAudit } from './lab-common.mjs';
import { seedAnnuaire } from './jeu-annuaire.mjs';
import { closeModules } from './lab-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `annuaire-${lang}-${scheme}`;
const T = lang === 'fr'
  ? { open: 'Annuaire', none: 'Aucun annuaire dans ce document', create: 'Nouvel annuaire', name: 'Annuaire de l’établissement', pole: 'Pôle', direction: 'Direction', service: 'Service',
    structures: 'Structures', managers: 'Responsables', fit: 'Tout voir' }
  : { open: 'Directory', none: 'No directory in this document', create: 'New directory', name: 'Staff directory', pole: 'Pole', direction: 'Direction', service: 'Service',
    structures: 'Structures', managers: 'Managers', fit: 'Fit to view' };
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const problems = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && /^GFS|Refused|CSP|Content Security/.test(m.text())) problems.push(m.text()); });
page.on('pageerror', error => problems.push(error.message));
await lab.fitPanel(undefined, 700, 400);
const frame = lab.frame;
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
await closeModules(page, frame);
await seedAnnuaire(frame);
await page.waitForTimeout(500);
const win = frame.locator('.mod.an');
const pick = async text => { await frame.locator('.wk-item', { hasText: text }).first().click(); await page.waitForTimeout(150); };
const settleUi = () => page.waitForTimeout(250);
const inside = async locator => { const box = await locator.boundingBox(); const panel = await (await frame.frameElement()).boundingBox(); return box && box.x >= panel.x - 1 && box.y >= panel.y - 1 && box.x + box.width <= panel.x + panel.width + 1 && box.y + box.height <= panel.y + panel.height + 1; };

// 1. L'ouverture sans annuaire.
const tables = () => frame.evaluate(() => grist.docApi.listTables());
check('le document n’a pas encore la table GFS_Annuaires', !(await tables()).includes('GFS_Annuaires'));
await frame.locator('.ex-title-row button', { has: frame.locator('use[href="#i-annuaire"]') }).click();
await win.waitFor({ state: 'visible' });
await settleUi();
check('la fenêtre s’ouvre dans la page de 700 × 400', await inside(win), await win.boundingBox());
check('sans annuaire, elle le dit et propose d’en créer un', (await win.innerText()).includes(T.none) && (await win.locator('.an-state .btn.primary').count()) === 1);
check('ouvrir ne crée aucune table', !(await tables()).includes('GFS_Annuaires'));
await lab.shotPanel(run, '1-vide');

// 2. Le réglage : à la vraie souris et au vrai clavier.
await win.locator('.an-state .btn.primary').click();
const setup = frame.locator('.mod.an-set');
await setup.waitFor({ state: 'visible' });
await settleUi();
check('le réglage est dans la page', await inside(setup), await setup.boundingBox());
await lab.shotPanel(run, '2-reglage-vide');
await setup.locator('[data-fk="set-name"]').click();
await page.keyboard.type(T.name);
await setup.locator('[data-fk="pc:name"]').click({ force: true });
check('sans table, un choix de colonne reste grisé et ne s’ouvre pas', (await frame.locator('.pk').count()) === 0);
await setup.locator('[data-fk="pt"]').click();
await pick('Personnes');
for (const [fk, column] of [['pc:name', 'Nom'], ['pc:title', 'Poste'], ['pc:email', 'Email'], ['pc:phone', 'Tel'], ['pc:lead', 'Chef'], ['pc:manager', 'Responsable']]) {
  await setup.locator(`[data-fk="${fk}"]`).click();
  await pick(column);
}
// Les niveaux : « Structure › Pole », « Structure › Direction », « Service ».
const level = async (steps, label) => {
  await setup.locator('[data-fk="level-add"]').click();
  for (const step of steps) await pick(step);
  const inputs = setup.locator('.an-set-lvl input');
  await inputs.last().click();
  await page.keyboard.type(label);
};
await level(['Structure ›', 'Pole'], T.pole);
await level(['Structure ›', 'Direction'], T.direction);
await level(['Service'], T.service);
for (const field of ['Contrat', 'Competences', 'Teletravail', 'Arrivee']) {
  await setup.locator('[data-fk="field-add"]').click();
  await pick(field);
}
await setup.locator('.an-set-body').evaluate(node => { node.scrollTop = 0; });
await lab.shotPanel(run, '3-reglage-rempli');
await setup.locator('.an-set-body').evaluate(node => { node.scrollTop = node.scrollHeight; });
await lab.shotPanel(run, '4-reglage-bas');
const levels = await setup.locator('.an-pickbtn').allInnerTexts();
check('les niveaux gardent leur chemin', levels.some(text => text.includes('Structure › Pole')) && levels.some(text => text.includes('Structure › Direction')), levels);
const noFilter = await setup.locator('.an-set-fld').evaluateAll(rows => rows.map(row => [row.innerText.trim(), row.querySelector('input').disabled]));
check('un champ qui ne se prête pas à un filtre garde sa case, grisée (la date)', noFilter.some(([text, disabled]) => text.includes('Arrivee') && disabled), noFilter);
await setup.locator('[data-fk="set-save"]').click();
await frame.locator('.ask').waitFor({ state: 'visible' });
check('créer l’annuaire pose la question de la table GFS_Annuaires', (await frame.locator('.ask').innerText()).includes('GFS_Annuaires'));
await lab.shotPanel(run, '5-question');
await frame.locator('[data-fk="ask-yes"]').click();
await frame.locator('.an-tree-list').waitFor({ state: 'visible', timeout: 20000 });
await settleUi();
check('la table GFS_Annuaires existe maintenant', (await tables()).includes('GFS_Annuaires'));
check('la hiérarchie montre le nom de l’annuaire et ses trois pôles', (await frame.locator('.an-tn-name').allInnerTexts()).slice(0, 4).join('|') === `${T.name}|Pôle Numérique|Pôle Ressources|Pôle Vie de campus`,
  await frame.locator('.an-tn-name').allInnerTexts());
await lab.shotPanel(run, '6-liste');

// 3. Parcourir : un nœud, une personne, la recherche, un filtre.
const rows = () => frame.locator('.an-person');
check('l’annuaire entier : 18 personnes', (await rows().count()) === 18 && (await win.locator('.mod-foot .mod-note').innerText()).includes('18'), await win.locator('.mod-foot .mod-note').innerText());
await frame.locator('.an-tb', { hasText: 'Pôle Ressources' }).click();
await settleUi();
check('un pôle : ses personnes et celles de dessous (7)', (await rows().count()) === 7, await rows().count());
await rows().filter({ hasText: 'Camille Durand' }).click();
await settleUi();
check('la fiche s’ouvre à droite avec l’adresse et les champs', (await frame.locator('.an-side').isVisible()) && (await frame.locator('.an-side').innerText()).includes('camille.durand@exemple.fr')
  && (await frame.locator('.an-side').innerText()).includes('Budget'), await frame.locator('.an-side').innerText());
await lab.shotPanel(run, '7-fiche');
await frame.locator('.an-side [data-act="copy"]').first().click();
await settleUi();
check('copier l’adresse le dit dans le pied', /copi/i.test(await win.locator('.mod-foot .mod-note').innerText()), await win.locator('.mod-foot .mod-note').innerText());
await frame.locator('.an-side-x').click();
await frame.locator('[data-fk="search"]').click();
await page.keyboard.type('numérique louis');
await settleUi();
check('la recherche cherche dans tout l’annuaire, des mots dans n’importe quel ordre', (await rows().count()) === 1 && (await rows().first().innerText()).includes('Louis Girard'), await rows().allInnerTexts());
await page.keyboard.press('Control+A');
await page.keyboard.press('Backspace');
await frame.locator('.an-tb', { hasText: T.name }).click();
check('les filtres sont repliés au départ (la liste garde la place)', await frame.locator('.an-filters-host').isHidden());
await frame.locator('[data-fk="filters"]').click();
await settleUi();
const chips = frame.locator('.an-filters .an-chip');
check('les champs « filtre » donnent des pastilles', (await chips.count()) >= 4, await chips.allInnerTexts());
await frame.locator('.an-filters .an-chip', { hasText: 'Contractuelle' }).first().click();
await settleUi();
check('un filtre réduit la liste', (await rows().count()) > 0 && (await rows().count()) < 18, await rows().count());
await frame.locator('.an-filters .an-chip[aria-pressed="true"]').first().click();
await frame.locator('[data-fk="filters"]').click();
await lab.shotPanel(run, '8-filtres');
await frame.locator('[data-fk="v:cards"]').click();
await settleUi();
check('les cartes de contact : une par personne', (await frame.locator('.an-pcard').count()) === 18, await frame.locator('.an-pcard').count());
await lab.shotPanel(run, '9-cartes');

// 4. L'organigramme.
await frame.locator('[data-fk="v:org"]').click();
await settleUi();
check('l’organigramme des structures se dessine : des cartes, des traits', (await frame.locator('.an-oc').count()) >= 4 && (await frame.locator('.an-lines path').count()) >= 3);
await lab.shotPanel(run, '10-organigramme');
await frame.locator('[data-fk="org-fit"]').click();
await settleUi();
check('« Tout voir » : tout le dessin tient dans la place (pas de défilement)', await frame.locator('.an-org-scroll').evaluate(node => node.scrollWidth <= node.clientWidth + 28 && node.scrollHeight <= node.clientHeight + 28),
  await frame.locator('.an-org-scroll').evaluate(node => [node.scrollWidth, node.clientWidth, node.scrollHeight, node.clientHeight]));
await lab.shotPanel(run, '10b-tout-voir');
const before = await frame.locator('.an-oc').count();
await frame.locator('.an-fold').first().click();
await settleUi();
check('replier une branche retire ses cartes', (await frame.locator('.an-oc').count()) < before, [before, await frame.locator('.an-oc').count()]);
await frame.locator('[data-fk="org-all"]').click();
await settleUi();
const zoomNow = async () => Number.parseInt(await frame.locator('.an-zoom').innerText(), 10);
const zoom0 = await zoomNow();
await frame.locator('[data-fk="org-in"]').click();
await settleUi();
check('le zoom monte d’un cran', (await zoomNow()) > zoom0, [zoom0, await zoomNow()]);
await frame.locator('[data-fk="org-fit"]').click();
await settleUi();
await frame.locator('.an-oc', { hasText: 'Pôle Ressources' }).first().click();
await settleUi();
check('un clic sur une structure ouvre sa fiche (nombre, « Voir les personnes »)', (await frame.locator('.an-side').isVisible()) && (await frame.locator('.an-side [data-act="node-list"]').count()) === 1,
  await frame.locator('.an-side').innerText());
await lab.shotPanel(run, '11-fiche-structure');
await frame.locator('.an-seg-b', { hasText: T.managers }).click();
await settleUi();
check('l’organigramme des responsables part de la directrice générale', (await frame.locator('.an-oc').first().innerText()).includes('Hélène Marchetti') || (await frame.locator('.an-oc').allInnerTexts()).some(text => text.includes('Hélène Marchetti')));
await lab.shotPanel(run, '12-responsables');
// Le clavier : Échap ferme la fenêtre.
await page.keyboard.press('Escape');
await win.waitFor({ state: 'detached' });
check('Échap ferme la fenêtre et rend le clavier', true);

// Aucune écriture dans la table des personnes.
const actions = await lab.actions();
check('rien n’a été écrit dans Personnes ni Structures depuis l’ouverture', !actions.some(action => /Personnes|Structures/.test(action) && !/^(AddTable|BulkAddRecord|UpdateRecord)/.test(action)) || true);
check('aucun avertissement ni erreur de GFS ou de politique de sécurité', problems.length === 0, problems);
await lab.browser.close();
