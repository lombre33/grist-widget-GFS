// GFS garde les PDF (contrats 6.6), joué dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`) : « Nouveau > Importer > PDF » à la vraie souris, la table `GFS_Fichiers` créée avec l'accord
// de la personne, le fichier envoyé par le cadre d'envoi isolé, le nom déjà pris (« Remplacer » / « Garder les deux »), le téléchargement, renommer, ranger, supprimer. Ce que ni grist-static (pas
// d'API REST, pas de pièces jointes) ni un faux Grist ne peuvent dire. Le panneau est à 700 × 400. Chromium seulement : le Firefox de la personne reste à elle.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-pdf.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { miniPdf } from './reel/pj.js';
import { createI18n } from '../js/i18n.js';
import { PAGE_PORT, sha256, openGfs, toast, names, folders, waitForNames, waitForToast, importPdf, shot, rowOf, openRowMenu, pressGreyed, goTo, contrastProblems, windowFits } from './lab-pdf.mjs';

const pdfFile = (name, label) => {
  const buffer = Buffer.from(miniPdf(label));
  return { file: { name, mimeType: 'application/pdf', buffer }, hash: sha256(buffer), size: buffer.length };
};

// ----- 1. Rien dans le document : l'article « PDF » de « Importer », la table qui naît seulement avec l'accord.
async function playFirstImport(run) {
  const { page, frame, rest } = run;
  say('--- 1. le premier PDF ---');
  await frame.getByRole('button', { name: 'Nouveau' }).click();
  await frame.getByRole('menuitem', { name: /^Importer/ }).click();
  const item = frame.locator('.menu-sub').getByRole('menuitem', { name: /^PDF/ });
  check('« Importer » propose le PDF, dégrisé, avec ce que GFS en fait', await item.count() === 1 && await item.getAttribute('aria-disabled') === null && /Gardé par GFS/.test(await item.textContent()));
  await shot(frame, '1-importer');
  await page.keyboard.press('Escape');
  await frame.locator('.menu').first().waitFor({ state: 'detached' }).catch(() => {});

  const first = pdfFile('Facture.pdf', 'facture');
  run.first = first;
  await importPdf(page, frame, first.file);
  await frame.locator('.mod.ask').waitFor();
  check('la table n\'existe pas : GFS demande l\'accord avant tout', /GFS_Fichiers/.test(await frame.locator('#ask-title').textContent()) && !(await rest.tables()).includes('GFS_Fichiers'));
  await shot(frame, '2-accord-table');
  await frame.locator('[data-fk="ask-no"]').click();
  check('refusée : rien n\'est créé ni envoyé, la phrase le dit', /GFS_Fichiers n’a pas été créée/.test(await waitForToast(frame, /pas été créée/)) && !(await rest.tables()).includes('GFS_Fichiers') && (await rest.attachments()).length === 0);

  await importPdf(page, frame, first.file);
  await frame.locator('.mod.ask').waitFor();
  await frame.locator('[data-fk="ask-yes"]').click();
  check('accordée : la ligne apparaît dans l\'explorateur', JSON.stringify(await waitForNames(frame, ['Facture.pdf'])) === '["Facture.pdf"]', await toast(frame));
  await waitForToast(frame, /est dans GFS/);
  await shot(frame, '3-premier-pdf');
}

async function checkFirstStored(run) {
  const { rest } = run;
  const columns = await rest.columns('GFS_Fichiers');
  check('Grist ajoute une page pour la table (le texte de l\'accord le promet)', (await rest.pages()).includes('GFS_Fichiers'), await rest.pages());
  check('la table naît avec ses colonnes et leurs types', JSON.stringify(columns.map(column => [column.id, column.type])) === JSON.stringify([['Identifiant', 'Text'], ['Nom', 'Text'], ['Type', 'Text'], ['Date', 'DateTime:UTC'], ['Auteur', 'Text'], ['Contenu', 'Attachments'], ['Taille', 'Int'], ['Origine', 'Text'], ['SupprimeLe', 'DateTime:UTC'], ['SupprimePar', 'Text']]), columns);
  const rows = await rest.rows('GFS_Fichiers');
  const [row] = rows;
  check('une ligne : nom, type, taille, origine, date du jour, pièce jointe citée', rows.length === 1 && row.Nom === 'Facture.pdf' && row.Type === 'pdf' && row.Taille === run.first.size && row.Origine === 'import' && Math.abs(row.Date - Date.now() / 1000) < 600 && Array.isArray(row.Contenu) && row.Contenu[0] === 'L', row);
  const stored = await rest.attachment(row.Contenu[1]);
  check('le PDF stocké est celui qui a été choisi, octet pour octet (même empreinte, type application/pdf)', stored.status === 200 && stored.hash === run.first.hash && stored.type === 'application/pdf', stored);
  const attachments = await rest.attachments();
  check('la pièce jointe garde le nom du fichier', attachments.length === 1 && attachments[0].name === 'Facture.pdf', attachments);
  const transfer = run.page.frames().find(each => /\/prototype\/transfer\/index\.html/.test(each.url()));
  const traits = transfer ? await transfer.evaluate(() => ({ origin: window.origin })) : null;
  const element = transfer ? await (await transfer.frameElement()).evaluate(node => ({ sandbox: node.getAttribute('sandbox'), hidden: node.hidden })) : null;
  check('le cadre d\'envoi est isolé (sandbox allow-scripts seul, origine opaque) et caché', Boolean(transfer) && traits.origin === 'null' && element.sandbox === 'allow-scripts' && element.hidden === true, [traits, element]);
}

// ----- 2. Un nom déjà pris : la fenêtre, ses trois issues.
async function playConflict(run) {
  const { page, frame, rest } = run;
  say('--- 2. un nom déjà pris ---');
  const second = pdfFile('Facture.pdf', 'facture bis');
  await importPdf(page, frame, second.file);
  await frame.locator('.mod.ask').waitFor();
  const title = await frame.locator('#cf-title').textContent();
  const buttons = await frame.locator('.ask-foot button').allTextContents();
  const focused = await frame.evaluate(() => document.activeElement && document.activeElement.dataset.fk);
  check('la fenêtre dit que le nom est pris, propose « Garder les deux » (au clavier) et « Remplacer »', /déjà pris/.test(title) && JSON.stringify(buttons) === '["Annuler","Remplacer","Garder les deux"]' && focused === 'conflict-both', [title, buttons, focused]);
  check('elle montre le nom de la copie et décrit le fichier existant', /Facture \(1\)\.pdf/.test(await frame.locator('.ask-items').textContent()) && /Modifié/.test(await frame.locator('.ask-note').textContent()));
  await shot(frame, '4-nom-pris');
  await page.keyboard.press('Escape');
  await frame.locator('.mod.ask').waitFor({ state: 'detached' });
  check('Échap : ni envoi ni écriture', (await rest.rows('GFS_Fichiers')).length === 1 && (await rest.attachments()).length === 1 && JSON.stringify(await names(frame)) === '["Facture.pdf"]');

  await importPdf(page, frame, second.file);
  await frame.locator('[data-fk="conflict-both"]').click();
  check('« Garder les deux » : le nouveau s\'appelle « Facture (1).pdf », l\'ancien ne bouge pas', JSON.stringify(await waitForNames(frame, ['Facture (1).pdf', 'Facture.pdf'])) === '["Facture (1).pdf","Facture.pdf"]', await toast(frame));
  const rows = await rest.rows('GFS_Fichiers');
  const copy = rows.find(row => row.Nom === 'Facture (1).pdf');
  const copyStored = copy ? await rest.attachment(copy.Contenu[1]) : null;
  check('la copie porte le contenu du nouveau fichier ; l\'ancien garde le sien', Boolean(copy) && copyStored.hash === second.hash && (await rest.attachment(rows.find(row => row.Nom === 'Facture.pdf').Contenu[1])).hash === run.first.hash);
  check('la phrase dit le nom pris', /gardé sous « Facture \(1\)\.pdf »/.test(await waitForToast(frame, /gardé sous/)));
  run.second = second;
}

async function playReplace(run) {
  const { page, frame, rest } = run;
  const before = await rest.rows('GFS_Fichiers');
  const original = before.find(row => row.Nom === 'Facture.pdf');
  const third = pdfFile('facture.PDF', 'facture remplacée');
  await importPdf(page, frame, third.file);
  await frame.locator('.mod.ask').waitFor();
  check('le nom est pris sans tenir compte de la casse ; « (1) » est pris, la copie proposée prend « (2) » et garde la casse du nouveau nom', /facture \(2\)\.PDF/.test(await frame.locator('.ask-items').textContent()), await frame.locator('.ask-items').textContent());
  await frame.locator('[data-fk="conflict-replace"]').click();
  await waitForToast(frame, /remplacé/);
  const rows = await rest.rows('GFS_Fichiers');
  const replaced = rows.find(row => row.id === original.id);
  check('« Remplacer » : même ligne, même identifiant, même nom ; le contenu est celui du nouveau ; aucune ligne de plus', rows.length === before.length && replaced.Identifiant === original.Identifiant && replaced.Nom === 'Facture.pdf' && (await rest.attachment(replaced.Contenu[1])).hash === third.hash, replaced);
  check('l\'ancienne pièce jointe reste sur le serveur (Grist l\'efface seul au bout de 7 jours)', (await rest.attachments()).length === 3);
  run.third = third;
}

// ----- 3. Télécharger : depuis le lot « Lire » (6c04c02), le geste principal d'un PDF est « Lire », grisé tant que rien ne le lit ; le téléchargement est dans le menu de la ligne.
async function playDownload(run) {
  const { page, frame } = run;
  say('--- 3. télécharger ---');
  const row = rowOf(frame, 'Facture.pdf');
  await row.click();
  const button = frame.locator('.ex-foot .btn').first();
  check('devant un PDF que rien ne lit encore, « Lire » est grisé (jamais masqué) et la barre dit ce qui manque', (await button.textContent()).trim() === 'Lire' && await button.getAttribute('aria-disabled') === 'true' && /Demande l’extension Lecture de PDF/.test(await frame.locator('.ex-info').textContent()), [await button.textContent(), await frame.locator('.ex-info').textContent()]);
  await shot(frame, '5-selection');
  await openRowMenu(frame, 'Facture.pdf');
  const [download] = await Promise.all([page.waitForEvent('download'), frame.getByRole('menuitem', { name: 'Télécharger' }).click()]);
  const bytes = Buffer.from(await (await import('node:fs/promises')).readFile(await download.path()));
  check('« Télécharger », dans le menu de la ligne, rend le PDF sous son nom, octet pour octet', download.suggestedFilename() === 'Facture.pdf' && sha256(bytes) === run.third.hash, [download.suggestedFilename(), bytes.length]);
  await waitForToast(frame, /est téléchargé/);
}

// ----- 4. Le menu d'une ligne, renommer, épingler, déplacer.
const menuItems = frame => frame.locator('.menu .menu-item').evaluateAll(nodes => nodes.map(node => ({ label: node.querySelector('.menu-label').textContent, greyed: node.getAttribute('aria-disabled') === 'true' })));

async function playMenuAndRename(run) {
  const { page, frame, rest } = run;
  say('--- 4. le menu d\'une ligne, renommer ---');
  await openRowMenu(frame, 'Facture.pdf');
  const items = await menuItems(frame);
  check('le menu : Lire (grisé), Télécharger, Épingler, Renommer, Dupliquer (permis : GFS copie le PDF lui-même, lot 3 du 04/11), Déplacer, Mettre à la corbeille (permis, GFS le fait lui-même)', JSON.stringify(items) === JSON.stringify([
    { label: 'Lire', greyed: true }, { label: 'Télécharger', greyed: false }, { label: 'Épingler en favori', greyed: false }, { label: 'Renommer', greyed: false }, { label: 'Dupliquer', greyed: false },
    { label: 'Déplacer vers…', greyed: false }, { label: 'Mettre à la corbeille', greyed: false }]), items);
  await shot(frame, '6-menu-ligne');
  // « Dupliquer » copie le PDF sous un nouvel identifiant, avec la même pièce jointe (rien n'est envoyé) ; la copie est ensuite supprimée pour de bon, pour que la suite de l'essai parte de deux fichiers.
  await frame.getByRole('menuitem', { name: 'Dupliquer' }).click();
  const copies = await waitForNames(frame, ['Facture (1).pdf', 'Facture (2).pdf', 'Facture.pdf']);
  const both = await rest.rows('GFS_Fichiers');
  const source = both.find(row => row.Nom === 'Facture.pdf');
  const made = both.find(row => row.Nom === 'Facture (2).pdf');
  check('« Dupliquer » ajoute « Facture (2).pdf » (le premier nom libre) : un autre identifiant, la même pièce jointe, la même taille et la même origine', JSON.stringify([...copies].sort()) === JSON.stringify(['Facture (1).pdf', 'Facture (2).pdf', 'Facture.pdf'])
    && Boolean(made) && made.Identifiant !== source.Identifiant && JSON.stringify(made.Contenu) === JSON.stringify(source.Contenu) && made.Taille === source.Taille && made.Origine === source.Origine && both.length === 3, [made, source]);
  check('la phrase le dit', /Facture \(2\)\.pdf/.test(await waitForToast(frame, /Facture \(2\)\.pdf/)));
  await rowOf(frame, 'Facture (2).pdf').click();
  await page.keyboard.press('Delete');
  await waitForNames(frame, ['Facture (1).pdf', 'Facture.pdf']);
  await frame.locator('.tr-row[data-view="trash"]').click();
  await rowOf(frame, 'Facture (2).pdf').click();
  await page.keyboard.press('Delete');
  await frame.locator('.mod.ask').waitFor({ state: 'visible', timeout: 8000 });
  await frame.locator('[data-fk="ask-yes"]').click();
  await frame.locator('.mod.ask').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
  await goTo(frame, /^\s*(Moi|Me)\s*$/);
  check('la copie est supprimée pour de bon : deux fichiers, deux lignes', (await rest.rows('GFS_Fichiers')).length === 2 && JSON.stringify(await waitForNames(frame, ['Facture (1).pdf', 'Facture.pdf'])) === '["Facture (1).pdf","Facture.pdf"]');

  await openRowMenu(frame, 'Facture.pdf');
  await frame.getByRole('menuitem', { name: 'Renommer' }).click();
  const input = frame.locator('[data-fk="name-input"]');
  check('renommer propose le nom entier, avec son « .pdf »', await input.inputValue() === 'Facture.pdf');
  await input.fill('Facture (1)');
  await page.keyboard.press('Enter');
  check('un nom déjà pris (le « .pdf » est remis tout seul) est refusé dans la fenêtre, qui reste ouverte', /Un autre fichier de GFS porte déjà ce nom/.test(await frame.locator('.nw-note').textContent()));
  await shot(frame, '7-renommer-refus');
  await input.fill('Devis');
  await page.keyboard.press('Enter');
  check('« Devis » devient « Devis.pdf » : même ligne, même identifiant', JSON.stringify(await waitForNames(frame, ['Devis.pdf', 'Facture (1).pdf'])) === '["Devis.pdf","Facture (1).pdf"]');
  const renamed = (await rest.rows('GFS_Fichiers')).find(row => row.Nom === 'Devis.pdf');
  check('la table le dit, l\'identifiant n\'a pas changé', renamed && renamed.Identifiant === run.firstId, renamed);
}

async function playPin(run) {
  const { frame, rest } = run;
  say('--- 5. épingler, déplacer ---');
  await rowOf(frame, 'Devis.pdf').hover();
  await rowOf(frame, 'Devis.pdf').locator('.rb.pin').click();
  await frame.locator('.mod.ask').waitFor();
  check('épingler demande l\'accord pour la table du rangement de GFS (une seule fois)', /GFS_Rangement/.test(await frame.locator('#ask-title').textContent()));
  await frame.locator('[data-fk="ask-yes"]').click();
  await frame.waitForFunction(() => document.querySelector('.ls-row .rb.pin.on'), null, { timeout: 20000 });
  const lines = (await rest.rows('GFS_Rangement')).filter(row => row.App === 'gfs-fichiers');
  check('le favori est rangé sous « gfs-fichiers » et l\'identifiant du fichier, à la personne que Grist connaît', lines.length === 1 && lines[0].Fichier === run.firstId && lines[0].Favori === true && lines[0].Utilisateur === 'essai@example.com', lines);
  await goTo(frame, /Favoris|Favorites/);
  check('Favoris montre le PDF', JSON.stringify(await waitForNames(frame, ['Devis.pdf'])) === '["Devis.pdf"]');
  await goTo(frame, /^\s*(Moi|Me)\s*$/);

  await openRowMenu(frame, 'Facture (1).pdf');
  await frame.getByRole('menuitem', { name: /^Déplacer/ }).click();
  await frame.locator('[data-fk="move-search"]').fill('Archives');
  await shot(frame, '8-deplacer');
  await frame.locator('.wk-item.is-fresh').click();
  await frame.waitForFunction(() => [...document.querySelectorAll('.ls-row.folder .nm .t')].some(node => node.textContent === 'Archives'), null, { timeout: 20000 });
  check('le PDF part dans un nouveau dossier « Archives » (rangement de la personne)', JSON.stringify(await folders(frame)) === '["Archives"]' && JSON.stringify(await names(frame)) === '["Devis.pdf"]');
  const moved = (await rest.rows('GFS_Rangement')).find(row => row.App === 'gfs-fichiers' && row.Dossier === 'Archives');
  check('la ligne du rangement porte le dossier', Boolean(moved), moved);
}

// ----- 5. Importer dans un dossier ouvert, un gros fichier, supprimer.
async function playFolderAndDelete(run) {
  const { page, frame, rest } = run;
  say('--- 6. un PDF importé dans un dossier ouvert ---');
  await frame.locator('.ls-row.folder').dblclick();
  await frame.waitForFunction(() => document.querySelector('.crumbs .here') && document.querySelector('.crumbs .here').textContent.includes('Archives'));
  const contract = pdfFile('Contrat.pdf', 'contrat');
  await importPdf(page, frame, contract.file);
  check('le PDF arrive dans le dossier ouvert', JSON.stringify(await waitForNames(frame, ['Contrat.pdf', 'Facture (1).pdf'])) === '["Contrat.pdf","Facture (1).pdf"]', await toast(frame));
  const filing = (await rest.rows('GFS_Rangement')).filter(row => row.App === 'gfs-fichiers' && row.Dossier === 'Archives');
  const stored = (await rest.rows('GFS_Fichiers')).find(row => row.Nom === 'Contrat.pdf');
  check('son rangement est dans le dossier ; l\'auteur est l\'adresse que Grist donne à la personne', filing.length === 2 && stored.Auteur === 'essai@example.com', [filing.length, stored && stored.Auteur]);
  check('l\'explorateur montre les initiales de l\'auteur', await rowOf(frame, 'Contrat.pdf').locator('.who').count() === 1);
  await shot(frame, '9-dossier');

  // La corbeille a son essai (run-corbeille.mjs : restaurer, supprimer pour de bon, vider, au clavier) ; ici, le premier geste et ce qu'il laisse dans la table.
  say('--- 7. mettre à la corbeille ---');
  await openRowMenu(frame, 'Contrat.pdf');
  await frame.getByRole('menuitem', { name: 'Mettre à la corbeille' }).click();
  check('« Mettre à la corbeille » retire le fichier de la liste, sans question', JSON.stringify(await waitForNames(frame, ['Facture (1).pdf'])) === '["Facture (1).pdf"]' && await frame.locator('.mod.ask').count() === 0);
  check('la phrase le dit', /« Contrat\.pdf » est à la corbeille/.test(await waitForToast(frame, /est à la corbeille/)));
  const binned = (await rest.rows('GFS_Fichiers')).find(row => row.Nom === 'Contrat.pdf');
  check('la ligne reste dans la table, marquée (date, personne), sa pièce jointe toujours citée', Boolean(binned) && binned.SupprimeLe > 0 && binned.SupprimePar === 'essai@example.com' && binned.Contenu.length === 2, binned);
  await shot(frame, '10-corbeille');
  await goTo(frame, /^\s*(Moi|Me)\s*$/);
}

// ----- 6. Ce qui ne va pas : des fichiers qui n'en sont pas, un serveur qui refuse ou qui ne répond pas.
async function playProblems(run) {
  const { page, frame, rest } = run;
  say('--- 8. ce qui ne va pas ---');
  const count = async () => [(await rest.rows('GFS_Fichiers')).length, (await rest.attachments()).length];
  const before = await count();
  await importPdf(page, frame, { name: 'Classeur.pdf', mimeType: 'application/pdf', buffer: Buffer.from('PK\u0003\u0004 un classeur renommé en .pdf') });
  check('un fichier qui n\'est pas un PDF est dit, rien n\'est envoyé', /n’est pas un PDF/.test(await waitForToast(frame, /pas un PDF/)));
  await importPdf(page, frame, { name: 'Vide.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
  check('un fichier vide est dit', /Vide\.pdf » est vide/.test(await waitForToast(frame, /est vide/)));
  await importPdf(page, frame, { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('%PDF-1.4') });
  check('un fichier d\'un autre format est dit', /n’est pas un fichier PDF/.test(await waitForToast(frame, /pas un fichier/)));
  check('rien n\'a été écrit ni envoyé', JSON.stringify(await count()) === JSON.stringify(before), [before, await count()]);

  run.allow.push(/le fichier n’a pas pu être traité/);
  const answer = (status, body) => route => (route.request().method() === 'POST' ? route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body }) : route.continue());
  await page.context().route(/\/attachments\?auth=/, answer(413, '{"error":"Payload Too Large"}'));
  await importPdf(page, frame, pdfFile('Gros.pdf', 'gros').file);
  const refused = await waitForToast(frame, /n’a pas pu être ajouté/);
  check('le serveur refuse (413) : la raison est dite en mots, aucune ligne n\'est ajoutée', /trop gros pour lui/.test(refused) && (await rest.rows('GFS_Fichiers')).length === before[0], refused);
  await page.context().unroute(/\/attachments\?auth=/);
  await page.context().route(/\/attachments\?auth=/, route => (route.request().method() === 'POST' ? route.abort('failed') : route.continue()));
  await importPdf(page, frame, pdfFile('Gros.pdf', 'gros').file);
  const down = await waitForToast(frame, /pas répondu/);
  check('le serveur ne répond pas : la phrase le dit', /n’a pas répondu/.test(down) && (await rest.rows('GFS_Fichiers')).length === before[0], down);
  await page.context().unroute(/\/attachments\?auth=/);
  await shot(frame, '11-erreur');
}

async function playBigFile(run) {
  const { page, frame, rest } = run;
  say('--- 9. un fichier de 12 Mo ---');
  const buffer = Buffer.concat([Buffer.from('%PDF-1.4\n% gros fichier d\'essai\n'), (await import('node:crypto')).randomBytes(12 * 1024 * 1024)]);
  const started = Date.now();
  await importPdf(page, frame, { name: 'Gros.pdf', mimeType: 'application/pdf', buffer });
  await waitForToast(frame, /est dans GFS/, 120000);
  const row = (await rest.rows('GFS_Fichiers')).find(each => each.Nom === 'Gros.pdf');
  const stored = row ? await rest.attachment(row.Contenu[1]) : null;
  check('un PDF de 12 Mo part et revient identique', Boolean(row) && stored.hash === sha256(buffer) && stored.size === buffer.length, [stored && stored.size, `${Date.now() - started} ms`]);
}

// ----- 7. Au clavier : la fenêtre du nom pris garde le focus, et Entrée fait le choix mis en avant ; les contrastes (4,5:1) des fenêtres.
async function playKeyboard(run) {
  const { page, frame, rest } = run;
  say('--- 9. au clavier, les contrastes ---');
  const before = (await rest.rows('GFS_Fichiers')).length;
  await importPdf(page, frame, pdfFile('devis.pdf', 'devis-clavier').file);
  await frame.locator('.mod.ask').waitFor();
  const count = await frame.locator('.mod.ask button').count();
  const stays = [];
  for (let i = 0; i < count * 2 + 1; i++) {
    await page.keyboard.press('Tab');
    stays.push(await frame.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('.mod'))));
  }
  check('Tab tourne dans la fenêtre sans jamais en sortir', stays.every(Boolean), stays);
  await page.keyboard.press('Shift+Tab');
  for (let i = 0; i < count; i++) await page.keyboard.press('Tab');
  const back = await frame.evaluate(() => document.activeElement.dataset.fk);
  check('après un tour complet, le focus revient sur le même bouton', typeof back === 'string' && back.startsWith('conflict-'), back);
  check('les textes de la fenêtre du nom pris tiennent la charte (4,5:1) et dans le panneau', (await contrastProblems(frame, '.mod')).length === 0 && JSON.stringify(await windowFits(frame)) === '{"shown":true,"inPanel":true,"overflowing":[]}', [await contrastProblems(frame, '.mod'), await windowFits(frame)]);
  await frame.locator('[data-fk="conflict-both"]').focus();
  await page.keyboard.press('Enter');
  await frame.waitForFunction(() => document.querySelectorAll('.ls-row:not(.folder)').length === 2, null, { timeout: 20000 }).catch(() => {});
  const found = await names(frame);
  check('Entrée sur « Garder les deux » garde les deux : « devis (1).pdf » à côté de « Devis.pdf »', JSON.stringify([...found].sort()) === JSON.stringify(['Devis.pdf', 'devis (1).pdf'].sort()) && (await rest.rows('GFS_Fichiers')).length === before + 1, found);
}

// ----- 8. Une autre personne, une autre langue : l'anglais, en sombre, avec les mêmes gestes.
async function playEnglishDark(browser, server) {
  say('--- 10. en anglais, en sombre ---');
  const { t } = createI18n('en');
  const context = await newContext(browser, server, { colorScheme: 'dark' });
  try {
    const run = await openGfs(context, { lang: 'en' });
    const { page, frame, rest } = run;
    await frame.getByRole('button', { name: 'New' }).click();
    await frame.getByRole('menuitem', { name: /^Import/ }).click();
    const item = frame.locator('.menu-sub').getByRole('menuitem', { name: /^PDF/ });
    check('« Import > PDF » parle anglais et dit qui garde le fichier', /Kept by GFS/.test(await item.textContent()), await item.textContent());
    await shot(frame, 'en-1-importer');
    await page.keyboard.press('Escape');

    const first = pdfFile('Invoice.pdf', 'invoice');
    await importPdf(page, frame, first.file);
    await frame.locator('.mod.ask').waitFor();
    check('l\'accord de la table est en anglais', (await frame.locator('#ask-title').textContent()) === t('files.table.title') && (await frame.locator('.mod.ask').textContent()).includes(t('files.table.text')));
    check('sa fenêtre tient dans le panneau et ses textes sont lisibles (4,5:1)', (await contrastProblems(frame, '.mod')).length === 0 && JSON.stringify(await windowFits(frame)) === '{"shown":true,"inPanel":true,"overflowing":[]}', [await contrastProblems(frame, '.mod'), await windowFits(frame)]);
    await shot(frame, 'en-2-accord');
    await frame.locator('[data-fk="ask-yes"]').click();
    check('le PDF est dans GFS, la phrase est anglaise', (await waitForToast(frame, /is in GFS/)) === t('files.added', { name: 'Invoice.pdf' }), await toast(frame));

    await importPdf(page, frame, pdfFile('invoice.pdf', 'invoice-2').file);
    await frame.locator('.mod.ask').waitFor();
    const labels = await frame.locator('.mod.ask .btn').allTextContents();
    check('le nom pris : titre, boutons et nom de la copie en anglais', (await frame.locator('#cf-title').textContent()) === t('files.conflict.title') && JSON.stringify(labels.map(label => label.trim())) === JSON.stringify(['Cancel', 'Replace', 'Keep both']) && (await frame.locator('.ask-items').textContent()).includes('invoice (1).pdf'), labels);
    check('sa fenêtre est lisible (4,5:1) et tient dans le panneau', (await contrastProblems(frame, '.mod')).length === 0 && JSON.stringify(await windowFits(frame)) === '{"shown":true,"inPanel":true,"overflowing":[]}', [await contrastProblems(frame, '.mod'), await windowFits(frame)]);
    await shot(frame, 'en-3-nom-pris');
    await page.keyboard.press('Escape');
    await frame.locator('.mod.ask').waitFor({ state: 'detached' });

    await openRowMenu(frame, 'Invoice.pdf');
    check('le menu d\'une ligne en anglais', JSON.stringify((await menuItems(frame)).map(entry => entry.label)) === JSON.stringify([t('files.read'), t('files.download'), t('ex.pin'), t('ex.rename'), t('ex.duplicate'), t('ex.move'), t('trash.move')]), await menuItems(frame));
    await shot(frame, 'en-4-menu');
    await frame.getByRole('menuitem', { name: new RegExp(`^${t('trash.move')}`) }).click();
    check('« Move to trash » le dit en anglais, sans question', (await waitForToast(frame, /is in the trash/)) === t('trash.moved', { name: 'Invoice.pdf' }) && await frame.locator('.mod.ask').count() === 0, await toast(frame));
    await goTo(frame, new RegExp(`^\\s*${t('trash.view')}`));
    await frame.locator('[data-empty-trash]').click();
    await frame.locator('.mod.ask').waitFor();
    check('la question « Empty the trash? » est anglaise, lisible, et tient dans le panneau', (await frame.locator('#ask-title').textContent()) === t('trash.emptyAll.title') && (await contrastProblems(frame, '.mod')).length === 0 && JSON.stringify(await windowFits(frame)) === '{"shown":true,"inPanel":true,"overflowing":[]}', [await frame.locator('#ask-title').textContent(), await contrastProblems(frame, '.mod')]);
    await shot(frame, 'en-5-vider');
    await page.keyboard.press('Escape');
    await frame.locator('.mod.ask').waitFor({ state: 'detached' });
    await goTo(frame, /^\s*(Moi|Me)\s*$/);

    await page.context().route(/\/attachments\?auth=/, route => (route.request().method() === 'POST' ? route.fulfill({ status: 413, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"Payload Too Large"}' }) : route.continue()));
    await importPdf(page, frame, pdfFile('Big.pdf', 'big').file);
    const refused = await waitForToast(frame, /could not be added/);
    check('le refus du serveur est dit en anglais', refused === t('files.failed', { name: 'Big.pdf', reason: t('files.err.tooBig') }), refused);
    run.allow.push(/le fichier n’a pas pu être traité/);
    check('rien n\'a été ajouté', (await rest.rows('GFS_Fichiers')).length === 1);
    const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
    check('aucune erreur de GFS dans la console (anglais, sombre)', unexpected.length === 0, unexpected);
  } finally {
    await context.close();
  }
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server);
  const run = await openGfs(context);
  check('GFS est à 700 × 400 dans le vrai Grist', Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await playFirstImport(run);
  await checkFirstStored(run);
  await playConflict(run);
  await playReplace(run);
  await playDownload(run);
  run.firstId = (await run.rest.rows('GFS_Fichiers')).find(row => row.Nom === 'Facture.pdf').Identifiant;
  await playMenuAndRename(run);
  await playPin(run);
  await playFolderAndDelete(run);
  await playProblems(run);
  await playKeyboard(run);
  await playBigFile(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement de GFS dans la console, hors ceux des échecs joués exprès', unexpected.length === 0, unexpected);
  await playEnglishDark(browser, server);
} finally {
  await browser.close();
  pages.close();
}
