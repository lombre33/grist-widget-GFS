// La photo et le logo de l'annuaire (module Annuaire ; choix du porteur, 27/11 : « un avatar » et « un logo en haut à droite de la carte », en pièces jointes de Grist, « depuis le widget »),
// DEPUIS L'ÉCRAN, dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`), à 700 × 400, à la vraie souris et au vrai clavier, le propriétaire du document dans le vrai GFS.
// Ce que le faux Grist des essais Firefox ne dit pas : le téléchargement d'une vraie pièce jointe par le cadre d'envoi (jeton, origine opaque : le CORS que le porteur a demandé de
// vérifier), l'envoi d'une image par ce cadre (le numéro que Grist rend, le fichier qu'il garde, sa taille), la cellule `['L', numéro]` qui en résulte et la phrase d'un refus de Grist.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-annuaire-images-ui.mjs        LAB_LANG=fr|en, LAB_SCHEME=light|dark
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
const TAG = `annuaire-images-${lang}-${scheme}`;
// L'annuaire : la photo est la colonne `Photo` des personnes, le logo celui de la direction de leur structure (`Structure › Direction › Logo`).
const CONFIG = {
  v: 1, name: 'Nom', title: 'Poste', email: 'Email', phone: 'Tel', manager: 'Responsable', relations: [], columns: ['email'], avatar: 'Photo', logo: 'Structure › Direction › Logo',
  levels: [{ label: 'Pôle', path: ['Structure', 'Pole'] }, { label: 'Direction', path: ['Structure', 'Direction'] }, { label: 'Service', path: ['Service'] }],
  fields: [{ col: 'Contrat', filter: true }],
};
const CAMILLE = 4; // Camille Durand : service Budget, direction des finances (la structure 4)
const EMMA = 2; // Emma Rolland : pôle Ressources, sans direction (pas de logo)
const FINANCES = 4; // la ligne de « Direction des finances » dans `Structures`

const shot = async (frame, name) => (await frame.frameElement()).screenshot({ path: join(SHOTS, `${TAG}-${name}.png`) });
const LIGHT_READER_OFF = /la lecture légère des fichiers est éteinte pour cette session/;
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && !LIGHT_READER_OFF.test(problem));

// Une image dessinée dans la page de Grist, envoyée par l'API REST (ce que ferait Grist lui-même : une pièce jointe d'avant GFS) : le numéro de la pièce jointe.
const seedImage = (run, name, width, height, mime, hue) => run.page.evaluate(async ([docId, fileName, w, h, type, tint]) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d');
  context.fillStyle = `hsl(${tint} 60% 45%)`;
  context.fillRect(0, 0, w, h);
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(w / 2, h * 0.4, Math.min(w, h) * 0.2, 0, 7);
  context.fill();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, 0.9));
  const form = new FormData();
  form.append('upload', blob, fileName);
  const response = await fetch(`/api/docs/${docId}/attachments`, { method: 'POST', body: form, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  return (await response.json())[0];
}, [run.docId, name, width, height, mime, hue]);

// Une grosse image bruitée (un JPEG de plusieurs Mo, comme une photo de téléphone), en octets : à poser dans le sélecteur de fichiers.
const bigPhoto = (page, width, height) => page.evaluate(async ([w, h]) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d');
  const data = context.createImageData(w, h);
  for (let at = 0; at < data.data.length; at += 4) { data.data[at] = (at / 4) % 251; data.data[at + 1] = Math.random() * 255; data.data[at + 2] = (at / 4000) % 255; data.data[at + 3] = 255; }
  context.putImageData(data, 0, 0);
  const url = canvas.toDataURL('image/jpeg', 0.95);
  return url.slice(url.indexOf(',') + 1);
}, [width, height]);

// Ce que Grist garde d'une pièce jointe : { name, size, width, height } (les dimensions : celles de l'image téléchargée).
const attachmentInfo = (run, id) => run.page.evaluate(async ([docId, n]) => {
  const meta = await (await fetch(`/api/docs/${docId}/attachments/${n}`)).json();
  const blob = await (await fetch(`/api/docs/${docId}/attachments/${n}/download`)).blob();
  const bitmap = await createImageBitmap(blob).catch(() => null);
  return { name: meta.fileName, size: meta.fileSize, type: blob.type, width: bitmap ? bitmap.width : 0, height: bitmap ? bitmap.height : 0 };
}, [run.docId, id]);

const photoOf = async (run, row) => ((await rowsOf(run, 'Personnes')) || []).find(person => person.id === row).Photo;
const idOf = cell => (Array.isArray(cell) ? cell.filter(each => typeof each === 'number')[0] || 0 : 0);

// Ouvre la fenêtre de l'annuaire (le bouton du titre de l'explorateur).
async function openAnnuaire(frame, page) {
  await frame.locator('.ex-title-row button', { has: frame.locator('use[href="#i-annuaire"]') }).click();
  await frame.locator('.mod.an').waitFor({ state: 'visible' });
  await frame.locator('.an-person').first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(600);
}

// Fait défiler chaque ligne jusqu'à l'écran : une image ne se charge que lorsqu'elle est visible.
async function scrollThrough(frame, page, selector) {
  const count = await frame.locator(selector).count();
  for (let at = 0; at < count; at++) {
    await frame.locator(selector).nth(at).scrollIntoViewIfNeeded();
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(500);
  await frame.locator(selector).first().scrollIntoViewIfNeeded();
}

// Les avatars qui montrent une image dans la liste : [numéro de ligne].
const withPhotos = frame => frame.locator('.an-person').evaluateAll(rows => rows.filter(row => row.querySelector('.an-av.has-img img')).map(row => Number(row.dataset.row)));
const sourceOf = (frame, row) => frame.locator(`.an-person[data-row="${row}"] .an-av img`).evaluate(img => img.src.slice(0, 40)).catch(() => '');
const noteOf = async frame => (await frame.locator('.mod.an-edit .mod-note').innerText()).replace(/\s+/g, ' ').trim();

// La fenêtre « Modifier » de la fiche de `row`.
async function openEdit(frame, page, row) {
  // la fiche de cette personne est peut-être déjà ouverte (un second clic sur sa ligne la refermerait)
  if (!(await frame.locator(`.an-side [data-fk="edit"][data-row="${row}"]`).count())) {
    await frame.locator(`[data-fk="pe:${row}"]`).scrollIntoViewIfNeeded();
    await frame.locator(`[data-fk="pe:${row}"]`).click();
  }
  await frame.locator('.an-side [data-fk="edit"]').click();
  await frame.locator('.mod.an-edit').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
}

// « Choisir / Remplacer l'image… » à la vraie souris : le vrai sélecteur de fichiers s'ouvre, on y pose le fichier.
async function chooseFile(frame, page, name, buffer, mimeType) {
  const chooser = page.waitForEvent('filechooser', { timeout: 8000 });
  await frame.locator('[data-fk="ef:@photo"]').click();
  await (await chooser).setFiles({ name, mimeType, buffer });
  await page.waitForTimeout(500);
}

async function play(run, requests) {
  const { page } = run;
  say('--- 0. le document, deux photos et un logo posés comme Grist le ferait, l\'annuaire réglé dessus ---');
  await seedAnnuaire(run.frame);
  const added = await apply(run, [['AddColumn', 'Personnes', 'Photo', { type: 'Attachments', isFormula: false }], ['AddColumn', 'Structures', 'Logo', { type: 'Attachments', isFormula: false }]]);
  check('les colonnes « Pièces jointes » sont créées', added.status === 200, added.text);
  const photos = { [CAMILLE]: await seedImage(run, 'camille.jpg', 640, 480, 'image/jpeg', 210), [EMMA]: await seedImage(run, 'emma.jpg', 400, 400, 'image/jpeg', 20) };
  const logo = await seedImage(run, 'logo-finances.png', 480, 120, 'image/png', 30);
  check('trois pièces jointes sont dans Grist', [photos[CAMILLE], photos[EMMA], logo].every(Number.isInteger), [photos, logo]);
  await apply(run, [['UpdateRecord', 'Personnes', CAMILLE, { Photo: ['L', photos[CAMILLE]] }], ['UpdateRecord', 'Personnes', EMMA, { Photo: ['L', photos[EMMA]] }],
    ['UpdateRecord', 'Structures', FINANCES, { Logo: ['L', logo] }]]);
  await run.frame.evaluate(async config => {
    const { AnnuaireStore } = await import('/prototype/js/annuaire/annuaire-store.js');
    const store = new AnnuaireStore({ port: { doc: grist.docApi }, consent: async () => true });
    await store.create({ name: 'Annuaire de l’établissement', table: 'Personnes', config });
  }, CONFIG);
  requests.length = 0;
  await page.reload();
  let frame = await gfsFrame(page);
  await openAnnuaire(frame, page);

  say('--- 1. la lecture : le cadre d\'envoi télécharge les pièces jointes (jeton, origine opaque) et la liste les montre ---');
  await scrollThrough(frame, page, '.an-person');
  await frame.locator('.an-person .an-av.has-img').first().waitFor({ timeout: 25000 });
  const shown = await withPhotos(frame);
  say('  lignes qui montrent une photo :', JSON.stringify(shown));
  check('Camille et Emma ont leur photo dans leur rond, personne d\'autre', JSON.stringify([...shown].sort()) === JSON.stringify([CAMILLE, EMMA].sort()), shown);
  const img = await frame.locator(`.an-person[data-row="${CAMILLE}"] .an-av img`).evaluate(node => ({ src: node.src.slice(0, 22), natural: [node.naturalWidth, node.naturalHeight], fit: getComputedStyle(node).objectFit }));
  check('la photo est une image « data: » réduite (128 pixels au plus), rognée au centre', img.src.startsWith('data:image/jpeg') && Math.max(...img.natural) <= 128 && img.fit === 'cover', JSON.stringify(img));
  const initials = await frame.locator(`.an-person[data-row="${CAMILLE}"] .an-av`).evaluate(node => getComputedStyle(node).color);
  check('les initiales disparaissent derrière la photo', initials === 'rgba(0, 0, 0, 0)', initials);
  await shot(frame, '1-liste');
  const fetched = id => requests.filter(url => new RegExp(`/attachments/${id}/download`).test(url));
  check('chaque pièce jointe est téléchargée une fois (le jeton est dans l\'adresse, pas d\'autre en-tête)', fetched(photos[CAMILLE]).length === 1 && fetched(photos[EMMA]).length === 1, requests);

  say('--- 2. les cartes et la fiche : le logo de la direction, en haut à droite ---');
  await frame.locator('[data-fk="v:cards"]').click();
  await page.waitForTimeout(400);
  await scrollThrough(frame, page, '.an-pcard');
  await frame.locator('.an-pcard .an-logo:not(.is-wait) img').first().waitFor({ timeout: 25000 });
  const cards = await frame.locator('.an-pcard').evaluateAll(list => list.filter(card => card.querySelector('.an-logo img')).map(card => Number(card.dataset.row)));
  say('  cartes qui montrent le logo :', JSON.stringify(cards));
  check('les personnes de la direction des finances (et de son service Budget) ont le logo, les autres non', cards.includes(CAMILLE) && !cards.includes(EMMA) && cards.length >= 3, cards);
  const place = await frame.locator(`.an-pcard[data-row="${CAMILLE}"]`).evaluate(card => {
    const logo = card.querySelector('.an-logo').getBoundingClientRect();
    const box = card.getBoundingClientRect();
    return { top: logo.top - box.top, right: box.right - logo.right, inside: logo.left >= box.left && logo.bottom <= box.bottom, ground: getComputedStyle(card.querySelector('.an-logo')).backgroundColor };
  });
  check('le logo est en haut à droite de la carte, sur fond blanc', place.top >= 0 && place.top <= 16 && place.right >= 2 && place.right <= 16 && place.inside && place.ground === 'rgb(255, 255, 255)', JSON.stringify(place));
  await shot(frame, '2-cartes');
  await frame.locator(`[data-fk="pe:${CAMILLE}"]`).click();
  await frame.locator('.an-side .an-fiche-head .an-logo:not(.is-wait) img').waitFor({ timeout: 15000 });
  check('la fiche montre la photo et le logo', await frame.locator('.an-side .an-fiche-head .an-av.has-img img').count() === 1);
  await shot(frame, '3-fiche');
  check('rien n\'est retéléchargé en changeant d\'affichage (mémoire de session)', fetched(photos[CAMILLE]).length === 1 && fetched(logo).length === 1, requests);
  await frame.locator('[data-fk="side-x"]').click();
  await frame.locator('[data-fk="v:list"]').click();

  say('--- 3. « Modifier » : remplacer la photo par une grosse image (le vrai sélecteur de fichiers, le vrai cadre d\'envoi) ---');
  const big = await bigPhoto(page, 2400, 1800);
  const bytes = Buffer.from(big, 'base64');
  say('  l\'original :', `${(bytes.length / 1048576).toFixed(1)} Mo, 2400 × 1800`);
  await openEdit(frame, page, CAMILLE);
  check('la ligne « Photo » montre l\'aperçu et propose « Remplacer » et « Retirer »', (await frame.locator('.an-ed-photo .an-av img').count()) === 1
    && (await frame.locator('.an-ed-photo-acts button').allInnerTexts()).map(text => text.trim()).join('|') === [t('an.img.replace'), t('an.img.remove')].join('|'));
  const uploadsBefore = ((await rowsOf(run, '_grist_Attachments')) || []).length;
  await chooseFile(frame, page, 'camille-grande.jpeg', bytes, 'image/jpeg');
  check('l\'image choisie est montrée, son nom (réduit) est dit, rien n\'est parti', (await frame.locator('.an-ed-photo .an-set-hint').innerText()).includes('camille-grande.jpg')
    && ((await rowsOf(run, '_grist_Attachments')) || []).length === uploadsBefore, await frame.locator('.an-ed-photo .an-set-hint').innerText());
  await shot(frame, '4-choix');
  await frame.locator('[data-fk="ed-next"]').click();
  const review = (await frame.locator('.an-ed-change').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
  check('la relecture dit « Photo actuelle » puis le nom du fichier', review.includes(t('an.img.current')) && review.includes('camille-grande.jpg'), review);
  await frame.locator('[data-fk="ed-next"]').click();
  await frame.locator('.mod.an-edit').waitFor({ state: 'detached', timeout: 40000 });
  const cell = await photoOf(run, CAMILLE);
  const fresh = idOf(cell);
  check('la cellule de Camille cite une nouvelle pièce jointe (`[\'L\', numéro]`)', fresh > 0 && fresh !== photos[CAMILLE], JSON.stringify(cell));
  const info = await attachmentInfo(run, fresh);
  say('  ce que Grist a gardé :', JSON.stringify(info));
  check('Grist a un JPEG de 512 pixels de grand côté, bien plus léger que l\'original', info.width > 0 && Math.max(info.width, info.height) === 512 && info.size < bytes.length / 4 && info.type === 'image/jpeg' && info.name === 'camille-grande.jpg', JSON.stringify(info));
  check('une seule pièce jointe de plus dans Grist', ((await rowsOf(run, '_grist_Attachments')) || []).length === uploadsBefore + 1);
  await frame.locator(`.an-person[data-row="${CAMILLE}"] .an-av.has-img img`).waitFor({ timeout: 15000 });
  check('la liste montre la nouvelle photo sans la retélécharger', fetched(fresh).length === 0, fetched(fresh));
  await shot(frame, '5-apres');

  say('--- 4. après rechargement : la nouvelle photo vient de Grist ---');
  requests.length = 0;
  await page.reload();
  frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  await scrollThrough(frame, page, '.an-person');
  await frame.locator(`.an-person[data-row="${CAMILLE}"] .an-av.has-img img`).waitFor({ timeout: 25000 });
  check('la photo envoyée est téléchargée (une fois) et montrée', fetched(fresh).length === 1, requests);

  say('--- 5. « Retirer » : la cellule se vide, les initiales reviennent ---');
  await openEdit(frame, page, CAMILLE);
  await frame.locator('[data-fk="er:@photo"]').click();
  check('l\'aperçu retombe sur les initiales', (await frame.locator('.an-ed-photo .an-av img').count()) === 0 && (await frame.locator('.an-ed-photo .an-av').innerText()).trim() === 'CD');
  await frame.locator('[data-fk="ed-next"]').click();
  await frame.locator('[data-fk="ed-next"]').click();
  await frame.locator('.mod.an-edit').waitFor({ state: 'detached', timeout: 40000 });
  const emptied = await photoOf(run, CAMILLE);
  check('la cellule est vide dans Grist', idOf(emptied) === 0, JSON.stringify(emptied));
  await page.waitForTimeout(400);
  check('la liste montre les initiales de Camille', (await frame.locator(`.an-person[data-row="${CAMILLE}"] .an-av img`).count()) === 0);

  say('--- 6. un fichier qui n\'est pas une image, puis Grist refuse d\'écrire la cellule : la phrase est dite, la fenêtre reste ---');
  await openEdit(frame, page, CAMILLE);
  await chooseFile(frame, page, 'note.txt', Buffer.from('pas une image'), 'text/plain');
  const bad = await noteOf(frame);
  check('« note.txt » est refusé dans le pied, sans rien écrire', bad === t('an.img.unreadable', { name: 'note.txt' }) && (await frame.locator('.mod.an-edit .mod-note.is-warn').count()) === 1, bad);
  const rule = await apply(run, [['AddRecord', '_grist_ACLResources', -1, { tableId: 'Personnes', colIds: 'Photo' }],
    ['AddRecord', '_grist_ACLRules', null, { resource: -1, aclFormula: '', permissionsText: '-U', rulePos: 1, memo: 'essai : personne ne change la photo' }]]);
  check('la règle d\'essai est posée', rule.status === 200, rule.text);
  await page.reload();
  frame = await gfsFrame(page);
  await openAnnuaire(frame, page);
  await openEdit(frame, page, CAMILLE);
  await chooseFile(frame, page, 'refus.jpg', Buffer.from(await bigPhoto(page, 800, 600), 'base64'), 'image/jpeg');
  await frame.locator('[data-fk="ed-next"]').click();
  await frame.locator('[data-fk="ed-next"]').click();
  await page.waitForTimeout(2500);
  const refusal = await noteOf(frame);
  say('  la phrase que Grist a donnée :', refusal);
  check('la fenêtre est toujours là et dit le refus de Grist', (await frame.locator('.mod.an-edit').count()) === 1 && refusal.startsWith(t('an.edit.refused', { reason: '' }).trim().slice(0, 18)) && refusal.length > 40, refusal);
  check('on peut réessayer, la cellule n\'a pas changé', (await frame.locator('[data-fk="ed-next"]').getAttribute('aria-disabled')) !== 'true' && idOf(await photoOf(run, CAMILLE)) === 0);
  await shot(frame, '6-refus');
  await page.keyboard.press('Escape');
  await frame.locator('.mod.an-edit').waitFor({ state: 'detached' }).catch(() => {});
  check('aucune erreur de GFS dans la console (ni violation de la politique de contenu)', unexpected(run).length === 0, unexpected(run));
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  const requests = [];
  // Les requêtes du cadre d'envoi de GFS : le jeton est dans l'adresse (`auth=`) ; celles de l'essai lui-même (ses lectures avec le cookie de la page) ne comptent pas.
  context.on('request', request => { if (/\/attachments\/.*auth=/.test(request.url())) requests.push(request.url().replace(/auth=[^&]+/, 'auth=…')); });
  const run = await openGfs(context, { lang });
  await play(run, requests);
} catch (error) {
  say('ÉCHEC de l\'essai :', String(error && error.message).slice(0, 400));
  for (const page of browser.contexts().flatMap(context => context.pages())) await page.screenshot({ path: join(SHOTS, `${TAG}-erreur.png`) }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  pages.close();
}
