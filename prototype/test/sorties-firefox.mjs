// Les sorties de chaque fenêtre de GFS sous Firefox (demande du porteur du 27/11 : « le bouton "Annuler" de la fenêtre "Déplacer" ne ferme pas la fenêtre, à vérifier sur toutes les fenêtres » ; règle du
// 03/11 : toute nouvelle interface ajoute ses mesures aux essais sous Firefox). Avant le 27/11, `chooseFolder` (js/explorer/filing-window.js) posait son bouton « Annuler » sans lui donner de gestionnaire : un clic ne faisait
// rien, seul Échap fermait la fenêtre, et aucun essai ne cliquait ce bouton (les essais d'avant jouaient Échap, ou le geste qui réussit). Chaque fenêtre est donc ouverte, puis quittée par CHACUNE de ses sorties : le
// bouton « Annuler » ou « Fermer » à la vraie souris, la croix quand elle en a une (la fiche de l'annuaire), et Échap au vrai clavier. Une sortie ferme la fenêtre du dessus (le nombre de voiles baisse) ; deux fenêtres
// posées SUR une autre, dans le réglage de l'annuaire (« Créer une colonne », « Créer la table »), reviennent à la liste qui les a ouvertes (le titre redevient le sien, le voile reste).
// Les fenêtres sont celles de test/pages/explorateur.js et de test/pages/annuaire.js, les vraies, ouvertes par le geste de la personne quand il tient en un clic ou par le crochet que la page offre (`window.__share`,
// `window.__askConflict`, …) quand il faut un état que seul Grist fabrique. Une fenêtre qui n'a pas de sortie est dite ici avec sa raison : « Mise à jour des noms » est bloquante (js/ui/names-window.js : ni « Annuler »
// ni Échap avant que la mise à jour soit faite ou refusée), elle est donc hors de la liste.
import { createI18n } from '../js/i18n/i18n.js';
import { centerOfName, delay } from './corbeille-firefox.mjs';
import { centerOfMenuItem } from './copier-firefox.mjs';

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

// Les fenêtres ouvertes : leur nombre et le titre de celle du dessus (null quand il n'y en a plus).
function windows() {
  const all = [...document.querySelectorAll('.mod-scrim')];
  const top = all[all.length - 1];
  const heading = top ? top.querySelector('h2') : null;
  return { count: all.length, title: heading ? heading.textContent.trim() : null };
}

// Le centre, à l'écran, d'un élément de la fenêtre du dessus, ou de la page quand `inPage` ; null quand il manque ou n'est pas visible.
function centerOf(selector, inPage) {
  const all = [...document.querySelectorAll('.mod-scrim')];
  const scope = inPage || !all.length ? document : all[all.length - 1];
  const node = scope.querySelector(selector);
  if (!node || !node.getClientRects().length) return null;
  node.scrollIntoView({ block: 'nearest' });
  const box = node.getBoundingClientRect();
  return [box.left + box.width / 2, box.top + box.height / 2];
}

// ---------- la conduite ----------

class Probe {
  #page;
  #tag;
  #found;
  #t;

  constructor(page, tag, found, language) { this.#page = page; this.#tag = tag; this.#found = found; this.#t = createI18n(language).t; }

  get page() { return this.#page; }

  get t() { return this.#t; }

  note(name, text) { this.#found.push({ kind: 'sorties des fenêtres', text: `${this.#tag}, ${name} : ${text}` }); }

  windows() { return this.#page.run(windows); }

  // Un clic à la vraie souris sur l'élément de la fenêtre du dessus (ou de la page, `inPage`) ; faux quand il manque.
  async click(selector, inPage = false) {
    const at = await this.#page.run(centerOf, selector, inPage);
    if (!at) return false;
    await this.#page.click(...at);
    await delay(120);
    return true;
  }

  // Attend qu'une fenêtre soit là (jusqu'à `wait` ms) ; rend son état, ou null.
  async shown(wait = 3000) {
    const started = Date.now();
    for (;;) {
      const state = await this.windows();
      if (state.count) return state;
      if (Date.now() - started > wait) return null;
      await delay(60);
    }
  }

  // Ferme tout par Échap, une fenêtre par appui ; ce qui reste (une sortie cassée) est retiré de force : l'essai suivant repart d'une page propre. Rend vrai quand Échap a tout fermé.
  async clear() {
    for (let at = 0; at < 6; at++) {
      if (!(await this.windows()).count) return true;
      await this.#page.press('Escape');
      await delay(150);
    }
    await this.#page.run(() => { document.querySelectorAll('.mod-scrim').forEach(scrim => scrim.remove()); });
    return false;
  }

  // Ce que fait une sortie : 'ferme' (une fenêtre de moins), 'revient' (la fenêtre du dessous reparaît : son titre est celui d'avant), ou 'reste' (rien n'a changé, après 700 ms).
  async after(before, leave) {
    await leave();
    const started = Date.now();
    for (;;) {
      const now = await this.windows();
      if (now.count < before.count) return 'ferme';
      if (now.title !== before.title) return 'revient';
      if (Date.now() - started > 700) return 'reste';
      await delay(60);
    }
  }
}

const VERBS = { ferme: 'fermer la fenêtre', revient: 'revenir à la fenêtre d\'avant' };

// Ouvre la fenêtre (le geste `open`), puis la quitte par chaque sortie de `exits` : { fk } (le bouton de la fenêtre, à la souris), { cross } (un sélecteur de la page : la croix), ou 'Escape' ; `expect` : 'ferme' (par
// défaut) ou 'revient'. `fresh()` remet la page à zéro avant chaque ouverture.
async function sweep(probe, { name, open, exits, expect = 'ferme', fresh }) {
  const want = VERBS[expect];
  for (const exit of exits) {
    const what = exit === 'Escape' ? 'Échap' : (exit.cross ? `la croix (${exit.cross})` : `« ${exit.fk} »`);
    await fresh();
    try {
      await open();
    } catch (error) {
      probe.note(name, `la fenêtre ne s'ouvre pas (${String(error.message).slice(0, 120)})`);
      return;
    }
    const before = await probe.shown(3000);
    if (!before) { probe.note(name, 'la fenêtre ne s\'ouvre pas'); return; }
    if (exit !== 'Escape' && !exit.cross && !(await probe.page.run(centerOf, `[data-fk="${exit.fk}"]`, false))) {
      probe.note(name, `${what} manque dans la fenêtre « ${before.title} »`);
      continue;
    }
    const result = await probe.after(before, async () => {
      if (exit === 'Escape') await probe.page.press('Escape');
      else if (exit.cross) await probe.click(exit.cross, true);
      else await probe.click(`[data-fk="${exit.fk}"]`);
    });
    if (exit.cross) {
      // la croix de la fiche n'est pas une fenêtre : elle rend la hiérarchie, la fiche disparaît
      const side = await probe.page.run(() => document.querySelector('.an-side') ? document.querySelector('.an-side').children.length : 0);
      if (side) probe.note(name, `${what} ne ferme pas la fiche (« ${before.title} » reste ouverte)`);
    } else if (result !== expect) {
      probe.note(name, `${what} ${result === 'reste' ? 'ne fait rien : la fenêtre « ' + before.title + ' » reste ouverte' : (result === 'ferme' ? 'ferme toute la fenêtre' : 'revient à la fenêtre d\'avant')} ; `
        + `elle devait ${want}`);
    }
  }
}

// ---------- les fenêtres de l'explorateur (test/pages/explorateur.js) ----------

function explorerWindows(probe) {
  const { page, t } = probe;
  const hook = (fn, ...args) => () => page.run(fn, ...args);
  const rowMenu = (rowName, entry) => async () => {
    const at = await page.run(centerOfName, rowName);
    await page.rightClick(...at);
    await delay(200);
    await page.click(...await page.run(centerOfMenuItem, entry));
  };
  const settings = async row => {
    await probe.click('button use[href="#i-sliders"]', true);
    await delay(200);
    await page.click(...await page.run(index => { const item = [...document.querySelectorAll('.menu .menu-item')][index]; const box = item.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; }, row));
  };
  const closer = ['Escape'];
  return [
    { name: '« Déplacer » (un fichier)', open: rowMenu('Convocation', t('ex.move')), exits: [{ fk: 'move-cancel' }, ...closer] },
    { name: '« Déplacer » (un dossier)', open: rowMenu('Formation', t('ex.move')), exits: [{ fk: 'move-cancel' }, ...closer] },
    { name: '« Nouveau dossier »', open: async () => { await probe.click('.ex-nav-row .btn.primary', true); await delay(200); await page.click(...await page.run(centerOfMenuItem, t('ex.newFolder'))); },
      exits: [{ fk: 'name-cancel' }, ...closer] },
    { name: '« Ce nom est déjà pris »', open: hook(() => { window.__askConflict({ app: 'Publipostage+', repeat: true }); }), exits: [{ fk: 'conflict-cancel' }, ...closer] },
    { name: '« À propos »', open: hook(() => { window.__about(); }), exits: [{ fk: 'ask-yes' }, ...closer] },
    { name: '« Partager »', open: hook(() => { window.__share('actif'); }), exits: [{ fk: 'share-close' }, ...closer] },
    { name: '« Gérer les partages »', open: hook(() => { window.__manage(); }), exits: [{ fk: 'manage-close' }, ...closer] },
    { name: '« Apps et extensions »', open: hook(() => { window.__modulesWindow(); }), exits: [{ fk: 'close' }, ...closer] },
    { name: '« Table de travail »', open: hook(() => { window.__workWindow(); }), exits: [{ fk: 'work-close' }, ...closer] },
    { name: '« Créer la table de la corbeille ? »', open: hook(() => { window.__askTable(); }), exits: [{ fk: 'ask-no' }, ...closer] },
    { name: '« Fermer » : l\'app se tait', open: hook(() => { window.__askLeave(null); }), exits: [{ fk: 'ask-no' }, ...closer] },
    { name: '« Fermer » : l\'app répond par une erreur', open: hook(() => { window.__askLeave('boum'); }), exits: [{ fk: 'ask-no' }, ...closer] },
    { name: '« Activer le partage ? »', open: hook(() => { window.__askSharing(); }), exits: [{ fk: 'ask-no' }, ...closer] },
    { name: '« Créer l\'index des noms ? »', open: hook(() => { window.__indexAsk(); }), exits: [{ fk: 'ask-no' }, ...closer] },
    { name: '« Poids du document »', open: hook(() => { window.__weight({ bytes: 100e6, files: 10 }); }), exits: [{ fk: 'weight-close' }, ...closer] },
    { name: '« Dépendances »', open: hook(() => { window.__dependencies(); }), exits: [{ fk: 'dep-close' }, ...closer] },
    { name: '« Créer à partir d\'un modèle »', open: hook(() => { window.__templates(); }), exits: [{ fk: 'close' }, ...closer] },
    { name: '« Envoyer à un autre document »', open: hook(() => { window.__sendOther('refus'); }), exits: [{ fk: 'so-cancel' }, ...closer] },
    { name: '« Recevoir d\'un autre document »', open: hook(() => { window.__receive('fichier'); }), exits: [{ fk: 'so-cancel' }, ...closer] },
    { name: '« Thème »', open: () => settings(1), exits: [{ fk: 'close' }, ...closer] },
    { name: '« Couleur personnalisée »', open: async () => {
      await settings(1);
      await probe.shown();
      await probe.click('[data-fk="col:pick"]');
      await delay(500);
      await probe.click('.cp-custom', true); // « Personnalisé… », au pied de la palette du kit
      await delay(400);
    }, exits: [{ fk: 'tc-cancel' }, ...closer], expect: 'ferme' },
  ];
}

// Les fenêtres de l'annuaire : `gesture(…)` ouvre l'annuaire, puis clique les éléments dans l'ordre (le réglage, son onglet, le bouton) ; `query` est la variante de la page d'essai (test/pages/annuaire.js).
function annuaireWindows(probe) {
  const { page } = probe;
  const gesture = (...selectors) => async () => {
    await page.run(() => { void window.__annuaire.open(); });
    await page.until(() => document.querySelector('.mod.an .an-person') !== null);
    for (const selector of selectors) {
      if (!(await probe.click(selector))) throw new Error(`${selector} manque`);
      await delay(selector.includes('nl-ok') ? 500 : 300);
    }
  };
  const level = ['[data-fk="configure"]', '[data-fk="tab:hier"]', '[data-fk="level-add"]'];
  return [
    { name: 'l\'annuaire', open: gesture(), exits: [{ fk: 'close' }, 'Escape'] },
    { name: 'la fiche de l\'annuaire', open: gesture('.an-person'), exits: [{ cross: '.an-side-x' }] },
    { name: '« Régler l\'annuaire »', open: gesture('[data-fk="configure"]'), exits: [{ fk: 'set-cancel' }, 'Escape'] },
    { name: '« Nouveau niveau »', open: gesture(...level), exits: [{ fk: 'nl-cancel' }, 'Escape'] },
    { name: '« Colonne du niveau »', open: async () => { await gesture(...level)(); await page.press(...'Essai'.split('')); await delay(150); await probe.click('[data-fk="nl-ok"]'); await delay(600); },
      exits: [{ fk: 'pick-cancel' }, 'Escape'] },
    { name: '« Créer une colonne »', open: async () => { await gesture(...level)(); await page.press(...'Essai'.split('')); await delay(150); await probe.click('[data-fk="nl-ok"]'); await delay(600);
      await probe.click('[data-fk="pick-new:"]'); await delay(300); }, exits: [{ fk: 'nc-cancel' }, 'Escape'], expect: 'revient' },
    { name: '« Nouvelle relation »', open: gesture('[data-fk="configure"]', '[data-fk="tab:relations"]', '[data-fk="rt:other"]'), exits: [{ fk: 'nr-cancel' }, 'Escape'] },
    { name: '« Colonne de la relation »', open: gesture('[data-fk="configure"]', '[data-fk="tab:relations"]', '[data-fk="rt:substitute"]'), exits: [{ fk: 'pick-cancel' }, 'Escape'] },
    { name: '« Verrouiller les fiches »', query: 'rights=self,below,role&lock=none', open: gesture('[data-fk="configure"]', '[data-fk="tab:options"]', '[data-fk="ol:open"]'),
      exits: [{ fk: 'lk-cancel' }, 'Escape'] },
    { name: '« Modifier la fiche »', open: async () => { await gesture('.an-person')(); await delay(300); await probe.click('.an-side [data-fk="edit"]'); }, exits: [{ fk: 'ed-cancel' }, 'Escape'] },
    { name: '« Ajouter des personnes »', open: gesture('[data-fk="add"]'), exits: [{ fk: 'ed-cancel' }, 'Escape'] },
    { name: '« À vérifier »', query: 'tools=1', open: gesture('[data-fk="check"]'), exits: [{ fk: 'chk-close' }, 'Escape'] },
    { name: '« Écrire au groupe »', query: 'tools=1', open: gesture('[data-fk="mail"]'), exits: [{ fk: 'mail-close' }, 'Escape'] },
    { name: '« Changer d\'annuaire »', query: 'sub=1', open: gesture('[data-fk="switch"]'), exits: [{ fk: 'pick-cancel' }, 'Escape'] },
    { name: '« Nouveau sous-annuaire »', query: 'sub=1', open: async () => { await gesture('[data-fk="switch"]')(); await probe.click('[data-fk="pick-__new_sub__"]'); },
      exits: [{ fk: 'sub-cancel' }, 'Escape'] },
    { name: '« Choisir une personne » (pour une app)', query: 'links=1&sub=1', open: async () => { await gesture()(); await page.run(() => { void window.__annuaire.pick({ title: 'Choisir', app: 'Publipostage+' }); }); },
      exits: [{ fk: 'pk-cancel' }, 'Escape'] },
    { name: '« Nouvel annuaire »', open: gesture('[data-fk="switch"]', '[data-fk="pick-__new__"]'), exits: [{ fk: 'set-cancel' }, 'Escape'] },
    { name: '« Table des personnes »', open: gesture('[data-fk="switch"]', '[data-fk="pick-__new__"]', '[data-fk="pt"]'), exits: [{ fk: 'pick-cancel' }, 'Escape'] },
    { name: '« Créer la table des personnes »', open: gesture('[data-fk="switch"]', '[data-fk="pick-__new__"]', '[data-fk="pt"]', '[data-fk="pick-new:"]'), exits: [{ fk: 'nt-cancel' }, 'Escape'], expect: 'revient' },
  ];
}

// ---------- les essais ----------

// Les fenêtres de l'explorateur : chacune par chacune de ses sorties.
export async function sortiesProblems(page, language, tag) {
  const found = [];
  const probe = new Probe(page, tag, found, language);
  const fresh = async () => { await probe.clear(); await page.run(() => window.__reset()); };
  for (const win of explorerWindows(probe)) {
    try {
      await sweep(probe, { ...win, fresh });
    } catch (error) {
      probe.note(win.name, `essai interrompu : ${String(error.message).slice(0, 160)}`);
    }
  }
  await probe.clear();
  return found;
}

// Les fenêtres de l'annuaire : la page se recharge (`?lang=…&query`) quand une sortie cassée a laissé une fenêtre derrière elle ; `base` est l'adresse de la page d'essai de l'annuaire.
export async function sortiesAnnuaireProblems(page, language, tag, { base, width = 700, mode = 'light' }) {
  const found = [];
  const probe = new Probe(page, tag, found, language);
  let loaded = null;
  for (const win of annuaireWindows(probe)) {
    const query = win.query || '';
    const fresh = async () => {
      const clean = loaded === query && await probe.clear();
      if (clean) { await page.run(() => { if (window.__annuaire.isOpen) window.__annuaire.close(); }); return; }
      await page.goto(`${base}?lang=${language}${query ? `&${query}` : ''}`);
      await page.run(() => window.__ready);
      await page.view({ width, scale: 1, mode });
      loaded = query;
    };
    try {
      await sweep(probe, { ...win, fresh });
    } catch (error) {
      probe.note(win.name, `essai interrompu : ${String(error.message).slice(0, 160)}`);
    }
  }
  await probe.clear();
  return found;
}
