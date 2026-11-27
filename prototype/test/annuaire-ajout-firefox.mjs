// La fenêtre « Ajouter des personnes » de l'annuaire sous Firefox (règle du 03/11 ; module Annuaire, choix du porteur, 27/11 : « Plusieurs à la suite, un seul ajout »), à la vraie souris
// et au vrai clavier, sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js). Suite de test/annuaire-firefox.mjs ; l'essai écrit dans le faux Grist. À mesurer :
// - le bouton « Ajouter » de la barre : ouvert pour un administrateur, grisé avec sa raison pour les autres et dans la liste fusionnée (jamais masqué), un clic sur le grisé qui redit la
//   raison dans le pied ; il tient dans la barre sans chevaucher les autres boutons ;
// - la fenêtre : la fiche vide (les champs de « Modifier »), la rangée des fiches préparées (une pastille, sa croix grisée tant qu'il n'en reste qu'une, « Ajouter une autre personne »),
//   collée en haut quand le formulaire défile, le pied qui compte les personnes prêtes, « Relire les ajouts » grisé tant que rien n'est saisi ;
// - la pastille qui prend le nom à la frappe, une seconde fiche à vide, le retour à la première avec sa saisie, une fiche retirée ;
// - ce qui empêche de relire : une adresse déjà dans l'annuaire (dite avec le nom de la personne, la fiche en cause s'ouvre, son champ est marqué), une fiche sans nom ;
// - la relecture : une carte par fiche, le nom déjà pris signalé, le bouton qui dit combien de personnes s'ajoutent, « Retour » qui garde tout ;
// - l'écriture : une seule `BulkAddRecord`, rien que les colonnes saisies ; un refus de Grist dit tel quel (la fenêtre reste, on peut réessayer) ; la liste relue et le pied qui le dit ; Échap n'écrit rien.
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';
import { typeInto, pickFrom } from './annuaire-edit-firefox.mjs';

const PROBES = { 'une pastille': ['.an-ed-draft-b', '.an-ed-drafts'], 'la pastille en cours': ['.an-ed-draft.is-current .an-ed-draft-b', '.an-ed-draft.is-current'],
  'la raison du pied': ['.mod-note', '.an-edit'] };
const REVIEW_PROBES = { 'le nom d\'une fiche': ['.an-ed-new h3', '.an-edit'], 'un nom déjà pris': ['.an-ed-warn', '.an-edit'], 'une valeur': ['.an-ed-now', '.an-ed-change'] };

// ---------- ce qui s'exécute dans la page ----------

function addSnap() {
  const win = document.querySelector('.mod.an-edit');
  if (!win) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const body = win.querySelector('.an-ed-body');
  const row = win.querySelector('.an-ed-drafts');
  const next = win.querySelector('[data-fk="ed-next"]');
  const note = win.querySelector('.mod-note');
  const intro = win.querySelector('.an-ed-intro');
  return { box: box(win), viewport: { width: innerWidth, height: innerHeight }, title: text(win.querySelector('h2')), who: text(win.querySelector('.an-ed-who')), sideways: body.scrollWidth - body.clientWidth,
    body: box(body), head: box(win.querySelector('.mod-head')), foot: box(win.querySelector('.mod-foot')),
    drafts: row ? { box: box(row), label: row.getAttribute('aria-label'), items: [...row.querySelectorAll('.an-ed-draft')].map(item => ({ text: text(item.querySelector('.an-ed-draft-b')),
      current: item.classList.contains('is-current'), pressed: item.querySelector('.an-ed-draft-b').getAttribute('aria-pressed') === 'true', box: box(item),
      remove: { disabled: item.querySelector('.an-ib').getAttribute('aria-disabled') === 'true', box: box(item.querySelector('.an-ib')), fk: item.querySelector('.an-ib').dataset.fk } })),
    add: (button => ({ text: text(button), box: box(button) }))(row.querySelector('[data-fk="ed-draft-add"]')) } : null,
    rows: [...win.querySelectorAll('.an-set-row')].map(each => ({ label: text(each.querySelector('.an-set-label')), locked: each.classList.contains('an-ed-locked'),
      fk: (each.querySelector('[data-fk^="ef:"]') || { dataset: {} }).dataset.fk || null, value: each.querySelector('input') ? each.querySelector('input').value : text(each.querySelector('.an-set-control')),
      invalid: each.querySelector('[aria-invalid="true"]') !== null })),
    cards: [...win.querySelectorAll('.an-ed-new')].map(card => ({ name: text(card.querySelector('h3')), rows: [...card.querySelectorAll('.an-ed-change')].map(change => [text(change.querySelector('dt')),
      text(change.querySelector('dd'))]), warns: [...card.querySelectorAll('.an-ed-warn')].map(text), box: box(card) })),
    intro: intro ? text(intro) : '', note: text(note), warn: note.classList.contains('is-warn'), next: { text: text(next), disabled: next.getAttribute('aria-disabled') === 'true', box: box(next) },
    cancel: text(win.querySelector('[data-fk="ed-cancel"]')), focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null,
    scroll: { top: body.scrollTop, max: body.scrollHeight - body.clientHeight } };
}

function toolSnap() {
  const crumb = document.querySelector('.an-crumb');
  const button = crumb && crumb.querySelector('[data-fk="add"]');
  if (!button) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  return { text: button.textContent.trim(), textShown: getComputedStyle(button.querySelector('.an-tb-t')).display !== 'none', title: button.title, label: button.getAttribute('aria-label'),
    disabled: button.getAttribute('aria-disabled') === 'true', box: box(button), crumb: box(crumb), others: [...crumb.querySelectorAll('button')].filter(each => each !== button)
      .map(each => ({ fk: each.dataset.fk || '', box: box(each) })), foot: document.querySelector('.an-foot') ? document.querySelector('.an-foot').textContent.trim() : '',
    modal: document.querySelector('.mod.an-edit') !== null };
}

const rowsIn = () => [...document.querySelectorAll('.an-person, .an-pcard')].map(row => row.textContent.replace(/\s+/g, ' ').trim());
const batchesIn = () => JSON.parse(JSON.stringify(window.__annuaireBatches()));

// ---------- les mesures ----------

const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;
const apart = (a, b) => a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1;

export async function reload(page, query, { width, mode }) {
  await page.goto(`${await page.run(() => `${location.origin}${location.pathname}`)}${query}`);
  await page.run(() => window.__ready);
  await page.view({ width, scale: 1, mode });
  await page.run(() => void window.__annuaire.open());
  await page.until(() => document.querySelector('.mod.an .an-person, .mod.an .an-pcard') !== null);
  await delay(200);
}

// Le bouton de la barre : sa place, son texte, ce qu'il dit quand il est grisé.
function toolProblems(snap, note, t, where, { disabled, why }) {
  if (!snap) { note('ajout', `${where} : le bouton « ${t('an.add')} » manque dans la barre de la liste`); return; }
  if (snap.disabled !== disabled) note('ajout', `${where} : le bouton est ${snap.disabled ? 'grisé' : 'ouvert'} (${disabled ? 'grisé' : 'ouvert'} attendu)`);
  const wanted = disabled ? why : t('an.add.tip');
  if (snap.title !== wanted || snap.label !== wanted) note('ajout', `${where} : le bouton dit « ${snap.title} » (« ${wanted} » attendu)`);
  if (snap.textShown && snap.text !== t('an.add')) note('ajout', `${where} : le bouton écrit « ${snap.text} » (« ${t('an.add')} » attendu)`);
  if (snap.box.height < 24) note('cible', `${where} : le bouton « ${t('an.add')} » ne mesure que ${Math.round(snap.box.height)} px de haut (24 au moins)`);
  if (!inside(snap.box, snap.crumb)) note('hors de la page', `${where} : le bouton « ${t('an.add')} » sort de la barre de la liste`);
  for (const other of snap.others) if (!apart(snap.box, other.box)) note('ajout', `${where} : le bouton « ${t('an.add')} » chevauche le bouton ${other.fk || 'voisin'}`);
}

// La fenêtre telle qu'elle s'ouvre : la fiche vide, une seule pastille, le pied qui demande un nom.
function startProblems(snap, t, note, where) {
  if (snap.title !== t('an.add.title')) note('ajout', `${where} : le titre dit « ${snap.title} » (« ${t('an.add.title')} » attendu)`);
  if (snap.who !== 'Annuaire principal') note('ajout', `${where} : la tête nomme « ${snap.who} » (l'annuaire : « Annuaire principal »)`);
  if (!inside(snap.box, { left: 0, top: 0, right: snap.viewport.width, bottom: snap.viewport.height })) note('hors de la page', `${where} : la fenêtre sort de la page`);
  if (snap.sideways > 1) note('ajout', `${where} : la fenêtre défile de côté (${snap.sideways} px)`);
  if (snap.head.bottom > snap.body.top + 1 || snap.body.bottom > snap.foot.top + 1) note('ajout', `${where} : le titre, le corps et le pied se chevauchent`);
  const row = snap.drafts;
  if (!row || row.items.length !== 1) { note('ajout', `${where} : la rangée des fiches préparées n'a pas une seule pastille`); return; }
  const [first] = row.items;
  if (first.text !== t('an.add.draft') || !first.current || !first.pressed) note('ajout', `${where} : la première pastille dit « ${first.text} » (« ${t('an.add.draft')} », ouverte, attendu)`);
  if (!first.remove.disabled) note('ajout', `${where} : la croix de la seule fiche devrait être grisée (jamais masquée)`);
  if (first.remove.box.height < 24 || first.box.height < 24) note('cible', `${where} : la pastille ou sa croix mesure moins de 24 px de haut`);
  if (snap.drafts.add.text !== t('an.add.another')) note('ajout', `${where} : le bouton dit « ${snap.drafts.add.text} » (« ${t('an.add.another')} » attendu)`);
  if (snap.drafts.add.box.height < 24) note('cible', `${where} : « ${t('an.add.another')} » mesure ${Math.round(snap.drafts.add.box.height)} px de haut (24 au moins)`);
  if (!inside(snap.drafts.box, snap.body, 2)) note('hors de la page', `${where} : la rangée des fiches sort du corps de la fenêtre`);
  const fields = snap.rows.filter(each => each.fk && !each.locked);
  if (fields.length < 5) note('ajout', `${where} : seulement ${fields.length} champs (ceux de « Modifier » attendus)`);
  const typed = snap.rows.filter(each => each.fk && /^ef:(name|title|email|phone)$/.test(each.fk) && each.value !== '');
  if (typed.length) note('ajout', `${where} : la fiche n'est pas vide (« ${typed[0].label} » dit « ${typed[0].value} »)`);
  if (snap.note !== t('an.add.nothing')) note('ajout', `${where} : le pied dit « ${snap.note} » (« ${t('an.add.nothing')} » attendu)`);
  if (!snap.next.disabled || snap.next.text !== t('an.add.review')) note('ajout', `${where} : « ${snap.next.text} » devrait être grisé tant que rien n'est saisi`);
  if (snap.focused !== 'ef:name') note('clavier', `${where} : le clavier est sur « ${snap.focused} » (« ef:name » attendu)`);
}

async function readable(page, note, where, probes) {
  for (const [what, value] of Object.entries(await page.run(contrasts, probes))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
}

// La rangée collée en haut : le corps défile, la rangée reste à sa place.
async function stickyProblems(page, note, where, snapNow) {
  await page.run(() => { const body = document.querySelector('.mod.an-edit .an-ed-body'); body.scrollTop = body.scrollHeight; });
  await delay(150);
  const snap = await snapNow();
  if (snap.scroll.max > 1 && Math.abs(snap.drafts.box.top - snap.body.top) > 3) note('ajout', `${where} : la rangée des fiches ne reste pas en haut quand le formulaire défile (à ${Math.round(snap.drafts.box.top - snap.body.top)} px)`);
  await page.run(() => { document.querySelector('.mod.an-edit .an-ed-body').scrollTop = 0; });
  await delay(100);
}

// Préparer des fiches : la frappe, une seconde fiche, le retour à la première.
async function draftsProblems(page, t, note, click, snapNow, where) {
  await typeInto(page, click, 'ef:name', 'Mireille Vasseur');
  let snap = await snapNow();
  if (snap.drafts.items[0].text !== 'Mireille Vasseur') note('ajout', `${where} : la pastille dit « ${snap.drafts.items[0].text} » après la frappe (« Mireille Vasseur » attendu)`);
  if (snap.note !== t('an.add.count', { n: 1 }) || snap.next.disabled) note('ajout', `${where} : le pied dit « ${snap.note} » (« ${t('an.add.count', { n: 1 })} » attendu, relecture ouverte)`);
  await click('[data-fk="ed-draft-add"]');
  await delay(150);
  snap = await snapNow();
  const [one, two] = snap.drafts.items;
  if (snap.drafts.items.length !== 2 || !two.current || one.current) note('ajout', `${where} : « ${t('an.add.another')} » n'ouvre pas une seconde fiche (${snap.drafts.items.length} pastilles)`);
  if (two && two.text !== t('an.add.draftN', { n: 2 })) note('ajout', `${where} : la seconde pastille dit « ${two.text} » (« ${t('an.add.draftN', { n: 2 })} » attendu)`);
  if (one && one.remove.disabled) note('ajout', `${where} : la croix ne s'ouvre pas quand il y a deux fiches`);
  if (snap.focused !== 'ef:name' || snap.rows.find(each => each.fk === 'ef:name').value !== '') note('ajout', `${where} : la seconde fiche n'est pas vide, ou le clavier n'est pas sur son nom`);
  if (snap.note !== t('an.add.count', { n: 1 })) note('ajout', `${where} : une fiche vide compte pour une personne prête (« ${snap.note} »)`);
  await typeInto(page, click, 'ef:name', 'Octave Lenoir');
  await typeInto(page, click, 'ef:title', 'Directeur adjoint');
  await typeInto(page, click, 'ef:email', 'camille.durand@exemple.fr');
  await click('[data-fk="ed-draft:0"]');
  await delay(150);
  snap = await snapNow();
  if (snap.rows.find(each => each.fk === 'ef:name').value !== 'Mireille Vasseur' || !snap.drafts.items[0].current) note('ajout', `${where} : revenir à la première fiche ne la rend pas telle qu'elle était`);
  if (snap.note !== t('an.add.count', { n: 2 })) note('ajout', `${where} : le pied dit « ${snap.note} » (« ${t('an.add.count', { n: 2 })} » attendu)`);
}

// Ce qui empêche de relire : l'adresse déjà prise (la fiche en cause s'ouvre), puis une fiche sans nom.
async function blockedProblems(page, t, note, click, snapNow, where) {
  await click('[data-fk="ed-next"]');
  await delay(150);
  let snap = await snapNow();
  const said = t('an.add.dupEmailDir', { email: 'camille.durand@exemple.fr', name: 'Camille Durand' });
  const mail = snap.rows.find(each => each.fk === 'ef:email');
  if (snap.title !== t('an.add.title') || snap.note !== said || !snap.warn) note('ajout', `${where} : l'adresse déjà prise n'est pas dite comme il faut (pied « ${snap.note} »)`);
  if (!snap.drafts.items[1].current || !mail.invalid) note('ajout', `${where} : la fiche en cause ne s'ouvre pas, ou son champ n'est pas marqué`);
  await typeInto(page, click, 'ef:email', 'octave.lenoir@exemple.fr');
  await click('[data-fk="ed-draft-add"]');
  await pickFrom(page, click, note, 'ef:Contrat', 'Stagiaire', where);
  await click('[data-fk="ed-next"]');
  await delay(150);
  snap = await snapNow();
  if (snap.note !== t('an.edit.errName') || !snap.warn || !snap.drafts.items[2].current || !snap.rows.find(each => each.fk === 'ef:name').invalid) {
    note('ajout', `${where} : une fiche sans nom n'est pas refusée comme il faut (pied « ${snap.note} »)`);
  }
  await typeInto(page, click, 'ef:name', 'Camille Durand');
}

// La relecture : une carte par fiche, le nom déjà pris signalé ; « Retour » garde tout ; une fiche retirée change le compte.
async function reviewProblems(page, t, note, click, snapNow, where, { mode }) {
  await click('[data-fk="ed-next"]');
  await delay(200);
  let snap = await snapNow();
  if (snap.title !== t('an.add.reviewTitle') || snap.cards.length !== 3) { note('ajout', `${where} : la relecture montre ${snap.cards.length} cartes (trois attendues)`); return; }
  if (snap.intro !== t('an.add.reviewText', { n: 3, table: 'Personnes' })) note('ajout', `${where} : l'intro dit « ${snap.intro} »`);
  if (snap.next.text !== t('an.add.go', { n: 3 }) || snap.cancel !== t('an.edit.back')) note('ajout', `${where} : les boutons disent « ${snap.cancel} » et « ${snap.next.text} » (« ${t('an.add.go', { n: 3 })} » attendu)`);
  if (snap.cards.map(card => card.name).join('|') !== 'Mireille Vasseur|Octave Lenoir|Camille Durand') note('ajout', `${where} : les cartes sont « ${snap.cards.map(card => card.name).join(' | ')} »`);
  if (snap.cards[2].warns.join('') !== t('an.add.dupNameDir', { name: 'Camille Durand' })) note('ajout', `${where} : le nom déjà pris n'est pas signalé (« ${snap.cards[2].warns.join('')} »)`);
  if (snap.cards[0].warns.length || snap.cards[1].warns.length) note('ajout', `${where} : une fiche sans doublon est signalée`);
  if (!snap.cards[1].rows.some(([label, value]) => value === 'Directeur adjoint' && label.length > 0)) note('ajout', `${where} : la carte d'Octave Lenoir ne dit pas son poste`);
  if (snap.sideways > 1 || snap.cards.some(card => !inside(card.box, snap.body, 2) && card.box.width > snap.body.width)) note('ajout', `${where} : la relecture défile de côté`);
  await readable(page, note, `la relecture des ajouts (${mode})`, REVIEW_PROBES);
  await click('[data-fk="ed-cancel"]');
  await delay(150);
  snap = await snapNow();
  if (snap.title !== t('an.add.title') || snap.drafts.items.length !== 3 || snap.drafts.items.map(item => item.text).join('|') !== `Mireille Vasseur|Octave Lenoir|Camille Durand`) {
    note('ajout', `${where} : « Retour » ne rend pas les trois fiches (${snap.drafts.items.map(item => item.text).join(' | ')})`);
  }
  await click('[data-fk="ed-draft-x:2"]');
  await delay(150);
  snap = await snapNow();
  if (snap.drafts.items.length !== 2 || !snap.drafts.items[1].current) note('ajout', `${where} : la croix ne retire pas la fiche (${snap.drafts.items.length} pastilles, la dernière ouverte attendue)`);
  await click('[data-fk="ed-next"]');
  await delay(200);
  snap = await snapNow();
  if (snap.cards.length !== 2 || snap.next.text !== t('an.add.go', { n: 2 }) || snap.cards.some(card => card.warns.length)) note('ajout', `${where} : la relecture de deux fiches dit « ${snap.next.text} », ${snap.cards.length} cartes`);
}

// L'écriture : Grist refuse (la phrase est dite, la fenêtre reste), puis accepte (une seule action, la liste relue, le pied le dit).
async function writeProblems(page, t, note, click, snapNow, where) {
  const before = (await page.run(batchesIn)).length;
  await page.run(() => { window.__annuaireRefuse = 'Accès refusé par les règles du document'; });
  await click('[data-fk="ed-next"]');
  await delay(300);
  let snap = await snapNow();
  const refused = t('an.add.refused', { reason: 'Accès refusé par les règles du document' });
  if (!snap) note('ajout', `${where} : la fenêtre s'est fermée alors que Grist a refusé`);
  else if (!snap.warn || snap.note !== refused || snap.next.disabled) note('ajout', `${where} : le refus de Grist n'est pas dit comme il faut (pied « ${snap.note} »)`);
  if ((await page.run(batchesIn)).length !== before) note('ajout', `${where} : un lot est parti malgré le refus`);
  await page.run(() => { window.__annuaireRefuse = null; });
  await click('[data-fk="ed-next"]');
  await delay(500);
  if (await snapNow()) { note('ajout', `${where} : la fenêtre reste ouverte après « ${t('an.add.go', { n: 2 })} »`); return; }
  const batches = (await page.run(batchesIn)).slice(before);
  const writes = batches.flat().filter(action => action[1] === 'Personnes');
  if (batches.length !== 1 || writes.length !== 1 || writes[0][0] !== 'BulkAddRecord' || writes[0][2].length !== 2) note('ajout', `${where} : le faux Grist a reçu ${JSON.stringify(batches)} (une seule BulkAddRecord de deux lignes attendue)`);
  const wanted = { Nom: ['Mireille Vasseur', 'Octave Lenoir'], Poste: ['', 'Directeur adjoint'], Email: ['', 'octave.lenoir@exemple.fr'] };
  if (JSON.stringify(Object.entries((writes[0] || [])[3] || {}).sort()) !== JSON.stringify(Object.entries(wanted).sort())) {
    note('ajout', `${where} : les colonnes écrites sont ${JSON.stringify((writes[0] || [])[3])} (${JSON.stringify(wanted)} attendu)`);
  }
  const rows = await page.run(rowsIn);
  for (const name of ['Mireille Vasseur', 'Octave Lenoir']) if (!rows.some(row => row.includes(name))) note('ajout', `${where} : « ${name} » n'est pas dans la liste relue`);
  const tool = await page.run(toolSnap);
  const done = t('an.add.done', { n: 2, names: 'Mireille Vasseur, Octave Lenoir' });
  if (!tool || !tool.foot.includes(done)) note('ajout', `${where} : le pied dit « ${tool && tool.foot} » (« ${done} » attendu)`);
}

// Échap ferme sans rien écrire, même avec une saisie.
async function escapeProblems(page, t, note, click, snapNow, where) {
  const before = (await page.run(batchesIn)).length;
  await click('[data-fk="add"]');
  await delay(250);
  await typeInto(page, click, 'ef:name', 'Personne Annulée');
  await page.press('Escape');
  await delay(200);
  if (await snapNow()) note('ajout', `${where} : Échap ne ferme pas la fenêtre`);
  if ((await page.run(batchesIn)).length !== before) note('ajout', `${where} : Échap a écrit quelque chose`);
  if ((await page.run(rowsIn)).some(row => row.includes('Personne Annulée'))) note('ajout', `${where} : une fiche annulée est dans la liste`);
}

// Pour qui n'administre pas, et dans la liste fusionnée : grisé avec sa raison ; un clic la redit dans le pied, sans fenêtre.
async function greyedProblems(page, t, note, click, view, query, why, label) {
  const where = `le bouton « ${t('an.add')} », ${label} (${view.width} px, ${view.mode})`;
  await reload(page, `?lang=${view.language}&${query}`, view);
  const tool = await page.run(toolSnap);
  toolProblems(tool, note, t, where, { disabled: true, why });
  if (!tool) return;
  await readable(page, note, where, { 'le bouton grisé': ['.an-addbtn[aria-disabled="true"]', '.an-crumb'] });
  await click('[data-fk="add"]');
  await delay(200);
  const after = await page.run(toolSnap);
  if (after.modal) note('ajout', `${where} : un clic sur le bouton grisé ouvre la fenêtre`);
  if (!after.foot.includes(why)) note('ajout', `${where} : le pied ne redit pas la raison (« ${after.foot} »)`);
}

export async function ajoutProblems(page, t, note, click, { width, mode, language }) {
  const view = { width, mode, language };
  const snapNow = () => page.run(addSnap);
  const where = `la fenêtre « ${t('an.add.title')} » à ${width} px (${mode})`;
  await reload(page, `?lang=${language}`, view);
  toolProblems(await page.run(toolSnap), note, t, `le bouton « ${t('an.add')} » à ${width} px (${mode})`, { disabled: false });
  await click('[data-fk="add"]');
  await delay(300);
  const start = await snapNow();
  if (!start) { note('ajout', 'le bouton « Ajouter » n\'ouvre pas la fenêtre'); return; }
  startProblems(start, t, note, where);
  await readable(page, note, `les pastilles (${mode})`, PROBES);
  await draftsProblems(page, t, note, click, snapNow, where);
  await stickyProblems(page, note, where, snapNow);
  await blockedProblems(page, t, note, click, snapNow, where);
  await reviewProblems(page, t, note, click, snapNow, where, { mode });
  await writeProblems(page, t, note, click, snapNow, where);
  await escapeProblems(page, t, note, click, snapNow, where);
  await greyedProblems(page, t, note, click, view, 'admin=0', t('an.add.whyAdmins'), 'une personne qui n\'administre pas');
  await greyedProblems(page, t, note, click, view, 'sub=1&home=merged', t('an.add.noMerged'), 'la liste fusionnée');
}
