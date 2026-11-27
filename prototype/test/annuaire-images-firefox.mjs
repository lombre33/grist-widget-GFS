// La photo et le logo de l'annuaire sous Firefox (règle du 03/11 ; module Annuaire, demande du porteur du 27/11 : « un avatar » et « un logo en haut à droite de la carte » ; choix du
// porteur : les pièces jointes de Grist), à la vraie souris, sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js, `?images=1`) : des images dessinées dans la page
// remplacent le cadre d'envoi. Ce que Grist envoie vraiment (la pièce jointe, ses refus, le téléchargement avec jeton) se mesure dans le labo (labo/run-annuaire-images-ui.mjs).
// Suite de test/annuaire-firefox.mjs. À mesurer, à 700, 520 et 400 px, en clair et en sombre, en français et en anglais :
// - la liste : la photo recouvre le rond de 32 px (rogné au centre), les initiales disparaissent derrière elle ; une photo qui ne vient pas laisse les initiales ; sans photo, les initiales ;
// - les cartes : le logo en haut à droite de la carte, dans la carte, sans toucher l'avatar ni le nom, sur un fond blanc dans les deux thèmes ; une personne sans logo n'a pas de pastille ;
// - la fiche : la photo, le logo au bout de l'en-tête (sans toucher le nom ni la croix) ; l'organigramme : le logo du niveau, sans couvrir le titre ;
// - chaque image n'est téléchargée qu'une fois ;
// - « Ajouter » : la même ligne « Photo », une fiche préparée avec son image, une seule `BulkAddRecord` qui cite la pièce jointe ;
// - « Modifier » : la ligne « Photo » (aperçu, « Remplacer l'image… », « Retirer »), une image choisie réduite à 512 pixels et envoyée seulement au dernier bouton, une seule
//   `UpdateRecord` qui cite la pièce jointe ; un refus de l'envoi dit tel quel et n'écrit rien ; un fichier qui n'est pas une image est refusé dans le pied. Le sélecteur de fichiers du
//   système n'existe pas sans écran : le clic à la souris est mesuré (il demande le sélecteur), le fichier est ensuite posé dans la case par la page.
import { delay } from './corbeille-firefox.mjs';
import { reload } from './annuaire-ajout-firefox.mjs';

const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;
const meets = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
const PICTURE = 'Camille Durand.jpeg';
const REDUCED = 'Camille Durand.jpg';

// ---------- ce qui s'exécute dans la page ----------

// Les images de l'écran où l'on est : la liste, les cartes, la fiche, l'organigramme.
function imagesSnap() {
  const modal = document.querySelector('.mod.an');
  if (!modal) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const visible = node => node.getClientRects().length > 0;
  const imageOf = node => {
    const img = node.querySelector('img');
    return img ? { ok: img.complete && img.naturalWidth > 0, natural: [img.naturalWidth, img.naturalHeight], box: box(img), fit: getComputedStyle(img).objectFit, data: img.src.startsWith('data:image/') } : null;
  };
  const avatarOf = node => {
    const av = node.querySelector('.an-av');
    return av ? { box: box(av), radius: parseFloat(getComputedStyle(av).borderTopLeftRadius), img: imageOf(av), text: text(av), ink: getComputedStyle(av).color, has: av.classList.contains('has-img') } : null;
  };
  const logoOf = node => {
    const logo = node.querySelector('.an-logo');
    return logo ? { box: box(logo), img: imageOf(logo), ground: getComputedStyle(logo).backgroundColor, shown: getComputedStyle(logo).visibility !== 'hidden', wait: logo.classList.contains('is-wait') } : null;
  };
  // `lines` : les rectangles du TEXTE (une ligne chacun), que la boîte du titre, plus large que son texte, ne dit pas.
  const named = (node, selector) => {
    const found = node.querySelector(selector);
    if (!found) return null;
    const range = document.createRange();
    range.selectNodeContents(found);
    return { text: text(found), box: box(found), lines: [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })) };
  };
  const entry = node => ({ row: node.dataset.row, name: text(node.querySelector('.an-pe-name') || node), box: box(node), av: avatarOf(node), logo: logoOf(node),
    title: named(node, '.an-pe-name'), sub: named(node, '.an-pe-sub') });
  const side = modal.querySelector('.an-side');
  const head = side && side.querySelector('.an-fiche-head');
  const orgs = [...modal.querySelectorAll('.an-oc')].filter(visible);
  const scroll = modal.querySelector('.an-org-scroll, .an-org');
  return {
    view: [innerWidth, innerHeight], rows: [...modal.querySelectorAll('.an-person')].filter(visible).map(entry), cards: [...modal.querySelectorAll('.an-pcard')].filter(visible).map(entry),
    fiche: head ? { card: box(side.querySelector('.an-fiche-card')), head: box(head), av: avatarOf(head), logo: logoOf(head), name: named(head, 'h3'), sub: named(head, '.an-pe-sub'),
      close: side.querySelector('[data-fk="side-x"]') ? box(side.querySelector('[data-fk="side-x"]')) : null, sideways: side.scrollWidth - side.clientWidth } : null,
    org: orgs.map(card => ({ id: card.dataset.id, box: box(card), logo: logoOf(card), title: named(card, '.an-oc-title') })), orgArea: scroll ? box(scroll) : null,
    downloads: window.__annuaireDownloads.slice(), stray: /\b(null|undefined)\b/.test(modal.textContent),
  };
}

// La ligne « Photo » de la fenêtre « Modifier » et ce qui l'entoure.
function photoSnap() {
  const win = document.querySelector('.mod.an-edit');
  if (!win) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const row = [...win.querySelectorAll('.an-set-row')].find(each => each.querySelector('.an-ed-photo'));
  const note = win.querySelector('.mod-note');
  const body = win.querySelector('.an-set-body');
  const buttons = row ? [...row.querySelectorAll('.an-ed-photo-acts button')].map(button => ({ fk: button.dataset.fk, text: text(button), disabled: button.getAttribute('aria-disabled') === 'true',
    box: box(button) })) : [];
  const img = row ? row.querySelector('img') : null;
  const av = row ? row.querySelector('.an-av') : null;
  return { box: box(win), view: [innerWidth, innerHeight], title: text(win.querySelector('h2')), label: row ? text(row.querySelector('.an-set-label')) : null, buttons,
    hint: row ? text(row.querySelector('.an-set-hint')) : null, initials: av ? text(av) : null, img: img ? { ok: img.complete && img.naturalWidth > 0, box: box(img) } : null, avatar: av ? box(av) : null,
    note: text(note), warn: note.classList.contains('is-warn'), next: { text: text(win.querySelector('[data-fk="ed-next"]')), disabled: win.querySelector('[data-fk="ed-next"]').getAttribute('aria-disabled') === 'true' },
    cancel: text(win.querySelector('[data-fk="ed-cancel"]')), sideways: body.scrollWidth - body.clientWidth, row: row ? box(row) : null, body: box(body),
    review: [...win.querySelectorAll('.an-ed-change')].map(change => ({ label: text(change.querySelector('dt')), was: text(change.querySelector('.an-ed-was')), now: text(change.querySelector('.an-ed-now')) })),
    stray: /\b(null|undefined)\b/.test(win.textContent) };
}

// Pose une image dessinée (largeur × hauteur, JPEG) dans la case « fichier » cachée de la fenêtre, comme le ferait le sélecteur de fichiers du système.
async function feedPicture(name, width, height, type) {
  const input = document.querySelector('[data-fk="ed-file-input"]');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#445566');
  gradient.addColorStop(1, '#ddeeff');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  const blob = type === 'text/plain' ? new Blob(['pas une image'], { type }) : await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
  const file = new File([blob], name, { type });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return file.size;
}

// ---------- ce que l'écran montre ----------

const wanted = { 1: 'photo', 3: 'photo', 4: 'photo', 2: 'broken' }; // les lignes : Camille, Nathan, Louis ont une photo ; la photo d'Inès ne vient pas

function avatarProblems(entry, kind, note, where, size) {
  const av = entry.av;
  if (!av) { note('photo', `${where} : « ${entry.name} » n'a pas d'avatar`); return; }
  if (Math.abs(av.box.width - size) > 1 || Math.abs(av.box.height - size) > 1) note('photo', `${where} : l'avatar de « ${entry.name} » mesure ${Math.round(av.box.width)} × ${Math.round(av.box.height)} (${size} attendu)`);
  if (kind === 'photo') {
    if (!av.img || !av.img.ok) { note('photo', `${where} : la photo de « ${entry.name} » n'est pas posée dans son rond`); return; }
    if (!av.img.data) note('photo', `${where} : la photo de « ${entry.name} » n'est pas une image « data: » (la politique de contenu n'en laisse passer aucune autre)`);
    if (av.img.fit !== 'cover') note('photo', `${where} : la photo de « ${entry.name} » n'est pas rognée au centre (${av.img.fit})`);
    if (!inside(av.img.box, av.box) || Math.abs(av.img.box.width - av.box.width) > 1) note('photo', `${where} : la photo de « ${entry.name} » ne remplit pas son rond`);
    if (!av.has || av.ink !== 'rgba(0, 0, 0, 0)') note('photo', `${where} : les initiales de « ${entry.name} » restent visibles derrière sa photo (${av.ink})`);
    if (Math.max(...av.img.natural) > 128) note('photo', `${where} : la photo de « ${entry.name} » n'est pas réduite (${av.img.natural.join(' × ')}, 128 au plus)`);
  } else if (av.img || av.has || !av.text) {
    note('photo', `${where} : « ${entry.name} » (${kind === 'broken' ? 'photo qui ne vient pas' : 'sans photo'}) devait garder ses initiales (« ${av.text} »)`);
  }
}

function logoProblems(entry, expected, note, where) {
  const logo = entry.logo;
  if (!expected) { if (logo) note('logo', `${where} : « ${entry.name} » n'a pas de logo et montre pourtant une pastille`); return; }
  if (!logo) { note('logo', `${where} : « ${entry.name} » n'a pas son logo`); return; }
  if (!logo.img || !logo.img.ok || logo.wait || !logo.shown) { note('logo', `${where} : le logo de « ${entry.name} » n'est pas venu`); return; }
  if (!inside(logo.box, entry.box)) note('logo', `${where} : le logo de « ${entry.name} » sort de sa carte`);
  const gap = entry.box.right - logo.box.right;
  if (gap < 2 || gap > 16 || logo.box.top - entry.box.top > 16) note('logo', `${where} : le logo de « ${entry.name} » n'est pas en haut à droite (${Math.round(gap)} px du bord droit, ${Math.round(logo.box.top - entry.box.top)} px du haut)`);
  if (logo.box.width < 40 || logo.box.height < 24) note('logo', `${where} : le logo de « ${entry.name} » ne mesure que ${Math.round(logo.box.width)} × ${Math.round(logo.box.height)}`);
  if (logo.ground !== 'rgb(255, 255, 255)') note('logo', `${where} : la pastille du logo de « ${entry.name} » est sur ${logo.ground} (blanc attendu : les logos sont dessinés pour le clair)`);
  for (const [what, other] of [['l\'avatar', entry.av && entry.av.box], ['le nom', entry.title && entry.title.box], ['le poste', entry.sub && entry.sub.box]]) {
    if (other && meets(logo.box, other)) note('logo', `${where} : le logo de « ${entry.name} » touche ${what}`);
  }
}

// Fait défiler chaque ligne (ou carte) jusqu'à l'écran, une à une : une image ne se charge que lorsqu'elle est visible (js/annuaire/annuaire-images.js), la liste mesure 400 px de haut.
async function scrollThrough(page, selector) {
  const count = await page.run(sel => document.querySelectorAll(sel).length, selector);
  for (let at = 0; at < count; at++) {
    await page.run((sel, index) => document.querySelectorAll(sel)[index].scrollIntoView({ block: 'center' }), selector, at);
    await delay(120);
  }
  await delay(300);
  await page.run(sel => document.querySelectorAll(sel)[0].scrollIntoView({ block: 'center' }), selector);
}

async function readProblems(page, t, note, click, { width, mode, language }) {
  const tag = `${width} px (${mode})`;
  await reload(page, `?lang=${language}&images=1`, { width, mode, language });
  await scrollThrough(page, '.mod.an .an-person');
  const arrived = await page.until(() => document.querySelectorAll('.mod.an .an-person .an-av.has-img').length >= 3, [], 8000).catch(() => false);
  if (!arrived) note('photo', `la liste à ${tag} : les photos ne sont pas venues`);
  await delay(150);
  const list = await page.run(imagesSnap);
  const byRow = Object.fromEntries(list.rows.map(entry => [entry.row, entry]));
  for (const [row, kind] of Object.entries({ ...wanted, 5: 'none', 6: 'none' })) {
    if (!byRow[row]) { note('photo', `la liste à ${tag} : la ligne ${row} manque`); continue; }
    avatarProblems(byRow[row], kind, note, `la liste à ${tag}`, 32);
  }
  if (list.stray) note('photo', `la liste à ${tag} écrit « null » ou « undefined »`);
  await click('[data-fk="v:cards"]');
  await delay(200);
  await scrollThrough(page, '.mod.an .an-pcard');
  await page.until(() => document.querySelectorAll('.mod.an .an-pcard .an-logo:not(.is-wait)').length >= 4, [], 8000).catch(() => note('logo', `les cartes à ${tag} : les logos ne sont pas venus`));
  const cards = await page.run(imagesSnap);
  const named = Object.fromEntries(cards.cards.map(entry => [entry.row, entry]));
  for (const [row, logo] of Object.entries({ 1: true, 2: true, 3: true, 4: true, 5: false, 6: false })) {
    if (!named[row]) { note('logo', `les cartes à ${tag} : la carte ${row} manque`); continue; }
    logoProblems(named[row], logo, note, `les cartes à ${tag}`);
    avatarProblems(named[row], wanted[row] || 'none', note, `les cartes à ${tag}`, 40);
  }
  await ficheProblems(page, note, click, tag);
  await orgProblems(page, note, click, tag);
  const downloads = (await page.run(imagesSnap)).downloads;
  const twice = downloads.filter((id, at) => downloads.indexOf(id) !== at);
  if (twice.length) note('téléchargement', `à ${tag} : des images sont téléchargées plus d'une fois (${[...new Set(twice)].join(', ')}) : la mémoire de session ne sert pas`);
  await click('[data-fk="v:list"]');
}

async function ficheProblems(page, note, click, tag) {
  if (!await click('[data-act="person"][data-row="1"]')) return;
  await delay(250);
  await page.until(() => document.querySelector('.an-side .an-fiche-head .an-logo:not(.is-wait)') !== null, [], 6000).catch(() => note('logo', `la fiche à ${tag} : le logo n'est pas venu`));
  const { fiche } = await page.run(imagesSnap);
  const where = `la fiche à ${tag}`;
  if (!fiche) { note('fiche', `${where} : la fiche de Camille ne s'ouvre pas`); return; }
  if (!fiche.av || !fiche.av.img || !fiche.av.img.ok) note('photo', `${where} : la photo de la fiche n'est pas posée`);
  else if (Math.abs(fiche.av.box.width - 48) > 1) note('photo', `${where} : l'avatar de la fiche mesure ${Math.round(fiche.av.box.width)} px (48 attendus)`);
  if (!fiche.logo || !fiche.logo.img || !fiche.logo.img.ok) { note('logo', `${where} : le logo de la direction n'est pas posé`); return; }
  if (!inside(fiche.logo.box, fiche.card)) note('logo', `${where} : le logo sort de la fiche`);
  if (fiche.name && meets(fiche.logo.box, fiche.name.box)) note('logo', `${where} : le logo touche le nom`);
  if (fiche.sub && meets(fiche.logo.box, fiche.sub.box)) note('logo', `${where} : le logo touche le poste`);
  if (fiche.av && meets(fiche.logo.box, fiche.av.box)) note('logo', `${where} : le logo touche la photo`);
  if (fiche.close && meets(fiche.logo.box, fiche.close)) note('logo', `${where} : le logo touche la croix de la fiche`);
  if (fiche.sideways > 1) note('défile de côté', `${where} défile de côté (${fiche.sideways} px)`);
  await click('[data-fk="side-x"]');
}

// L'organigramme : le logo d'un niveau (les directions), posé sur le bord haut de sa carte sans couvrir le titre.
async function orgProblems(page, note, click, tag) {
  if (!await click('[data-fk="v:org"]')) return;
  await delay(400);
  await page.until(() => document.querySelectorAll('.mod.an .an-oc .an-logo:not(.is-wait)').length >= 1, [], 6000).catch(() => {});
  const { org, orgArea } = await page.run(imagesSnap);
  const where = `l'organigramme à ${tag}`;
  const logos = org.filter(card => card.logo);
  if (logos.length < 2) { note('logo', `${where} : ${logos.length} carte(s) portent un logo (les deux directions attendues)`); return; }
  for (const card of logos) {
    const logo = card.logo;
    if (!logo.img || !logo.img.ok) note('logo', `${where} : le logo de la carte « ${card.title ? card.title.text : card.id} » n'est pas venu`);
    if (card.title && card.title.lines.some(line => meets(logo.box, line))) note('logo', `${where} : le logo couvre le texte du titre « ${card.title.text} »`);
    if (logo.box.right > card.box.right + 1 || logo.box.left < card.box.left - 1) note('logo', `${where} : le logo de « ${card.title ? card.title.text : card.id} » sort de sa carte sur le côté`);
    // une carte à moitié hors de la zone qui défile est coupée par elle, c'est normal : seule une carte entière doit garder son logo dans la zone
    if (orgArea && inside(card.box, orgArea, 2) && !inside(logo.box, orgArea, 2)) note('logo', `${where} : le logo de « ${card.title ? card.title.text : card.id} » sort de la zone`);
  }
}

// ---------- « Modifier » : la photo ----------

async function openEdit(page, note, click, where) {
  if (!await click('[data-fk="pe:1"]')) return false;
  await delay(200);
  if (!await click('.an-side [data-fk="edit"]')) { note('photo', `${where} : la fiche n'a pas son bouton « Modifier »`); return false; }
  await delay(300);
  return page.run(() => document.querySelector('.mod.an-edit') !== null);
}

// « Choisir une image… » : un vrai clic à la souris demande le sélecteur de fichiers (une écoute le retient, il n'existe pas sans écran), puis la page pose le fichier dans la case.
// Rend le poids de l'original.
async function choose(page, click, note, where, ...picture) {
  await page.run(() => {
    const input = document.querySelector('[data-fk="ed-file-input"]');
    if (window.__fileAsked === undefined || !input.dataset.watched) {
      window.__fileAsked = 0;
      input.dataset.watched = '1';
      input.addEventListener('click', event => { event.preventDefault(); window.__fileAsked += 1; });
    }
  });
  const before = await page.run(() => window.__fileAsked);
  await click('[data-fk="ef:@photo"]');
  if (await page.run(() => window.__fileAsked) !== before + 1) note('photo', `${where} : le bouton ne demande pas le sélecteur de fichiers`);
  return page.run(feedPicture, ...picture);
}

// Du formulaire à la relecture : le pied change de hauteur quand le texte du pied change (le bouton glisse de quelques pixels) ; un clic qui tombe pendant ce glissement est repris.
async function toReview(page, click, note, where) {
  await delay(250);
  for (let attempt = 0; attempt < 3; attempt++) {
    await click('[data-fk="ed-next"]');
    if (await page.until(() => document.querySelector('.mod.an-edit .an-ed-review') !== null, [], 1500).catch(() => false)) return true;
  }
  note('photo', `${where} : la relecture ne s'ouvre pas`);
  return false;
}

const updates = batches => batches.flat().filter(action => action[0] === 'UpdateRecord' || action[0] === 'BulkAddRecord');

function startProblems(snap, t, note, where) {
  if (!snap) { note('photo', `${where} : la fenêtre « Modifier » ne s'ouvre pas`); return false; }
  if (snap.label !== t('an.set.avatar')) { note('photo', `${where} : la ligne « ${t('an.set.avatar')} » manque (${snap.label})`); return false; }
  if (snap.buttons.map(button => button.text).join('|') !== [t('an.img.replace'), t('an.img.remove')].join('|')) {
    note('photo', `${where} : les boutons disent « ${snap.buttons.map(button => button.text).join(' | ')} » (« ${t('an.img.replace')} | ${t('an.img.remove')} » attendu)`);
  }
  if (snap.hint !== t('an.img.hint')) note('photo', `${where} : l'aide dit « ${snap.hint} »`);
  if (!snap.img || !snap.img.ok) note('photo', `${where} : l'aperçu de la photo de la fiche n'est pas posé`);
  if (!inside(snap.row, snap.body, 2)) note('photo', `${where} : la ligne « Photo » sort du formulaire`);
  if (snap.sideways > 1) note('défile de côté', `${where} : le formulaire défile de côté (${snap.sideways} px)`);
  for (const button of snap.buttons) if (button.box.height < 24 || button.disabled) note('photo', `${where} : « ${button.text} » est trop petit ou grisé`);
  if (snap.stray) note('photo', `${where} : la fenêtre écrit « null » ou « undefined »`);
  return true;
}

async function writeProblems(page, t, note, click, { width, mode, language }) {
  const where = `la photo de « Modifier » à ${width} px (${mode})`;
  await reload(page, `?lang=${language}&images=1`, { width, mode, language });
  await page.until(() => document.querySelectorAll('.mod.an .an-person .an-av.has-img').length >= 1, [], 8000).catch(() => {});
  if (!await openEdit(page, note, click, where)) return;
  await page.until(() => document.querySelector('.mod.an-edit .an-ed-photo img') !== null, [], 6000).catch(() => {});
  if (!startProblems(await page.run(photoSnap), t, note, where)) return;
  // « Retirer » : l'aperçu retombe sur les initiales, le bouton devient « Choisir… », un changement est compté.
  await click('[data-fk="er:@photo"]');
  await delay(150);
  let snap = await page.run(photoSnap);
  if (snap.img || snap.initials !== 'CD') note('photo', `${where} : « ${t('an.img.remove')} » ne rend pas les initiales « CD » (${snap.initials})`);
  if (snap.buttons.map(button => button.text).join('|') !== t('an.img.choose')) note('photo', `${where} : après « ${t('an.img.remove')} » les boutons disent « ${snap.buttons.map(button => button.text).join(' | ')} »`);
  if (snap.note !== t('an.edit.count', { n: 1 })) note('photo', `${where} : le pied dit « ${snap.note} » (« ${t('an.edit.count', { n: 1 })} » attendu)`);
  const original = await choose(page, click, note, where, PICTURE, 1600, 1200, 'image/jpeg');
  await page.until(() => document.querySelector('.mod.an-edit .an-ed-photo img') !== null, [], 6000).catch(() => note('photo', `${where} : l'image choisie n'apparaît pas`));
  snap = await page.run(photoSnap);
  if (snap.hint !== t('an.img.picked', { name: REDUCED })) note('photo', `${where} : l'aide dit « ${snap.hint} » (« ${t('an.img.picked', { name: REDUCED })} » attendu)`);
  if (snap.buttons.map(button => button.text).join('|') !== [t('an.img.replace'), t('an.img.remove')].join('|')) note('photo', `${where} : après le choix, les boutons disent « ${snap.buttons.map(button => button.text).join(' | ')} »`);
  if (!snap.img || !snap.img.ok || !inside(snap.img.box, snap.avatar)) note('photo', `${where} : l'aperçu de l'image choisie ne tient pas dans son rond`);
  if ((await page.run(() => window.__annuaireUploaded.length)) !== 0 || updates(await page.run(() => window.__annuaireBatches())).length) note('photo', `${where} : rien ne devait partir avant le dernier bouton`);
  // La relecture, puis l'écriture.
  await toReview(page, click, note, where);
  snap = await page.run(photoSnap);
  const change = snap.review.find(each => each.label === t('an.set.avatar'));
  if (!change || change.was !== t('an.img.current') || change.now !== REDUCED) note('photo', `${where} : la relecture dit ${JSON.stringify(change)} (« ${t('an.img.current')} » puis « ${REDUCED} » attendu)`);
  await click('[data-fk="ed-next"]');
  await page.until(() => document.querySelector('.mod.an-edit') === null, [], 6000).catch(() => note('photo', `${where} : la fenêtre reste ouverte après « ${t('an.edit.save')} »`));
  await delay(300);
  const sent = await page.run(() => window.__annuaireUploaded);
  if (sent.length !== 1) { note('photo', `${where} : ${sent.length} envoi(s) (un attendu)`); return; }
  const [file] = sent;
  if (file.name !== REDUCED || file.type !== 'image/jpeg') note('photo', `${where} : l'envoi est « ${file.name} » (${file.type}) ; « ${REDUCED} » en JPEG attendu`);
  if (Math.max(file.width, file.height) !== 512) note('photo', `${where} : l'image envoyée mesure ${file.width} × ${file.height} (512 pixels de grand côté attendus)`);
  if (file.size >= original) note('photo', `${where} : l'image envoyée (${file.size} octets) n'est pas plus légère que l'original (${original})`);
  const written = updates(await page.run(() => window.__annuaireBatches()));
  if (JSON.stringify(written) !== JSON.stringify([['UpdateRecord', 'Personnes', 1, { Photo: ['L', file.id] }]])) note('photo', `${where} : Grist a reçu ${JSON.stringify(written)} (une seule UpdateRecord qui cite la pièce jointe ${file.id} attendue)`);
  const open = (await page.run(imagesSnap)).fiche;
  if (open && (!open.av || !open.av.img || !open.av.img.ok)) note('photo', `${where} : la fiche ne montre pas la nouvelle photo`);
  if (open) { await click('[data-fk="side-x"]'); await delay(200); }
  await scrollThrough(page, '.mod.an .an-person');
  const after = await page.run(imagesSnap);
  const row = after.rows.find(entry => entry.row === '1');
  if (!row || !row.av || !row.av.img || !row.av.img.ok) note('photo', `${where} : la liste ne montre pas la nouvelle photo`);
  if (after.downloads.includes(file.id)) note('téléchargement', `${where} : la photo envoyée a été retéléchargée (elle est gardée en mémoire sous son numéro)`);
}

// Un envoi que Grist refuse : dit tel quel, rien n'est écrit, la fenêtre reste ouverte ; puis un fichier qui n'est pas une image ; puis Échap.
async function refusalProblems(page, t, note, click, { width, mode, language }) {
  const where = `le refus de l'envoi à ${width} px (${mode})`;
  await reload(page, `?lang=${language}&images=1&uploadfail=${encodeURIComponent('Grist refuse')}`, { width, mode, language });
  if (!await openEdit(page, note, click, where)) return;
  await choose(page, click, note, where, 'note.txt', 10, 10, 'text/plain');
  await delay(300);
  const text = await page.run(photoSnap);
  if (text.note !== t('an.img.unreadable', { name: 'note.txt' }) || !text.warn) note('photo', `${where} : un fichier qui n'est pas une image dit « ${text.note} » (« ${t('an.img.unreadable', { name: 'note.txt' })} » attendu)`);
  if (text.next.disabled === false) note('photo', `${where} : « ${text.next.text} » est ouvert alors que rien n'a changé`);
  await choose(page, click, note, where, PICTURE, 900, 900, 'image/jpeg');
  await page.until(() => document.querySelector('.mod.an-edit .an-ed-photo .an-av img') !== null, [], 6000).catch(() => {});
  await toReview(page, click, note, where);
  await click('[data-fk="ed-next"]');
  await page.until(() => { const foot = document.querySelector('.mod.an-edit .mod-note'); return !foot || foot.textContent.trim() !== ''; }, [], 4000).catch(() => {});
  const snap = await page.run(photoSnap);
  if (!snap) { note('photo', `${where} : la fenêtre se ferme malgré le refus de l'envoi`); return; }
  const wantedText = t('an.img.uploadFailed', { name: REDUCED, reason: 'Grist refuse' });
  if (snap.note !== wantedText || !snap.warn) note('photo', `${where} : le pied dit « ${snap.note} » (« ${wantedText} » attendu)`);
  if (snap.next.disabled) note('photo', `${where} : « ${snap.next.text} » reste grisé après le refus : impossible de réessayer`);
  if ((await page.run(() => window.__annuaireUploaded.length)) !== 0 || updates(await page.run(() => window.__annuaireBatches())).length) note('photo', `${where} : quelque chose a été écrit malgré le refus`);
  await page.press('Escape');
  await delay(150);
  if (await page.run(() => document.querySelector('.mod.an-edit') !== null)) { await click('[data-fk="ed-cancel"]'); await delay(150); await click('[data-fk="ed-cancel"]'); }
  if (updates(await page.run(() => window.__annuaireBatches())).length) note('photo', `${where} : Annuler a écrit quelque chose`);
}

// « Ajouter » : la même ligne « Photo », une fiche préparée avec son image, une seule `BulkAddRecord` qui cite la pièce jointe.
async function addProblems(page, t, note, click, { width, mode, language }) {
  const where = `la photo d'« Ajouter » à ${width} px (${mode})`;
  await reload(page, `?lang=${language}&images=1`, { width, mode, language });
  if (!await click('[data-fk="add"]')) { note('photo', `${where} : le bouton « Ajouter » manque`); return; }
  await delay(300);
  const start = await page.run(photoSnap);
  if (!start || start.label !== t('an.set.avatar')) { note('photo', `${where} : la ligne « Photo » manque (${start && start.label})`); return; }
  if (start.buttons.map(button => button.text).join('|') !== t('an.img.choose')) note('photo', `${where} : sans photo, les boutons disent « ${start.buttons.map(button => button.text).join(' | ')} » (« ${t('an.img.choose')} » seul attendu)`);
  if (start.initials !== '') note('photo', `${where} : une fiche vide montre « ${start.initials} » à la place d'un rond vide`);
  await click('[data-fk="ef:name"]');
  await page.press(...'Zoé Petit'.split(''));
  await choose(page, click, note, where, 'zoe.jpeg', 800, 600, 'image/jpeg');
  await page.until(() => document.querySelector('.mod.an-edit .an-ed-photo .an-av img') !== null, [], 6000).catch(() => note('photo', `${where} : l'image choisie n'apparaît pas`));
  await toReview(page, click, note, where);
  await click('[data-fk="ed-next"]');
  await page.until(() => document.querySelector('.mod.an-edit') === null, [], 6000).catch(() => note('photo', `${where} : la fenêtre reste ouverte après l'ajout`));
  const sent = await page.run(() => window.__annuaireUploaded);
  const added = (await page.run(() => window.__annuaireBatches())).flat().filter(action => action[0] === 'BulkAddRecord' && action[1] === 'Personnes');
  if (sent.length !== 1 || sent[0].name !== 'zoe.jpg' || Math.max(sent[0].width, sent[0].height) !== 512) note('photo', `${where} : l'envoi est ${JSON.stringify(sent)} (« zoe.jpg » de 512 pixels attendu)`);
  const columns = added.length === 1 ? added[0][3] : null;
  if (!columns || JSON.stringify(columns.Photo) !== JSON.stringify([['L', sent[0] && sent[0].id]]) || JSON.stringify(columns.Nom) !== JSON.stringify(['Zoé Petit'])) {
    note('photo', `${where} : Grist a reçu ${JSON.stringify(added)} (une seule BulkAddRecord avec « Zoé Petit » et sa photo attendue)`);
  }
}

export async function imagesProblems(page, t, note, click, view) {
  await readProblems(page, t, note, click, view);
  await writeProblems(page, t, note, click, view);
  await refusalProblems(page, t, note, click, view);
  await addProblems(page, t, note, click, view);
}
