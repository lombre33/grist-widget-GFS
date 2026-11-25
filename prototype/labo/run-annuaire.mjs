// Le module Annuaire (demande du porteur du 25/11 ; style des maquettes de l'Université Paris Cité), dans un vrai Grist, à 700 × 400, à la vraie souris et au vrai clavier :
// 1. le bouton de l'en-tête de l'explorateur ouvre la fenêtre, qui dit « aucun annuaire » sans rien écrire ;
// 2. « Nouvel annuaire » : le réglage en quatre onglets (Personnes : nom et adresse par défaut, les écritures du nom ; Hiérarchie : l'option, les niveaux créés par leur nom, leur place puis leur
//    colonne, suivie pas à pas (avec retour arrière) ou trouvée d'un coup dans la table liée (« Structure › Direction »), avec ses exemples en direct ; Relations : le responsable direct,
//    l'assistant·e, le référent·e ; Champs de la fiche : les champs, un chemin dans une table liée, une colonne créée (le seul geste qui écrit dans le document, avec l'accord de la
//    personne) et leurs interrupteurs Liste / Filtre), la question de la table `GFS_Annuaires`, puis la lecture : la hiérarchie, la liste, la fiche en sections, les relations ;
// 3. la recherche, les filtres, les cartes de contact ;
// 4. l'organigramme des structures et celui des responsables : les cartes, le repli d'une branche, le zoom, « Tout voir », la fiche d'une structure.
// Seule la colonne créée à la demande s'écrit dans la table des personnes. LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check, contrastAudit } from './lab-common.mjs';
import { seedAnnuaire } from './jeu-annuaire.mjs';
import { closeModules } from './lab-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `annuaire-${lang}-${scheme}`;
const T = lang === 'fr'
  ? { open: 'Annuaire', none: 'Aucun annuaire dans ce document', create: 'Nouvel annuaire', name: 'Annuaire de l’établissement', pole: 'Pôle', direction: 'Direction', service: 'Service',
    structures: 'Structures', managers: 'Responsables', fit: 'Tout voir', assistant: 'Assistant·e', referent: 'Référent·e', contact: 'Coordonnées', attach: 'Rattachement', info: 'Informations',
    column: 'Colonne', mail: 'E-mail', yes: 'Oui', no: 'Non' }
  : { open: 'Directory', none: 'No directory in this document', create: 'New directory', name: 'Staff directory', pole: 'Pole', direction: 'Direction', service: 'Service',
    structures: 'Structures', managers: 'Managers', fit: 'Fit to view', assistant: 'Assistant', referent: 'Referent', contact: 'Contact', attach: 'Placement', info: 'Details', column: 'Column', mail: 'Email', yes: 'Yes', no: 'No' };
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
await lab.forgetActions(); // à partir d'ici, ce que le moteur reçoit est ce que le module écrit
const win = frame.locator('.mod.an');
// Une ligne de la liste : par sa clé (« use:Poste », « deep:Structure › Direction ») ; les lignes montrent aussi des exemples (« Cheffe du service »), un texte seul se tromperait de ligne.
const pick = async text => {
  const exact = frame.locator(`[data-fk="${text.includes(' › ') ? 'pick-deep:' : 'pick-use:'}${text}"]`);
  await ((await exact.count()) ? exact : frame.locator('.wk-item', { hasText: text })).first().click();
  await page.waitForTimeout(150);
};
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
// Onglet « Personnes » : par défaut le nom et l'adresse seulement ; le téléphone et le prénom se demandent.
await setup.locator('[data-fk="set-name"]').click();
await page.keyboard.type(T.name);
await setup.locator('[data-fk="pc:name"]').click({ force: true });
check('sans table, un choix de colonne reste grisé et ne s’ouvre pas', (await frame.locator('.pk').count()) === 0);
await setup.locator('[data-fk="pt"]').click();
await pick('Personnes');
await setup.locator('[data-fk="pc:name"]').click();
await pick('Nom');
await setup.locator('[data-fk="pc:email"]').click();
await pick('Email');
check('par défaut : le nom et l’adresse seulement (ni prénom ni téléphone ni poste)', (await setup.locator('[data-fk="pc:first"], [data-fk="pc:phone"], [data-fk="pc:title"]').count()) === 0);
await setup.locator('[data-fk="toggle-split"]').click();
check('« séparer le nom et le prénom » déplie le prénom, les trois écritures du nom, les capitales et l’aperçu', (await setup.locator('[data-fk="pc:first"]').count()) === 1
  && (await setup.locator('.an-seg-b').count()) === 3 && (await setup.locator('[data-fk="upper-toggle"]').count()) === 1 && (await setup.locator('[data-fk="name-example"]').count()) === 1);
await setup.locator('[data-fk="order:last-comma"]').click();
await setup.locator('[data-fk="upper-toggle"]').click();
check('l’aperçu suit l’écriture choisie (« DURAND, Camille » avant que le prénom ait sa colonne)', (await setup.locator('[data-fk="name-example"]').innerText()).includes('DURAND, Camille'),
  await setup.locator('[data-fk="name-example"]').innerText());
await lab.shotPanel(run, '3a2-ecriture-du-nom');
await setup.locator('[data-fk="toggle-split"]').click();
check('refermer le volet oublie le prénom', (await setup.locator('[data-fk="pc:first"]').count()) === 0);
await setup.locator('[data-fk="add-phone"]').click();
await pick('Tel');
check('le téléphone se demande, puis se lit', (await setup.locator('[data-fk="pc:phone"]').innerText()).includes('Tel'), await setup.locator('[data-fk="pc:phone"]').innerText());
await lab.shotPanel(run, '3a-personnes');
// Onglet « Hiérarchie » : l'option est éteinte, tout est grisé ; elle s'allume, les niveaux se créent (nom, place, colonne).
await setup.locator('[data-fk="tab:hier"]').click();
check('« postes et hiérarchie » est éteinte au départ, ce qu’elle débloque est grisé', (await setup.locator('[data-fk="hier-toggle"]').getAttribute('aria-checked')) === 'false'
  && (await setup.locator('.an-hier-body').getAttribute('inert')) !== null);
await lab.shotPanel(run, '3b-hierarchie-eteinte');
await setup.locator('[data-fk="hier-toggle"]').click();
check('allumée, les niveaux se débloquent et l’onglet réclame un niveau', (await setup.locator('.an-hier-body').getAttribute('inert')) === null && (await setup.locator('.an-tab-dot').count()) === 1);
// Un niveau : d'abord son nom (et sa place), puis sa colonne : suivie pas à pas (avec retour arrière) ou trouvée d'un coup dans la table liée.
const level = async (label, choose) => {
  await setup.locator('[data-fk="level-add"]').click();
  await frame.locator('[data-fk="nl-name"]').waitFor({ state: 'visible' });
  await page.keyboard.type(label);
  await frame.locator('[data-fk="nl-ok"]').click();
  await frame.locator('.mod.pk').waitFor({ state: 'visible' });
  await choose();
};
await level(T.pole, async () => {
  await page.waitForTimeout(700);
  check('le choix de la colonne montre des exemples en direct, tirés d’une fiche de la table', (await frame.locator('.wk-example').innerText()).length > 10 && (await frame.locator('.wk-sample').count()) >= 3,
    [await frame.locator('.wk-example').innerText(), await frame.locator('.wk-sample').allInnerTexts()]);
  check('la création d’une colonne est la première ligne', (await frame.locator('.wk-item').first().getAttribute('data-fk')) === 'pick-new:');
  await lab.shotPanel(run, '3b2-choix-colonne');
  await frame.locator('[data-fk="pick-alt-use:Structure"]').click();
  await settleUi();
  check('suivre « Structure » : le fil dit où l’on est, « Retour » est là', (await frame.locator('.wk-crumb').allInnerTexts()).join('|') === 'Personnes|Structure' && (await frame.locator('[data-fk="pick-back"]').count()) === 1,
    await frame.locator('.wk-crumb').allInnerTexts());
  await lab.shotPanel(run, '3b3-suivre-une-reference');
  await frame.locator('[data-fk="pick-back"]').click();
  await settleUi();
  check('« Retour » revient à la table des personnes', (await frame.locator('.wk-crumb').allInnerTexts()).join('|') === 'Personnes');
  await frame.locator('[data-fk="pick-alt-use:Structure"]').click();
  await settleUi();
  await pick('Pole');
});
await level(T.direction, async () => {
  await page.keyboard.type('direction');
  await settleUi();
  check('la recherche trouve « Structure › Direction » d’un coup, dans la table liée', (await frame.locator('.wk-item', { hasText: 'Structure › Direction' }).count()) === 1,
    await frame.locator('.wk-name').allInnerTexts());
  await lab.shotPanel(run, '3b4-recherche-table-liee');
  await pick('Structure › Direction');
});
await level(T.service, async () => { await pick('Service'); });
check('chaque niveau garde son nom et sa colonne (chemin « Structure › Pole »)', (await setup.locator('.an-lv-path').allInnerTexts()).join('|').includes('Structure')
  && (await setup.locator('.an-lv-name').evaluateAll(nodes => nodes.map(node => node.value))).join('|') === [T.pole, T.direction, T.service].join('|'),
await setup.locator('.an-lv-path').allInnerTexts());
await setup.locator('[data-fk="pc:title"]').click();
await pick('Poste');
await setup.locator('[data-fk="toggle-more"]').click();
await setup.locator('[data-fk="pc:lead"]').click();
await pick('Chef');
await lab.shotPanel(run, '3c-hierarchie');
// Onglet « Relations » : le responsable direct, puis deux modèles prêts (assistant·e, référent·e) : leurs colonnes sont celles qui désignent une personne.
await setup.locator('[data-fk="tab:relations"]').click();
await setup.locator('[data-fk="rt:manager"]').click();
await pick('Responsable');
await setup.locator('[data-fk="rt:assistant"]').click();
check('pour une relation, la liste ne propose que les colonnes qui désignent une personne (pas « Nom », pas « Poste »)', (await frame.locator('.wk-item:not([data-fk="pick-new:"]) .wk-name').allInnerTexts()).sort().join('|') === 'Assistant|Referents',
  await frame.locator('.wk-name').allInnerTexts());
await pick('Assistant');
await setup.locator('[data-fk="rt:referent"]').click();
await pick('Referents');
check('les relations : le responsable direct, l’assistant·e et le référent·e ont chacun leur carte', (await setup.locator('.an-relrow').count()) === 3 && (await setup.locator('.an-tab-dot').count()) === 0,
  await setup.locator('.an-relrow').allInnerTexts());
await lab.shotPanel(run, '4a-relations');
// Une relation sans colonne : « Suppléant·e » demande une colonne de personne, que le module crée (avec l'accord) et que Grist montre par le nom, pas par le numéro.
await setup.locator('[data-fk="rt:substitute"]').click();
await frame.locator('[data-fk="pick-new:"]').click();
await frame.locator('[data-fk="nc-name"]').waitFor({ state: 'visible' });
await page.keyboard.type('Suppleant');
check('une colonne de relation se crée comme une référence à une personne', (await frame.locator('[data-fk="nc-type:Ref:Personnes"]').getAttribute('aria-pressed')) === 'true');
await page.keyboard.press('Enter');
await frame.locator('.mod.an-nl').waitFor({ state: 'detached', timeout: 15000 });
await settleUi();
const shownBy = await frame.evaluate(async () => {
  const meta = await grist.docApi.fetchTable('_grist_Tables_column');
  const tables = await grist.docApi.fetchTable('_grist_Tables');
  const parent = tables.id[tables.tableId.indexOf('Personnes')];
  const at = meta.colId.findIndex((id, i) => id === 'Suppleant' && meta.parentId[i] === parent);
  const nom = meta.id.find((id, i) => meta.colId[i] === 'Nom' && meta.parentId[i] === parent);
  if (at < 0) return null;
  const helper = meta.displayCol[at] ? meta.colId[meta.id.indexOf(meta.displayCol[at])] : '';
  const cells = helper ? (await grist.docApi.fetchTable('Personnes'))[helper] : null;
  return { type: meta.type[at], shownIsName: meta.visibleCol[at] === nom, helper, formula: helper ? meta.formula[meta.id.indexOf(meta.displayCol[at])] : '', cells: cells && cells.length };
});
check('Grist montre le nom de la personne (colonne « Nom » + formule d’affichage), pas son numéro', Boolean(shownBy) && shownBy.type === 'Ref:Personnes' && shownBy.shownIsName
  && /^gristHelper_Display/.test(shownBy.helper) && shownBy.formula === '$Suppleant.Nom', shownBy);
check('la relation « Suppléant·e » a sa carte, sans point orange', (await setup.locator('.an-relrow').count()) === 4 && (await setup.locator('.an-tab-dot').count()) === 0, await setup.locator('.an-relrow').count());
// Onglet « Champs de la fiche » : des colonnes de la table, une colonne de la table liée (« Structure › Niveau ») et une colonne créée.
await setup.locator('[data-fk="tab:fields"]').click();
for (const field of ['Contrat', 'Competences', 'Teletravail', 'Arrivee']) {
  await setup.locator('[data-fk="field-add"]').click();
  await pick(field);
}
await setup.locator('[data-fk="field-add"]').click();
await page.keyboard.type('niveau');
await settleUi();
await pick('Structure › Niveau');
check('un champ peut venir d’une table liée : « Structure › Niveau »', (await setup.locator('.an-frow:not(.is-head) .an-f-name', { hasText: 'Structure › Niveau' }).count()) === 1,
  await setup.locator('.an-f-name').allInnerTexts());
check('avant la création, la colonne « Matricule » n’existe pas dans le document', !(await frame.evaluate(() => grist.docApi.fetchTable('Personnes'))).Matricule);
await setup.locator('[data-fk="field-add"]').click();
await frame.locator('[data-fk="pick-new:"]').click();
await frame.locator('[data-fk="nc-name"]').waitFor({ state: 'visible' });
await page.keyboard.type('Matricule');
await lab.shotPanel(run, '4b-creer-une-colonne');
check('la fenêtre dit ce qui va s’écrire, sans rien avoir écrit encore', (await frame.locator('.an-nl').innerText()).includes('Personnes') && !(await frame.evaluate(() => grist.docApi.fetchTable('Personnes'))).Matricule);
await page.keyboard.press('Enter');
await frame.locator('.mod.an-nl').waitFor({ state: 'detached', timeout: 15000 });
await settleUi();
const made = await frame.evaluate(async () => { const meta = await grist.docApi.fetchTable('_grist_Tables_column'); const at = meta.colId.indexOf('Matricule'); return at < 0 ? null : { type: meta.type[at], id: meta.colId[at] }; });
check('Grist a reçu la colonne « Matricule » (texte), vide', Boolean(made) && made.type === 'Text', made);
check('la colonne créée est un champ de la fiche', (await setup.locator('.an-frow:not(.is-head) .an-f-name', { hasText: 'Matricule' }).count()) === 1);
await lab.shotPanel(run, '4-champs');
// « Colonne » : l'adresse (ligne fixe) et le télétravail (un oui/non) deviennent des colonnes de la liste, comme les filtres se règlent par champ.
check('le tableau des champs a son titre « Colonne », et un interrupteur par champ et pour l’adresse', (await setup.locator('.an-frow.is-head').textContent()).includes(T.column)
  && (await setup.locator('[data-fk^="fk:"]').count()) === 6 && (await setup.locator('[data-fk="fc:email"]').count()) === 1 && (await setup.locator('[data-fk="fc:phone"]').count()) === 1);
await setup.locator('[data-fk="fc:email"]').click();
await setup.locator('[data-fk="fk:2"]').click();
check('« Colonne » s’allume à la souris, sur une ligne fixe et sur un champ', (await setup.locator('[data-fk="fc:email"]').getAttribute('aria-checked')) === 'true'
  && (await setup.locator('[data-fk="fk:2"]').getAttribute('aria-checked')) === 'true' && (await setup.locator('[data-fk="fk:0"]').getAttribute('aria-checked')) === 'false');
const noFilter = await setup.locator('.an-frow:not(.is-head):not(.is-locked)').evaluateAll(rows => rows.map(row => [row.innerText.trim(), row.querySelector('[data-act="fld-filter"]').getAttribute('aria-disabled')]));
check('un champ qui ne se prête pas à un filtre garde son interrupteur, grisé (la date)', noFilter.some(([text, disabled]) => text.includes('Arrivee') && disabled === 'true')
  && noFilter.some(([text, disabled]) => text.includes('Contrat') && disabled !== 'true'), noFilter);
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
const cells = await frame.locator('.an-person').first().locator('.an-pe-col').evaluateAll(nodes => nodes.map(node => [node.dataset.label, node.innerText, getComputedStyle(node, '::before').content]));
check('les colonnes de la liste : l’adresse et le télétravail (« oui » ou « non » en toutes lettres), chacune avec son libellé', cells.length === 2 && cells[0][0] === T.mail && cells[0][1].includes('@')
  && cells[1][0] === 'Teletravail' && [T.yes, T.no].includes(cells[1][1]) && cells.every(cell => cell[2].includes(cell[0])), cells);

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
check('le téléphone de la fiche est un lien d’appel (tel:)', (await frame.locator('.an-side a[href^="tel:"]').first().getAttribute('href')) === 'tel:0102030411');
check('la fiche est en sections : Coordonnées, Rattachement (le découpage hiérarchique), Informations', (await frame.locator('.an-side .an-fs-h').allInnerTexts()).map(text => text.toLowerCase()).join('|') === [T.contact, T.attach, T.info].map(text => text.toLowerCase()).join('|'),
  await frame.locator('.an-side .an-fs-h').allInnerTexts());
check('le rattachement de Camille : Pôle › Direction › Service puis le poste, un cran plus bas chaque fois', (await frame.locator('.an-side .an-hp-v').allInnerTexts()).join('|') === 'Pôle Ressources|Direction des finances|Budget|Cheffe du service Budget',
  await frame.locator('.an-side .an-hp-v').allInnerTexts());
check('la fiche dit ses relations : les référents de Camille ; pas de ligne pour l’assistant·e qu’elle n’a pas', (await frame.locator('.an-side .an-fr', { hasText: T.referent }).innerText()).includes('Emma Rolland')
  && (await frame.locator('.an-side .an-fr', { hasText: T.assistant }).count()) === 0, await frame.locator('.an-side .an-fr dt').allInnerTexts());
await lab.shotPanel(run, '7-fiche');
await frame.locator('.an-side [data-act="copy"]').first().click();
await settleUi();
check('copier l’adresse le dit dans le pied', /copi/i.test(await win.locator('.mod-foot .mod-note').innerText()), await win.locator('.mod-foot .mod-note').innerText());
await frame.locator('.an-side-x').click();
await frame.locator('[data-fk="search"]').click();
await page.keyboard.type('numérique louis');
await settleUi();
check('la recherche cherche dans tout l’annuaire, des mots dans n’importe quel ordre', (await rows().count()) === 1 && (await rows().first().innerText()).includes('Louis Girard'), await rows().allInnerTexts());
const searchFor = async text => { await page.keyboard.press('Control+A'); await page.keyboard.type(text); await settleUi(); return rows().evaluateAll(nodes => nodes.map(node => node.querySelector('.an-pe-name').textContent)); };
check('la recherche trouve aussi un champ de la fiche (« marchés publics ») et un numéro sans ses espaces', (await searchFor('marchés publics')).join('|') === 'Camille Durand|Inès Marchand'
  && (await searchFor('0102030411')).join('|') === 'Camille Durand', await searchFor('marchés publics'));
check('la recherche trouve un niveau de la hiérarchie et un contrat', (await searchFor('contractuelle')).length === 4 && (await searchFor('budget')).includes('Théo Lambert'), await searchFor('contractuelle'));
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
check('déplié jusqu’au niveau le plus bas dès le premier regard (aucune branche repliée, « Budget » est là)', (await frame.locator('.an-fold[aria-expanded="false"]').count()) === 0
  && (await frame.locator('.an-oc', { hasText: 'Budget' }).count()) >= 1 && (await frame.locator('.an-oc.is-person').count()) === 0, await frame.locator('.an-oc .an-oc-title').allInnerTexts());
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
await frame.locator('.an-side-x').click();
await settleUi();
// Les filtres de l'organigramme sont ceux de la liste (niveaux d'abord) ; « Personnes » dessine une petite carte par personne sans clic de plus, et se retient.
await frame.locator('.an-org-tools [data-fk="filters"]').click();
await settleUi();
await frame.locator('.an-filters .an-chip', { hasText: 'Pôle Numérique' }).first().click();
await settleUi();
const structuresDrawn = () => frame.locator('.an-oc:not(.is-person) .an-oc-title').allInnerTexts();
check('un filtre de niveau réduit l’organigramme à sa branche (l’annuaire, le pôle et ses deux directions)', (await structuresDrawn()).length === 4 && (await structuresDrawn()).includes('Pôle Numérique'), await structuresDrawn());
await frame.locator('.an-org-tools [data-fk="org-people"]').click();
await settleUi();
check('« Personnes » dessine les quatre personnes du pôle, une petite carte chacune', (await frame.locator('.an-oc.is-person').count()) === 4
  && (await frame.locator('.an-oc.is-person .an-oc-title').allInnerTexts()).includes('Louis Girard'), await frame.locator('.an-oc.is-person .an-oc-title').allInnerTexts());
check('le choix « Personnes » est retenu sur le navigateur', (await frame.evaluate(() => window.localStorage.getItem('gfs.annuaire.orgPeople'))) === '1');
await lab.shotPanel(run, '10c-organigramme-filtre');
await frame.locator('.an-filters .an-chip[aria-pressed="true"]').first().click();
await frame.locator('.an-org-tools [data-fk="filters"]').click();
await frame.locator('[data-fk="search"]').click();
await page.keyboard.type('camille');
await settleUi();
check('la recherche réduit aussi l’organigramme : la branche de Camille et sa petite carte', (await structuresDrawn()).length === 4 && (await frame.locator('.an-oc.is-person .an-oc-title').allInnerTexts()).join('|') === 'Camille Durand',
  [await structuresDrawn(), await frame.locator('.an-oc.is-person .an-oc-title').allInnerTexts()]);
await frame.locator('.an-seg-b', { hasText: T.managers }).click();
await settleUi();
check('chez les responsables, ceux de Camille sont des cartes estompées, et « Personnes » n’y est pas', (await frame.locator('.an-oc.is-dim').count()) >= 2 && (await frame.locator('.an-org-tools [data-fk="org-people"]').count()) === 0,
  await frame.locator('.an-oc .an-oc-title').allInnerTexts());
await lab.shotPanel(run, '10d-responsables-recherche');
await page.keyboard.press('Control+A');
await page.keyboard.press('Backspace');
await frame.locator('.an-seg-b', { hasText: T.structures }).click();
await frame.locator('.an-org-tools [data-fk="org-people"]').click();
await frame.locator('.an-seg-b', { hasText: T.managers }).click();
await settleUi();
check('l’organigramme des responsables part de la directrice générale', (await frame.locator('.an-oc').first().innerText()).includes('Hélène Marchetti') || (await frame.locator('.an-oc').allInnerTexts()).some(text => text.includes('Hélène Marchetti')));
await lab.shotPanel(run, '12-responsables');
// Le poste suit une colonne d'une table liée (retour du porteur, 25/11 : la référence « Fonction » montre un libellé qui concatène tout, il veut en choisir une autre) : « Fonction › Categorie ».
await win.locator('[data-fk="configure"]').click();
await setup.waitFor({ state: 'visible' });
await settleUi();
await setup.locator('[data-fk="tab:hier"]').click();
await setup.locator('[data-fk="pc:title"]').click();
await frame.locator('[data-fk="pick-alt-use:Fonction"]').click();
await settleUi();
check('la référence « Fonction » se suit : le fil dit Personnes › Fonction, et la liste propose les colonnes des postes', (await frame.locator('.wk-crumb').allInnerTexts()).join('|') === 'Personnes|Fonction'
  && (await frame.locator('[data-fk="pick-use:Categorie"]').count()) === 1 && (await frame.locator('[data-fk="pick-use:Libelle"]').count()) === 1, await frame.locator('.wk-name').allInnerTexts());
await pick('Categorie');
check('le poste dit son chemin « Fonction › Categorie »', (await setup.locator('[data-fk="pc:title"]').innerText()).includes('Fonction › Categorie'), await setup.locator('[data-fk="pc:title"]').innerText());
await setup.locator('[data-fk="set-save"]').click();
await setup.waitFor({ state: 'detached', timeout: 15000 });
await settleUi();
await frame.locator('[data-fk="v:list"]').click();
await settleUi();
check('la liste montre la catégorie choisie comme poste (et non le libellé qui concatène tout)', (await frame.locator('.an-person', { hasText: 'Camille Durand' }).first().locator('.an-pe-sub').innerText()) === 'Catégorie A',
  await frame.locator('.an-person .an-pe-sub').allInnerTexts());
await lab.shotPanel(run, '13-poste-sous-attribut');
// Le clavier : Échap ferme la fenêtre.
await page.keyboard.press('Escape');
await win.waitFor({ state: 'detached' });
check('Échap ferme la fenêtre et rend le clavier', true);

// Ce que le module a écrit : la colonne créée à la demande, la table de ses annuaires et leurs lignes ; rien dans les tables de la personne, ni dans les structures.
const actions = await lab.actions();
check('deux colonnes ajoutées (« Suppleant » et « Matricule », avec l’accord de la personne), la table des annuaires et sa ligne, rien d’autre',
  actions.filter(action => /^AddColumn Personnes/.test(action)).length === 2 && actions.some(action => /^AddTable GFS_Annuaires/.test(action))
  && actions.filter(action => /^SetDisplayFormula Personnes/.test(action)).length === 1
  && !actions.some(action => /^(Update|BulkUpdate|Remove|BulkRemove|AddRecord|BulkAddRecord|RenameColumn|ModifyColumn|RemoveColumn).* (Personnes|Structures)/.test(action))
  && !actions.some(action => / Structures/.test(action)), actions);
check('le changement du poste ne réécrit que la ligne de l’annuaire', actions.filter(action => /^UpdateRecord GFS_Annuaires/.test(action)).length === 1, actions.filter(action => /GFS_Annuaires/.test(action)).map(action => action.slice(0, 60)));
check('aucun avertissement ni erreur de GFS ou de politique de sécurité', problems.length === 0, problems);
await lab.browser.close();
