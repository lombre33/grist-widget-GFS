// Les liens de l'annuaire avec les autres apps sous Firefox (règle du 03/11 ; module Annuaire, demande du porteur du 25/11, scène 15 de la maquette ; contrats 5.4, point 16), à la
// vraie souris et au vrai clavier, sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js, `?links=1&sub=1`). À mesurer : le bouton « Insérer dans… » de la fiche et
// son menu (une ligne par app, celle qu'il faut activer et celle qui ne sait pas encore sont grisées avec leur raison, un clic grisé ne part nulle part, une app choisie reçoit la personne
// et la fenêtre se referme, Échap range le menu) ; la fenêtre « Choisir une personne » qu'une app demande (« Tous mes annuaires » d'abord, la recherche, un seul choix, « Annuler », Échap,
// rien n'est rendu avant « Choisir », une seule fenêtre à la fois) ; qu'aucun clic n'écrit dans le document ; et la lisibilité (4,5:1) à 700, 520 et 400 px, en clair et en sombre.
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';

export const MENU_PROBES = { 'le titre du menu': ['.menu-title', '.menu'], 'une app': ['.menu-item:not([aria-disabled="true"]) .menu-label', '.menu'],
  'son repère': ['.menu-item:not([aria-disabled="true"]) .menu-hint', '.menu'], 'une app grisée': ['.menu-item[aria-disabled="true"] .menu-label', '.menu'],
  'son repère grisé': ['.menu-item[aria-disabled="true"] .menu-hint', '.menu'] };
export const PICK_PROBES = { 'le titre': ['.an-pk h2', '.an-pk'], 'le rappel': ['.an-pk .an-sub-of', '.an-pk'], 'un nom': ['.an-pk-row .an-pe-name', '.an-pk'], 'un poste': ['.an-pk-row .an-pe-sub', '.an-pk'],
  'un rattachement': ['.an-pk-path', '.an-pk'], 'la confidentialité': ['.an-pk-only', '.an-pk'], 'l\'annuaire': ['.an-pk-from-l', '.an-pk'], 'Choisir': ['.an-pk-foot .btn.primary', '.an-pk'] };

function installLib() {
  window.__lib = {
    box: node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; },
    text: node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : ''),
  };
}

function ficheSnap() {
  const { box, text } = window.__lib;
  const button = document.querySelector('[data-act="insert"]');
  const acts = document.querySelector('.an-fiche-acts');
  const side = document.querySelector('.an-side');
  return { button: button ? { box: box(button), label: text(button), aria: button.getAttribute('aria-haspopup'), title: button.title } : null,
    acts: acts ? { box: box(acts), sideways: acts.scrollWidth - acts.clientWidth } : null, side: side ? box(side) : null, viewport: { width: innerWidth, height: innerHeight },
    foot: text(document.querySelector('.an-foot')), open: document.querySelector('.mod.an') !== null };
}

function menuSnap() {
  const { box, text } = window.__lib;
  const menu = document.querySelector('.menu');
  if (!menu) return null;
  return { box: box(menu), viewport: { width: innerWidth, height: innerHeight }, title: text(menu.querySelector('.menu-title')),
    items: [...menu.querySelectorAll('.menu-item')].map(item => ({ label: text(item.querySelector('.menu-label')), hint: text(item.querySelector('.menu-hint')),
      greyed: item.getAttribute('aria-disabled') === 'true', tip: item.title, box: box(item) })), focused: document.activeElement ? text(document.activeElement.querySelector('.menu-label')) : '' };
}

function pickSnap() {
  const { box, text } = window.__lib;
  const modal = document.querySelector('.mod.an-pk');
  if (!modal) return null;
  const ok = modal.querySelector('.btn.primary');
  const from = modal.querySelector('.an-pk-from');
  const foot = modal.querySelector('.an-pk-foot');
  const list = modal.querySelector('.an-pk-list');
  return { box: box(modal), viewport: { width: innerWidth, height: innerHeight }, title: text(modal.querySelector('h2')), sub: text(modal.querySelector('.an-sub-of')),
    from: from ? text(from) : null, rows: [...modal.querySelectorAll('.an-pk-row')].map(row => ({ name: text(row.querySelector('.an-pe-name')), checked: row.getAttribute('aria-checked') === 'true',
      box: box(row), path: text(row.querySelector('.an-pk-path')) })), listBox: box(list), only: text(modal.querySelector('.an-pk-only')), note: text(modal.querySelector('.mod-note')),
    ok: { disabled: ok.getAttribute('aria-disabled') === 'true', box: box(ok) }, footBox: box(foot), problem: text(modal.querySelector('.an-pk-problem')),
    focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null, sideways: modal.scrollWidth - modal.clientWidth };
}

const writes = () => window.__annuaireBatches().flat();
const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;
const centered = box => [box.left + box.width / 2, box.top + box.height / 2];
const pageBox = viewport => ({ left: 0, top: 0, right: viewport.width, bottom: viewport.height });

async function reload(page, query, { width, mode }) {
  await page.goto(`${await page.run(() => `${location.origin}${location.pathname}`)}${query}`);
  await page.run(() => window.__ready);
  await page.view({ width, scale: 1, mode });
  await page.run(installLib);
}

async function openFiche(page, click) {
  await page.run(() => { void window.__annuaire.open(1); });
  await page.until(() => document.querySelector('.an-person') !== null);
  await click('.an-person');
  await page.until(() => document.querySelector('[data-act="insert"]') !== null).catch(() => null);
}

// ---------- le bouton et son menu ----------

async function buttonProblems(page, t, note, where) {
  const snap = await page.run(ficheSnap);
  if (!snap.button) { note('insérer', `${where} : la fiche n'a pas de bouton « ${t('an.link.insert')} »`); return false; }
  if (snap.button.label !== t('an.link.insert')) note('insérer', `${where} : le bouton dit « ${snap.button.label} » (« ${t('an.link.insert')} » attendu)`);
  if (snap.button.aria !== 'menu') note('clavier', `${where} : le bouton annonce « ${snap.button.aria} » (un menu attendu)`);
  if (snap.acts.sideways > 1) note('défile de côté', `${where} : les boutons de la fiche défilent de côté (${snap.acts.sideways} px)`);
  if (!inside(snap.button.box, snap.side || pageBox(snap.viewport))) note('hors de la page', `${where} : le bouton sort de la fiche`);
  if (snap.button.box.height < 24) note('insérer', `${where} : le bouton ne mesure que ${Math.round(snap.button.box.height)} px de haut`);
  return true;
}

function menuShape(snap, t, note, where, name) {
  if (!snap) { note('insérer', `${where} : le menu ne s'ouvre pas`); return false; }
  if (!inside(snap.box, pageBox(snap.viewport))) note('hors de la page', `${where} : le menu sort de la page (${Math.round(snap.box.left)}, ${Math.round(snap.box.top)}, ${Math.round(snap.box.right)}, ${Math.round(snap.box.bottom)})`);
  if (snap.title !== t('an.link.menuTitle', { name })) note('insérer', `${where} : le titre dit « ${snap.title} » (« ${t('an.link.menuTitle', { name })} » attendu)`);
  const labels = snap.items.map(item => item.label).join('|');
  if (labels !== 'Publipostage+|Form+|Thusday|Grist-BI') note('insérer', `${where} : les apps sont « ${labels} »`);
  const grey = Object.fromEntries(snap.items.map(item => [item.label, item]));
  if (grey['Publipostage+'] && (grey['Publipostage+'].greyed || grey['Publipostage+'].hint !== 'dans un modèle')) note('insérer', `${where} : « Publipostage+ » dit « ${grey['Publipostage+'].hint} » ou se grise`);
  if (grey.Thusday && (!grey.Thusday.greyed || grey.Thusday.hint !== t('an.link.locked') || !grey.Thusday.tip.includes('Équipes'))) note('insérer', `${where} : « Thusday » doit être grisé (« ${t('an.link.locked')} », sa raison au survol) : ${JSON.stringify(grey.Thusday)}`);
  if (grey['Grist-BI'] && (!grey['Grist-BI'].greyed || grey['Grist-BI'].hint !== t('an.link.notYet') || grey['Grist-BI'].tip !== t('an.link.notYetWhy', { app: 'Grist-BI' }))) note('insérer', `${where} : « Grist-BI » doit dire « ${t('an.link.notYet')} » : ${JSON.stringify(grey['Grist-BI'])}`);
  for (const item of snap.items) if (item.box.height < 26) note('insérer', `${where} : la ligne « ${item.label} » ne mesure que ${Math.round(item.box.height)} px`);
  if (snap.focused !== 'Publipostage+') note('clavier', `${where} : le clavier est sur « ${snap.focused} » (la première app attendue)`);
  return true;
}

async function menuProblems(page, t, note, click, { width, mode }) {
  const where = `le menu « ${t('an.link.insert')} » à ${width} px`;
  await openFiche(page, click);
  if (!(await buttonProblems(page, t, note, where))) return;
  const person = await page.run(() => document.querySelector('.an-fiche-id h3').textContent);
  const before = (await page.run(writes)).length;
  await click('[data-act="insert"]');
  const snap = await page.until(menuSnap).catch(() => null);
  if (!menuShape(snap, t, note, where, person)) return;
  for (const [what, value] of Object.entries(await page.run(contrasts, MENU_PROBES))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu, ${mode})`);
  // une app grisée : le clic la redit, rien ne part
  const items = Object.fromEntries(snap.items.map(item => [item.label, item]));
  await page.click(...centered(items.Thusday.box));
  await delay(200);
  const unlocked = await page.run(() => window.__annuaireUnlocked.slice());
  if (unlocked.join() !== 'tu') note('insérer', `${where} : un clic sur « Thusday » grisé n'a pas demandé de le débloquer (${unlocked.join() || 'rien'})`);
  if ((await page.run(() => window.__annuaireInserted)).length) note('insérer', `${where} : une app grisée a reçu la personne`);
  await click('[data-act="insert"]');
  const again = await page.until(menuSnap).catch(() => null);
  if (again) await page.click(...centered(again.items.find(item => item.label === 'Grist-BI').box));
  await delay(200);
  const said = (await page.run(ficheSnap)).foot;
  if (!said.includes(t('an.link.notYetWhy', { app: 'Grist-BI' }))) note('insérer', `${where} : « Grist-BI » grisé dit « ${said} » (« ${t('an.link.notYetWhy', { app: 'Grist-BI' })} » attendu)`);
  if ((await page.run(() => window.__annuaireInserted)).length) note('insérer', `${where} : une app qui ne sait pas encore a reçu la personne`);
  // Échap range le menu seul, le clavier revient au bouton, la fenêtre reste
  await click('[data-act="insert"]');
  await page.until(menuSnap).catch(() => null);
  await page.press('Escape');
  await delay(200);
  if (await page.run(menuSnap)) note('clavier', `${where} : Échap ne ferme pas le menu`);
  if (!(await page.run(ficheSnap)).open) note('clavier', `${where} : Échap ferme toute la fenêtre au lieu du menu`);
  const focus = await page.run(() => (document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null));
  if (focus !== 'insert') note('clavier', `${where} : après Échap le clavier est sur « ${focus} » (le bouton attendu)`);
  // au clavier : ↓ descend d'une app à l'autre, puis la touche d'activation choisit (la fenêtre du Firefox sans écran n'a pas le focus du système : une touche ne clique pas un bouton ; l'essai
  // clique donc l'élément qui a le clavier, comme le ferait Entrée)
  await click('[data-act="insert"]');
  await page.until(menuSnap).catch(() => null);
  await page.press('ArrowDown');
  const down = await page.run(menuSnap);
  if (!down || down.focused !== 'Form+') note('clavier', `${where} : après ↓ le clavier est sur « ${down && down.focused} » (« Form+ » attendu)`);
  await page.run(() => document.activeElement.click());
  await delay(300);
  const inserted = await page.run(() => window.__annuaireInserted);
  if (inserted.length !== 1 || inserted[0].id !== 'fp') { note('insérer', `${where} : au clavier, l'app reçue est « ${inserted.map(each => each.id).join() || 'aucune'} » (« fp » attendue)`); return; }
  const sent = inserted[0].person;
  if (sent.nom !== person) note('insérer', `${where} : l'app reçoit « ${sent.nom} » (« ${person} » attendu)`);
  if (sent.annuaire !== 'Annuaire principal') note('insérer', `${where} : l'app reçoit l'annuaire « ${sent.annuaire} » (« Annuaire principal » attendu)`);
  const keys = Object.keys(sent).sort().join();
  if (keys !== 'annuaire,email,nom,telephone,titre') note('insérer', `${where} : la personne reçue porte « ${keys} » (cinq textes seulement attendus)`);
  if (Object.values(sent).some(value => typeof value !== 'string')) note('insérer', `${where} : la personne reçue porte autre chose que du texte`);
  if (await page.run(() => window.__annuaire.isOpen)) note('insérer', `${where} : la fenêtre reste ouverte après l'envoi`);
  if ((await page.run(writes)).length !== before) note('insérer', `${where} : « Insérer dans… » a écrit dans le document`);
}

// Sans app qui accepte une personne : le bouton reste, le menu le dit sur une ligne grisée.
async function noneProblems(page, t, note, click, { width }) {
  const where = `le menu « ${t('an.link.insert')} » sans app à ${width} px`;
  await openFiche(page, click);
  await click('[data-act="insert"]');
  const snap = await page.until(menuSnap).catch(() => null);
  if (!snap) { note('insérer', `${where} : le menu ne s'ouvre pas sans app`); return; }
  if (snap.items.length !== 1 || !snap.items[0].greyed || snap.items[0].label !== t('an.link.noneLine') || snap.items[0].tip !== t('an.link.none')) note('insérer', `${where} : le menu dit « ${snap.items.map(item => item.label).join('|')} » (une ligne grisée « ${t('an.link.noneLine')} » attendue, sa phrase au survol)`);
  if (!inside(snap.box, pageBox(snap.viewport))) note('hors de la page', `${where} : le menu sort de la page`);
  await click('.menu-item');
  await delay(150);
  if (!(await page.run(ficheSnap)).foot.includes(t('an.link.none'))) note('insérer', `${where} : le clic ne redit pas pourquoi dans le pied`);
  await page.press('Escape');
}

// ---------- la fenêtre « Choisir une personne » ----------

async function askPerson(page, args) { await page.run(arg => { window.__picked = undefined; void window.__annuaire.pick(arg).then(result => { window.__picked = result; }); }, args); }

function pickShape(snap, t, note, where, { groups }) {
  if (!snap) { note('choisir', `${where} : la fenêtre ne s'ouvre pas`); return false; }
  if (!inside(snap.box, pageBox(snap.viewport))) note('hors de la page', `${where} : la fenêtre sort de la page (${Math.round(snap.box.left)}, ${Math.round(snap.box.top)}, ${Math.round(snap.box.right)}, ${Math.round(snap.box.bottom)})`);
  if (!inside(snap.footBox, snap.box)) note('hors de la page', `${where} : le pied de la fenêtre sort de la fenêtre`);
  if (snap.sideways > 1) note('défile de côté', `${where} : la fenêtre défile de côté (${snap.sideways} px)`);
  if (snap.title !== t('an.pick.title')) note('choisir', `${where} : le titre dit « ${snap.title} » (« ${t('an.pick.title')} » attendu)`);
  if (!snap.sub.includes('Choisir un destinataire')) note('choisir', `${where} : le texte de l'app manque (« ${snap.sub} »)`);
  if (groups && !(snap.from || '').includes(t('an.merge.title'))) note('choisir', `${where} : l'annuaire choisi dit « ${snap.from} » (« ${t('an.merge.title')} » d'abord attendu)`);
  if (snap.only !== t('an.pick.only', { app: 'Publipostage+' })) note('choisir', `${where} : le rappel dit « ${snap.only} » (« ${t('an.pick.only', { app: 'Publipostage+' })} » attendu)`);
  if (!snap.rows.length) note('choisir', `${where} : aucune personne dans la liste`);
  for (const row of snap.rows) if (row.box.height < 32) note('choisir', `${where} : la ligne « ${row.name} » ne mesure que ${Math.round(row.box.height)} px`);
  if (snap.rows.length && snap.rows.some(row => row.checked)) note('choisir', `${where} : une personne est choisie avant tout geste`);
  if (!snap.ok.disabled) note('choisir', `${where} : « ${t('an.pick.choose')} » n'est pas grisé sans choix`);
  if (snap.focused !== 'pk-search') note('clavier', `${where} : le clavier est sur « ${snap.focused} » (la recherche attendue)`);
  return true;
}

async function pickProblems(page, t, note, click, { width, mode }) {
  const where = `la fenêtre « ${t('an.pick.title')} » à ${width} px`;
  const before = (await page.run(writes)).length;
  await page.run(() => { void window.__annuaire.open(1); });
  await page.until(() => document.querySelector('.an-person') !== null);
  await page.run(() => window.__annuaire.close());
  await askPerson(page, { title: 'Choisir un destinataire', app: 'Publipostage+' });
  const snap = await page.until(pickSnap).catch(() => null);
  if (!pickShape(snap, t, note, where, { groups: true })) return;
  for (const [what, value] of Object.entries(await page.run(contrasts, PICK_PROBES))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu, ${mode})`);
  // « Choisir » sans choix : une phrase, rien n'est rendu
  await page.click(...centered(snap.ok.box));
  await delay(150);
  const needed = await page.run(pickSnap);
  if (!needed || needed.note !== t('an.pick.needOne')) note('choisir', `${where} : « ${t('an.pick.choose')} » sans choix dit « ${needed && needed.note} » (« ${t('an.pick.needOne')} » attendu)`);
  if ((await page.run(() => window.__picked)) !== undefined) note('choisir', `${where} : la fenêtre rend une personne sans choix`);
  // une seconde demande pendant que la première attend : refusée, la première reste
  const second = await page.run(() => window.__annuaire.pick({ title: '', app: 'Form+' }));
  if (second !== null) note('choisir', `${where} : une seconde demande pendant la première rend « ${JSON.stringify(second)} » (rien attendu)`);
  if ((await page.run(() => document.querySelectorAll('.mod.an-pk').length)) !== 1) note('choisir', `${where} : il y a deux fenêtres de choix`);
  // la recherche : mots dans n'importe quel ordre, accents et casse ignorés
  await click('.an-pk [data-fk="pk-search"]');
  await page.press(...'marchand ines'.split(''));
  await delay(250);
  const found = await page.run(pickSnap);
  if (found.rows.length < 1 || found.rows.some(row => !/marchand/i.test(row.name.normalize('NFD').replace(/[̀-ͯ]/g, '')))) note('choisir', `${where} : la recherche « marchand ines » montre « ${found.rows.map(row => row.name).join(' | ')} »`);
  // un clic choisit (un seul), puis « Choisir » rend la personne et ferme
  await page.click(...centered(found.rows[0].box));
  await delay(150);
  const chosen = await page.run(pickSnap);
  if (chosen.rows.filter(row => row.checked).length !== 1 || chosen.ok.disabled) note('choisir', `${where} : après un clic, ${chosen.rows.filter(row => row.checked).length} personne(s) choisie(s), « ${t('an.pick.choose')} » ${chosen.ok.disabled ? 'grisé' : 'actif'}`);
  const name = found.rows[0].name;
  await page.click(...centered(chosen.ok.box));
  await delay(300);
  const result = await page.run(() => window.__picked);
  if (!result || result.nom !== name) note('choisir', `${where} : la personne rendue est « ${JSON.stringify(result)} » (« ${name} » attendu)`);
  else if (Object.keys(result).sort().join() !== 'annuaire,email,nom,telephone,titre' || Object.values(result).some(value => typeof value !== 'string')) note('choisir', `${where} : la personne rendue porte « ${Object.keys(result)} »`);
  else if (!['Annuaire principal', 'Pôle Ressources', 'Annuaire des directions'].includes(result.annuaire)) note('choisir', `${where} : l'annuaire rendu est « ${result.annuaire} »`);
  if (await page.run(() => document.querySelector('.mod.an-pk') !== null)) note('choisir', `${where} : la fenêtre reste ouverte après « ${t('an.pick.choose')} »`);
  if ((await page.run(writes)).length !== before) note('choisir', `${where} : choisir une personne a écrit dans le document`);
}

async function cancelProblems(page, t, note, click, { width }) {
  const where = `la fenêtre « ${t('an.pick.title')} » (annulations) à ${width} px`;
  // le bouton « Annuler » ; puis Échap ; puis l'app qui n'est plus là
  for (const how of ['button', 'escape', 'gone']) {
    await askPerson(page, { title: '', app: 'Form+' });
    const snap = await page.until(pickSnap).catch(() => null);
    if (!snap) { note('choisir', `${where} : la fenêtre ne s'ouvre pas (${how})`); return; }
    if (snap.only !== t('an.pick.only', { app: 'Form+' })) note('choisir', `${where} : le rappel dit « ${snap.only} »`);
    if (how === 'button') await click('[data-fk="pk-cancel"]'); else if (how === 'escape') await page.press('Escape'); else await page.run(() => window.__annuaire.cancelPick());
    await delay(250);
    if (await page.run(() => document.querySelector('.mod.an-pk') !== null)) note('choisir', `${where} : la fenêtre reste ouverte (${how})`);
    const result = await page.run(() => window.__picked);
    if (result !== null) note('choisir', `${where} : annuler (${how}) rend « ${JSON.stringify(result)} » (rien attendu)`);
  }
}

async function groupProblems(page, t, note, click, { width }) {
  const where = `le choix de l'annuaire à ${width} px`;
  await askPerson(page, { title: '', app: '' });
  const snap = await page.until(pickSnap).catch(() => null);
  if (!snap) { note('choisir', `${where} : la fenêtre ne s'ouvre pas`); return; }
  if (snap.only !== t('an.pick.onlyNoApp')) note('choisir', `${where} : sans nom d'app, le rappel dit « ${snap.only} » (« ${t('an.pick.onlyNoApp')} » attendu)`);
  await click('.an-pk-from');
  const list = await page.until(() => { const modals = [...document.querySelectorAll('.mod-scrim')]; const top = modals[modals.length - 1]; return top && top.querySelector('.wk-item') ? [...top.querySelectorAll('.wk-name')].map(node => node.textContent.trim()) : null; }).catch(() => null);
  if (!list) { note('choisir', `${where} : « ${t('an.pick.fromTip')} » n'ouvre pas la liste des annuaires`); await page.press('Escape'); return; }
  if (list.join('|') !== `${t('an.merge.title')}|Annuaire principal|Pôle Ressources|Annuaire des directions`) note('choisir', `${where} : la liste dit « ${list.join('|')} »`);
  const boxes = await page.run(() => [...[...document.querySelectorAll('.mod-scrim')].filter(scrim => scrim.querySelector('.wk-item')).pop().querySelectorAll('.wk-item')].map(item => { const r = item.getBoundingClientRect(); return { name: item.querySelector('.wk-name').textContent.trim(), box: [r.left + r.width / 2, r.top + r.height / 2] }; }));
  await page.click(...boxes.find(item => item.name === 'Annuaire principal').box);
  await delay(300);
  const next = await page.run(pickSnap);
  if (!next || !next.from.includes('Annuaire principal')) note('choisir', `${where} : après le choix, l'annuaire dit « ${next && next.from} » (« Annuaire principal » attendu)`);
  if (next && !next.rows.length) note('choisir', `${where} : « Annuaire principal » ne montre aucune personne`);
  // la liste des annuaires ne garde pas la personne choisie d'un annuaire à l'autre
  await page.press('Escape');
  await delay(200);
  await page.run(() => window.__annuaire.cancelPick());
}

// ---------- l'entrée ----------

export async function linksProblems(page, t, note, click, { width, mode, language }) {
  const view = { width, mode };
  await reload(page, `?lang=${language}&links=1&sub=1`, view);
  await menuProblems(page, t, note, click, view);
  await pickProblems(page, t, note, click, view);
  await cancelProblems(page, t, note, click, view);
  await groupProblems(page, t, note, click, view);
  await reload(page, `?lang=${language}`, view);
  await noneProblems(page, t, note, click, view);
}
