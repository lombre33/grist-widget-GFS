// Les réglages d'une app écrits dans la vue (contrats 7.3), sans « Enregistrer ». Grist ne garde le réglage qu'un widget pose (`setOption`) qu'en brouillon, et
// montre « Enregistrer » et « Retour » au-dessus du widget tant que la personne n'a pas tranché. GFS, lui, a le niveau `full` : il retrouve sa propre section
// dans `_grist_Views_section` et y écrit `customView.widgetOptions` par un `UpdateRecord`, ce qu'écrit Grist lui-même quand on clique « Enregistrer » (mesuré
// le 03/11 : aucune barre, le cadre n'est pas reconstruit, Grist renvoie les réglages en écho comme pour un brouillon).
//
// Un widget d'une autre origine ne sait ni sa page ni sa section (Grist ne les met pas dans son adresse, et le référent ne garde que l'origine : faits
// vérifiés, 18) : GFS retrouve sa section par ce qu'il sait, son adresse et la table de sa section. Une seule candidate : c'est elle, et l'écho le confirme.
// Plusieurs (deux GFS sur la même table, quasi toujours) : une marque aléatoire est posée un instant dans chacune et GFS relit ses propres réglages : celle
// qu'il voit est la sienne. Ce qui n'est pas sûr ne s'écrit jamais : sans candidate, sans écho, sans droit, `write` rend faux et le courtier pose le brouillon,
// comme avant.

import { sameValue } from './options-slice.js';

const SECTIONS = '_grist_Views_section';
const TABLES = '_grist_Tables';
export const PROBE_KEY = 'gfs.sonde';
const ECHO_WAIT_MS = 3000; // Grist renvoie le réglage en quelques dizaines de ms ; passé ce délai, l'écriture n'a pas atteint notre section
const PROBE_WAIT_MS = 1500;
const POLL_MS = 50;
const PROBE_TRIES = 5;
const LOST_MS = 30000; // une recherche sans réponse ne se refait pas avant ce délai, tant que les candidates sont les mêmes

// Une adresse de widget sans ce qui change d'une ouverture à l'autre : l'origine et le chemin, sans requête, ni fragment, ni « index.html », ni « / » final.
// Grist ajoute `access`, `readonly` et la langue à l'adresse du cadre ; l'adresse gardée dans la section est celle que la personne a donnée.
export function addressOf(url) {
  try {
    const { origin, pathname } = new URL(url);
    return origin + pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '');
  } catch (error) { return null; }
}

const parse = text => {
  try {
    const value = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch (error) { return null; }
};

// `options` d'une section : l'objet, et l'objet `customView` qu'il garde en texte (le même texte deux fois codé que Grist écrit). Rend null si l'un des deux
// manque.
export function customViewOf(text) {
  const options = parse(text);
  const custom = options && typeof options.customView === 'string' ? parse(options.customView) : null;
  return options && custom ? { options, custom } : null;
}

// Les réglages enregistrés dans le texte `options` d'une section (`customView.widgetOptions`), `null` quand il n'y en a pas.
export function savedOptionsOf(text) {
  const view = customViewOf(text);
  return view && view.custom.widgetOptions !== null && typeof view.custom.widgetOptions === 'object' ? view.custom.widgetOptions : null;
}

// Les sections personnalisées à l'adresse de GFS sur la table de cette section (`tableId` vide : une section sans table) : celles où GFS peut se trouver.
// `sections` et `tables` sont les tables de Grist telles que `fetchTable` les rend, par colonnes.
export function candidatesOf(sections, tables, { address, tableId }) {
  let tableRef = 0;
  if (tableId) {
    const at = tables.tableId.indexOf(tableId);
    if (at === -1) return [];
    tableRef = tables.id[at];
  }
  const found = [];
  sections.id.forEach((id, i) => {
    if (sections.parentKey[i] !== 'custom' || sections.tableRef[i] !== tableRef) return;
    const view = customViewOf(sections.options[i]);
    if (view && address && addressOf(view.custom.url) === address) found.push({ id, text: sections.options[i] });
  });
  return found;
}

// Le texte de `options` après les changements `[[clé, valeur]]` (une valeur indéfinie retire la clé) : seule la tranche `widgetOptions` change, tout le reste
// de la section reste tel que Grist l'a écrit (les autres clés, l'accès, l'adresse). Sans clé restante, Grist garde `null`. Rend null quand le texte ne se lit
// pas.
export function withChanges(text, changes) {
  const view = customViewOf(text);
  if (!view) return null;
  const kept = view.custom.widgetOptions;
  const next = Object.assign(Object.create(null), kept !== null && typeof kept === 'object' && !Array.isArray(kept) ? kept : {});
  for (const [key, value] of changes) {
    if (typeof key !== 'string' || key === '__proto__') continue;
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  view.custom.widgetOptions = Object.keys(next).length ? { ...next } : null;
  view.options.customView = JSON.stringify(view.custom);
  return JSON.stringify(view.options);
}

// Les réglages de la section sans la marque de la recherche.
const unmarked = text => withChanges(text, [[PROBE_KEY, undefined]]);

// Des réglages comparés sans la marque d'une recherche en cours (celle d'un autre GFS, posée un instant) : elle ne dit rien d'un brouillon.
const clean = options => {
  const { [PROBE_KEY]: mark, ...rest } = options || {};
  return rest;
};

let counter = 0;
const nonce = () => `${Math.random().toString(36).slice(2)}${(counter++).toString(36)}`;

export class ViewOptions {
  #doc;
  #widget;
  #address;
  #tableId;
  #enabled;
  #timers;
  #queue = Promise.resolve();
  #own = null; // le numéro de la section que la recherche a reconnue pour la nôtre, tant qu'elle reste parmi les candidates
  #notOurs = new Set(); // les sections où une écriture n'est pas revenue en écho : elles ne sont pas la nôtre
  #lost = null; // { signature, at } : la dernière recherche qui n'a reçu aucune marque
  #warned = new Set();

  // doc : `GristDocAPI` de GFS ; widget : son `WidgetAPI` ; address : `addressOf` de l'adresse de GFS ; tableId() : la table de la section de GFS ; enabled() :
  //   GFS a le niveau `full` et le document s'écrit ; timers : { setTimeout }.
  constructor({ doc, widget, address, tableId, enabled = () => true, timers = globalThis }) {
    this.#doc = doc;
    this.#widget = widget;
    this.#address = address;
    this.#tableId = tableId;
    this.#enabled = enabled;
    this.#timers = timers;
  }

  // Écrit les changements `[[clé, valeur]]` dans la vue. Rend vrai quand ils y sont, relus par Grist (rien à enregistrer) ; faux quand rien n'a été écrit :
  // l'appelant pose alors le brouillon. Les écritures d'une même session passent l'une après l'autre, et ne lèvent jamais d'erreur.
  write(changes) {
    const run = this.#queue.then(() => this.#write(changes));
    this.#queue = run.catch(() => {});
    return run;
  }

  // La section de GFS : `{ id }`, ou `{ reason }` quand GFS ne la reconnaît pas ou ne peut pas écrire dans la vue (la même recherche que pour écrire un
  // réglage). Sert à poser le lien « Select by » (js/broker/view-link.js). Les recherches passent dans la file des écritures : jamais deux à la fois.
  section() {
    const run = this.#queue.then(async () => {
      if (!this.#enabled()) return { reason: 'disabled' };
      try {
        const found = await this.#find(await this.#widget.getOptions());
        return found.target ? { id: found.target.id } : { reason: found.reason };
      } catch (error) {
        return { reason: 'refused' };
      }
    });
    this.#queue = run.catch(() => {});
    return run;
  }

  async #write(changes) {
    if (!this.#enabled()) return this.#declined('access');
    try {
      const current = await this.#widget.getOptions();
      const wanted = changes.filter(([key, value]) => !sameValue(current ? current[key] : undefined, value));
      if (!wanted.length) return true; // Grist a déjà ces valeurs : rien ne se pose, rien ne s'enregistre
      const found = await this.#find(current);
      if (!found.target) return this.#declined(found.reason);
      const { target } = found;
      const written = withChanges(target.text, wanted);
      if (written === null || written === target.text) return this.#declined('unreadable');
      await this.#doc.applyUserActions([['UpdateRecord', SECTIONS, target.id, { options: written }]]);
      if (await this.#echoed(wanted)) return true;
      this.#notOurs.add(target.id);
      this.#own = null;
      await this.#undo(target, written);
      return this.#declined('no-echo');
    } catch (error) {
      return this.#declined('refused', error);
    }
  }

  // Dit une fois par raison, en console, pourquoi le réglage reste un brouillon : c'est ce que lira l'auteur d'une app qui voit « Enregistrer ».
  #declined(reason, error) {
    if (!this.#warned.has(reason)) {
      this.#warned.add(reason);
      const why = { access: 'GFS n\'a pas l\'accès complet au document', 'no-section': 'GFS ne reconnaît pas sa section',
        unreadable: 'les réglages de la section ne se lisent pas ou ne changent pas',
        'no-echo': 'Grist n\'a pas renvoyé le réglage écrit (ce n\'était pas la section de GFS)',
        draft: 'un brouillon est déjà posé (« Enregistrer » ou « Retour » dans Grist le libère)',
        refused: `Grist a refusé l'écriture (${(error && error.message) || error})` }[reason];
      console.warn(`GFS : les réglages restent un brouillon (« Enregistrer » dans Grist) : ${why}.`);
    }
    return false;
  }

  // Les sections où GFS peut se trouver, en lecture seule : `{ agree }`, les candidates dont les réglages enregistrés disent ce que Grist dit à GFS (`current`,
  // hors marques de recherche), ou `{ reason }` quand il n'y en a aucune. Une candidate qui dit autre chose n'est pas la nôtre, et si aucune ne le dit, c'est
  // qu'un brouillon est posé (« Enregistrer » est là : il masque les réglages enregistrés, l'écho ne reviendrait pas et « Enregistrer » le remplacerait).
  async #agreeing(current) {
    const [sections, tables] = await Promise.all([this.#doc.fetchTable(SECTIONS), this.#doc.fetchTable(TABLES)]);
    const candidates = candidatesOf(sections, tables, { address: this.#address, tableId: this.#tableId() }).filter(item => !this.#notOurs.has(item.id));
    if (!candidates.length) return { reason: 'no-section' };
    const agree = candidates.filter(item => sameValue(clean(current), clean(savedOptionsOf(item.text))));
    return agree.length ? { agree } : { reason: 'draft' };
  }

  // Ce que GFS peut dire à une app dès son ouverture, avant tout réglage : ses réglages iront-ils dans la vue ? Vrai : une seule section dit ce que Grist dit à
  // GFS (ou celle que la recherche a déjà reconnue) ; faux : GFS sait déjà qu'il se repliera sur le brouillon (accès, aucune section, brouillon posé), et le
  // dit en console comme à l'écriture ; null : il ne sait pas (plusieurs sections pareilles : seule une marque le dirait, et une marque s'écrit). Rien n'est
  // jamais écrit. Un refus de Grist (droits de structure) ne se lit pas : il se saura à la première écriture.
  async expect() {
    if (!this.#enabled()) { this.#declined('access'); return false; }
    try {
      const { agree, reason } = await this.#agreeing(await this.#widget.getOptions());
      if (!agree) { this.#declined(reason); return false; }
      return agree.length === 1 || agree.some(item => item.id === this.#own) ? true : null;
    } catch (error) {
      return null;
    }
  }

  // La section de GFS : `{ target: { id, text } }`, ou `{ reason }` quand GFS ne peut pas écrire dans la vue. `current` : ce que Grist dit à GFS de ses
  // réglages. Une seule candidate qui
  // s'accorde : c'est elle, et l'écho le confirme. Plusieurs : la recherche par marques.
  async #find(current) {
    const { agree, reason } = await this.#agreeing(current);
    if (!agree) return { reason };
    if (agree.length === 1) return { target: agree[0] };
    const known = agree.find(item => item.id === this.#own);
    if (known) return { target: known };
    const signature = agree.map(item => item.id).join();
    if (this.#lost && this.#lost.signature === signature && Date.now() - this.#lost.at < LOST_MS) return { reason: 'no-section' };
    this.#own = await this.#probe(agree);
    this.#lost = this.#own === null ? { signature, at: Date.now() } : null;
    const target = agree.find(item => item.id === this.#own);
    return target ? { target } : { reason: 'no-section' };
  }

  // Plusieurs sections de GFS sur la même table : une marque aléatoire par candidate, posée d'un coup, puis les réglages de GFS relus. Celle qu'il voit est
  // dans sa section. Une marque d'une autre recherche en cours (deux GFS qui démarrent ensemble) n'est dans aucune de nos listes : on recommence après un délai
  // au hasard. Aucune marque du tout dans le délai : GFS n'est pas parmi les candidates, inutile d'insister. Les marques sont toujours retirées.
  async #probe(candidates) {
    for (let attempt = 0; attempt < PROBE_TRIES; attempt++) {
      const marks = candidates.map(() => nonce());
      let seen = null;
      try {
        await this.#doc.applyUserActions(candidates.map((item, i) => ['UpdateRecord', SECTIONS, item.id,
          { options: withChanges(item.text, [[PROBE_KEY, marks[i]]]) }]));
        seen = await this.#until(async () => {
          const own = await this.#widget.getOptions(); return own && own[PROBE_KEY] !== undefined ? { mark: own[PROBE_KEY] } : null; }, PROBE_WAIT_MS);
      } finally {
        await this.#unmark(candidates);
      }
      if (!seen) return null;
      if (marks.includes(seen.mark)) return candidates[marks.indexOf(seen.mark)].id;
      await this.#sleep(60 + Math.random() * 240);
    }
    return null;
  }

  // Retire la marque de chaque candidate, sur le texte relu à l'instant : un réglage écrit entre-temps par une autre personne n'est pas écrasé.
  async #unmark(candidates) {
    try {
      const now = await this.#doc.fetchTable(SECTIONS);
      const actions = candidates.map(item => {
        const at = now.id.indexOf(item.id);
        const text = at === -1 ? null : unmarked(now.options[at]);
        return text !== null && text !== now.options[at] ? ['UpdateRecord', SECTIONS, item.id, { options: text }] : null;
      }).filter(Boolean);
      if (actions.length) await this.#doc.applyUserActions(actions);
    } catch (error) {
      console.warn('GFS : une marque de recherche est restée dans les réglages d\'une vue', error);
    }
  }

  // Grist renvoie à GFS les réglages de SA section : ce qu'on vient d'écrire s'y retrouve, ou l'écriture a touché une autre section (ou un brouillon masque les
  // réglages enregistrés).
  #echoed(wanted) {
    return this.#until(async () => {
      const own = await this.#widget.getOptions();
      return wanted.every(([key, value]) => sameValue(own ? own[key] : undefined, value)) ? true : null;
    }, ECHO_WAIT_MS);
  }

  // L'écriture n'est pas revenue : elle est défaite, sauf si la section a changé depuis (on n'écrase pas le geste de quelqu'un d'autre).
  async #undo(target, written) {
    try {
      const now = await this.#doc.fetchTable(SECTIONS);
      const at = now.id.indexOf(target.id);
      if (at !== -1 && now.options[at] === written) await this.#doc.applyUserActions([['UpdateRecord', SECTIONS, target.id, { options: target.text }]]);
    } catch (error) {
      console.warn('GFS : l\'écriture d\'un réglage n\'a pas pu être défaite', error);
    }
  }

  #sleep(ms) { return new Promise(resolve => this.#timers.setTimeout(resolve, ms)); }

  // Interroge `check` jusqu'à une réponse non nulle, ou jusqu'au délai ; rend la réponse, ou null.
  async #until(check, limit) {
    for (let waited = 0; ; waited += POLL_MS) {
      const answer = await check();
      if (answer) return answer;
      if (waited >= limit) return null;
      await this.#sleep(POLL_MS);
    }
  }
}
