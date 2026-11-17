// Ce que le contrôleur fait des liens entre espaces (contrats 11.7, point 13.o) : l'assistant « Lier dans un espace… » (l'espace, le nom ou le dossier du lien,
// le droit des groupes de cet espace : trois fenêtres du widget, sans rien de nouveau à dessiner), et « Retirer le lien » avec sa question. Seul un
// propriétaire écrit placements et partages : la phrase le dit aux autres. Le calcul est dans js/sharing/space-links.js ; GFS ne fait qu'écrire les lignes, et
// c'est Grist qui décide ensuite qui lit et qui écrit.

import { rowsOf } from '../rights/rights.js';
import { writeActions } from '../rights/rights-actions.js';
import { askName } from '../explorer/filing-window.js';
import { ask } from '../ui/ask-window.js';
import { pickFrom } from '../ui/pick-window.js';
import { PLACE_TABLE, SHARES_TABLE, SPACES_TABLE, spacesOf } from './sharing-model.js';
import { LINK_RIGHTS, groupsOfSpace, inSpace, linkAt, planLink, planLinkRemove } from './space-links.js';

const lastPart = path => String(path || '').split('/').filter(Boolean).pop() || '';

export class LinkControl {
  #o;

  // opts : { port, reader, t, container, inertTargets(), fullAccess(), writeBlock(), spaces() → ce que disent les espaces (js/sharing/spaces-filing.js) ou
  //   null,
  //   files() → les fichiers montrés, notice(texte), refresh() → relire les fichiers de l'explorateur, pick, askName, ask (pour les essais) }
  constructor(opts) { this.#o = opts; }

  // Pourquoi on ne lie rien depuis ici (une phrase), ou null : pas l'accès complet, le partage n'est pas activé (pas de table d'espaces), aucun espace.
  whyNot() {
    const { t } = this.#o;
    if (!this.#o.fullAccess()) return t('share.noAccess');
    const info = this.#o.spaces ? this.#o.spaces() : null;
    if (!info) return t('slink.why.off');
    return info.spaces.length ? null : t('slink.why.noSpace');
  }

  // Le lien que montre ce dossier de l'explorateur (le dossier du lien lui-même), ou null.
  linkAt(path) { return linkAt(this.#o.spaces ? this.#o.spaces() : null, path); }

  // Ce chemin est-il déjà pris dans l'espace (`where` : l'espace tel que le lisent les espaces partagés) : un dossier, un lien, ou un fichier rangé dedans ?
  #taken(where, path) {
    const full = `${where.path}/${path}`;
    const inside = folder => folder === full || String(folder).startsWith(`${full}/`);
    return this.#o.spaces().folders.some(inside) || (this.#o.files ? this.#o.files() : []).some(file => inside(file.folder));
  }

  // Écrit, puis fait relire les fichiers de l'explorateur : le lien (ou son retrait) se voit tout de suite.
  async #write(actions) {
    const done = await writeActions(this.#o, actions);
    if (done.ok && this.#o.refresh) await Promise.resolve(this.#o.refresh()).catch(error => console.warn('GFS : la relecture après un lien a échoué', error));
    return done;
  }

  async #read() {
    const read = async table => { try { return rowsOf(await this.#o.port.doc.fetchTable(table)); } catch (error) { return []; } };
    const [spaceRows, shareRows, placeRows] = await Promise.all([read(SPACES_TABLE), read(SHARES_TABLE), read(PLACE_TABLE)]);
    return { spaces: spacesOf(spaceRows, shareRows), shareRows, placeRows };
  }

  // L'assistant : `source` { target (la clé du fichier ou `dossier:<clé>/<chemin>`), name, kind ('folder' ou 'file') }. Rend true quand le lien est écrit.
  async open(source) {
    const { t, notice } = this.#o;
    const why = this.whyNot();
    if (why) { notice(why); return false; }
    if ((await this.#o.reader.owner()) !== true) { notice(t('slink.why.owner')); return false; }
    const state = await this.#read();
    const space = await this.#chooseSpace(source, state.spaces);
    if (!space) return false;
    if (!groupsOfSpace(space).length) { notice(t('slink.err.noGroup', { space: space.name })); return false; }
    // dit tout de suite, avant les autres questions
    if (inSpace(source.target, space)) { notice(t('slink.err.sameSpace', { space: space.name })); return false; }
    const folder = await this.#chooseFolder(source, space);
    if (folder === null) return false;
    const right = await this.#chooseRight(source, space);
    if (!right) return false;
    const plan = planLink({ source: source.target, space, folder, right, shareRows: state.shareRows, placeRows: state.placeRows, kind: source.kind });
    if (!plan.ok) { notice(t(`slink.err.${plan.reason}`, { space: space.name })); return false; }
    const done = await this.#write(plan.actions);
    notice(done.ok ? t('slink.done', { name: source.name, space: space.name, right: t(`slink.right.${right}.short`) }) : done.message);
    return done.ok;
  }

  async #chooseSpace(source, spaces) {
    const { t, container } = this.#o;
    const key = await (this.#o.pick || pickFrom)({ container, inertTargets: this.#o.inertTargets, t, title: t('slink.pick.title', { name: source.name }),
      text: t('slink.pick.text'), none: t('pick.none'), items: spaces.map(space => ({ value: space.key, label: space.name, glyph: 'folder' })) });
    return key ? spaces.find(space => space.key === key) || null : null;
  }

  // Un dossier se lie sous un nom (qui n'existe pas encore dans l'espace) ; un fichier se range dans un dossier de l'espace (ou à sa racine), choisi dans la
  // liste. Rend le chemin du dossier de l'espace ('' : la racine, pour un fichier), ou null quand la personne renonce.
  async #chooseFolder(source, space) {
    const { t, container } = this.#o;
    const base = { container, inertTargets: this.#o.inertTargets, t };
    const info = this.#o.spaces();
    const where = info.spaces.find(item => item.key === space.key);
    if (!where) return null;
    if (source.kind === 'folder') {
      const name = await (this.#o.askName || askName)({ ...base, title: t('slink.name.title', { space: space.name }), label: t('slink.name.label'),
        value: source.name, confirmLabel: t('slink.name.confirm'), clean: text => text.replace(/\s+/g, ' ').replace(/\//g, '').trim(),
        refuse: text => (!text ? t('slink.err.invalid') : (this.#taken(where, text) ? t('slink.err.nameTaken') : null)) });
      return name || null;
    }
    const prefix = `${where.path}/`;
    const folders = info.folders.filter(folder => folder.startsWith(prefix)).map(folder => folder.slice(prefix.length));
    return (this.#o.pick || pickFrom)({ ...base, title: t('slink.dir.title', { space: space.name }), text: t('slink.dir.text'), none: t('pick.none'),
      items: [{ value: '', label: t('slink.dir.root'), glyph: 'folder' }, ...folders.map(folder => ({ value: folder, label: folder, glyph: 'folder' }))] });
  }

  async #chooseRight(source, space) {
    const { t, container } = this.#o;
    return (this.#o.pick || pickFrom)({ container, inertTargets: this.#o.inertTargets, t, title: t('slink.right.title', { space: space.name }),
      text: t('slink.right.text', { name: source.name, groups: groupsOfSpace(space).join(', ') }), none: t('pick.none'),
      items: LINK_RIGHTS.map(right => ({ value: right, label: t(`slink.right.${right}`), glyph: right === 'lecture' ? 'read' : 'edit' })) });
  }

  // Retirer le lien (`link` : un lien de `spaces()`), après la question : sa ligne et les droits qu'il avait posés ; aucun fichier n'est touché.
  async remove(link) {
    const { t, container, notice } = this.#o;
    if ((await this.#o.reader.owner()) !== true) { notice(t('slink.why.owner')); return false; }
    const name = lastPart(link.folder) || link.space.name;
    if (!(await (this.#o.ask || ask)({ container, inertTargets: this.#o.inertTargets, title: t('slink.remove.title', { name }),
      message: t('slink.remove.message',
      { space: link.space.name }), confirmLabel: t('slink.remove.confirm'), cancelLabel: t('rights.ask.cancel'), safeFirst: true }))) return false;
    const { shareRows } = await this.#read();
    const plan = planLinkRemove(link, shareRows);
    const done = plan.ok ? await this.#write(plan.actions) : { ok: false, message: t('slink.err.invalid') };
    notice(done.ok ? t('slink.removed', { name }) : done.message);
    return done.ok;
  }
}
