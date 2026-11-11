// Le lecteur de vidéos que GFS pose par-dessus l'app (contrats 3.4 point 7, 5.1 (tableau), 5.2 point 11) : Slides+ (Publipostage+) ne peut pas jouer une vidéo
// YouTube ou Vimeo dans son propre cadre (le bac à sable d'une app donne l'origine « null » à tout cadre qu'elle contient), elle demande donc à GFS de poser le
// lecteur à l'endroit où se trouve sa vignette. Carte du porteur du 07/11 : « Politique élargie » : la politique de sécurité de GFS nomme les deux sites
// (`frame-src`), le cadre du lecteur est posé directement dans la page de GFS, sans page relais.
//
// L'app envoie quatre appels sans `id` (GFS ne répond rien ; un refus se lit en console) : `lecteur.afficher`, `lecteur.deplacer`, `lecteur.masquer`,
// `lecteur.fermer`. L'adresse du lecteur est montée ICI, d'après le site et l'identifiant de la vidéo : jamais une adresse venue de l'app. Un seul lecteur à la
// fois ; il disparaît quand l'app est cachée ou fermée. Ce module ne lit rien dans Grist.

import { ERR, Refus } from './filter.js';
import { PROVIDERS } from './player-sites.js';

const ID_RE = /^[a-z][a-z0-9_-]{0,63}$/;
const VIDEO_RE = Object.freeze({ youtube: /^[A-Za-z0-9_-]{11}$/, vimeo: /^\d{1,15}(\/[A-Za-z0-9]{1,32})?$/ });
const START_MAX = 360000; // 100 heures : au-delà, c'est une faute
const COORD_MAX = 1000000;

const refuse = message => new Refus(ERR.REFUSE, message);
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= COORD_MAX;

// Un rectangle `{ x, y, largeur, hauteur }` en pixels du cadre de l'app (le rectangle de l'objet, ou la zone où il peut se voir).
function readBox(value, name, call) {
  if (!isObject(value) || !['x', 'y', 'largeur', 'hauteur'].every(key => finite(value[key])) || value.largeur < 0 || value.hauteur < 0) {
    throw refuse(`${call} : ${name} doit être { x, y, largeur, hauteur } en nombres, la largeur et la hauteur au moins 0.`);
  }
  return { x: value.x, y: value.y, width: value.largeur, height: value.hauteur };
}

function readId(args, call) {
  if (typeof args.id !== 'string' ||
    !ID_RE.test(args.id)) throw refuse(`${call} : id doit être un mot en minuscules (lettres, chiffres, _ et -, 64 signes au plus).`);
  return args.id;
}

// `lecteur.afficher { id, fournisseur, video, debut?, rect, zone }` -> { id, provider, video, start, rect, zone }. `allowed` : les sites que l'app a déclarés.
export function readShow(args, allowed) {
  const call = 'lecteur.afficher';
  const id = readId(args, call);
  const provider = args.fournisseur;
  if (!allowed.includes(provider)) throw refuse(`${call} : fournisseur doit être l'un de ceux que l'app a déclarés (${allowed.join(', ') || 'aucun'}).`);
  if (typeof args.video !== 'string' || !VIDEO_RE[provider].test(args.video)) throw refuse(
    `${call} : video doit être l'identifiant seul d'une vidéo ${provider}, jamais une adresse.`);
  const start = args.debut === undefined ? 0 : args.debut;
  if (!Number.isInteger(start) || start < 0 || start > START_MAX) throw refuse(`${call} : debut doit être un nombre entier de secondes, au moins 0.`);
  return { id, provider, video: args.video, start, rect: readBox(args.rect, 'rect', call), zone: readBox(args.zone, 'zone', call) };
}

// `lecteur.deplacer { id, rect, zone }`, `lecteur.masquer { id, masque }`, `lecteur.fermer { id }`.
export function readMove(args) {
  const call = 'lecteur.deplacer';
  return { id: readId(args, call), rect: readBox(args.rect, 'rect', call), zone: readBox(args.zone, 'zone', call) };
}

export function readHide(args) {
  const call = 'lecteur.masquer';
  if (typeof args.masque !== 'boolean') throw refuse(`${call} : masque doit valoir true ou false.`);
  return { id: readId(args, call), hidden: args.masque };
}

export const readClose = args => ({ id: readId(args, 'lecteur.fermer') });

// L'adresse du lecteur, montée d'après le site et l'identifiant de la vidéo (`video` a déjà passé `readShow`). YouTube « sans cookie » ; Vimeo : le suffixe
// `/<clé>` d'une vidéo non listée devient `?h=<clé>`.
export function playerUrl({ provider, video, start }) {
  if (provider === 'youtube') {
    const url = new URL(`https://www.youtube-nocookie.com/embed/${video}`);
    url.searchParams.set('rel', '0');
    url.searchParams.set('playsinline', '1');
    url.searchParams.set('autoplay', '1');
    if (start > 0) url.searchParams.set('start', String(start));
    return url.href;
  }
  const [number, key] = video.split('/');
  const url = new URL(`https://player.vimeo.com/video/${number}`);
  if (key) url.searchParams.set('h', key);
  url.searchParams.set('autoplay', '1');
  if (start > 0) url.hash = `t=${start}s`;
  return url.href;
}

// La partie du lecteur qui se voit : le rectangle de l'objet, rogné à la zone de l'app et au cadre de l'app (tout en pixels du cadre). Rend `null` quand rien
// ne se voit. `inner` : où poser le cadre du fournisseur dans la fenêtre rognée (le rectangle entier, décalé de l'origine de la fenêtre).
export function visiblePart(rect, zone, frame) {
  const left = Math.max(rect.x, zone.x, 0);
  const top = Math.max(rect.y, zone.y, 0);
  const right = Math.min(rect.x + rect.width, zone.x + zone.width, frame.width);
  const bottom = Math.min(rect.y + rect.height, zone.y + zone.height, frame.height);
  if (!(right > left) || !(bottom > top)) return null;
  return { x: left, y: top, width: right - left, height: bottom - top, inner: { x: rect.x - left, y: rect.y - top, width: rect.width, height: rect.height } };
}

// Les attributs du cadre du fournisseur. `sandbox` : il garde son origine (il en a besoin pour son stockage) mais ne peut ni naviguer GFS, ni ouvrir de fenêtre
// modale, ni envoyer de formulaire ;
// `allow` : ce que Grist délègue à GFS n'est pas plus large (mesuré, faits vérifiés 50 ; `fullscreen` y suffit, l'attribut `allowfullscreen` en plus fait dire
//   à Chromium « Allow attribute will take precedence ») ; `referrerpolicy` : YouTube refuse un lecteur sans référent.
const FRAME_ATTRIBUTES = Object.freeze({
  sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox',
  allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
  referrerpolicy: 'strict-origin-when-cross-origin',
});

export class Player {
  #container;
  #doc;
  #warn;
  #current = null; // { session, request, wrapper, frame, hidden }
  #observer = null;

  // `container` : l'élément qui porte les cadres des apps (`.frames`) ; le lecteur y est posé après eux.
  constructor({ container, doc = document, warn = console.warn }) {
    this.#container = container;
    this.#doc = doc;
    this.#warn = warn;
  }

  // Les quatre appels de l'app (contrats 5.1) : sans `id` d'appel, donc un refus se lit en console.
  handlers(session) {
    const guarded = (name, run) => args => {
      try { return run(args); } catch (error) {
        if (error && error.code) this.#warn(`GFS : ${session.id} : ${name} refusé (${error.code}) : ${error.message}`);
        throw error;
      }
    };
    return {
      'lecteur.afficher': guarded('lecteur.afficher', args => this.#show(session, readShow(args, session.policy.lecteurs))),
      'lecteur.deplacer': guarded('lecteur.deplacer', args => this.#move(session, readMove(args))),
      'lecteur.masquer': guarded('lecteur.masquer', args => this.#hide(session, readHide(args))),
      'lecteur.fermer': guarded('lecteur.fermer', args => this.#close(session, readClose(args))),
    };
  }

  get current() { return this.#current && this.#current.request.id; }

  // L'app est cachée ou fermée : son lecteur disparaît (une vidéo ne joue pas derrière l'explorateur).
  closeFor(session) {
    if (this.#current && this.#current.session === session) this.#remove();
  }

  #show(session, request) {
    if (!session.frameElement || session.shown === false) return; // une app cachée derrière l'explorateur ne pose rien par-dessus lui
    this.#remove();
    const wrapper = this.#doc.createElement('div');
    wrapper.className = 'player';
    const frame = this.#doc.createElement('iframe');
    for (const [name, value] of Object.entries(FRAME_ATTRIBUTES)) frame.setAttribute(name, value);
    frame.title = request.provider === 'youtube' ? 'YouTube' : 'Vimeo';
    frame.src = playerUrl(request);
    wrapper.append(frame);
    this.#container.append(wrapper);
    this.#current = { session, request, wrapper, frame, hidden: false };
    if (this.#doc.defaultView && this.#doc.defaultView.ResizeObserver) {
      this.#observer = new this.#doc.defaultView.ResizeObserver(() => this.#place());
      this.#observer.observe(session.frameElement);
    }
    this.#place();
  }

  #move(session, { id, rect, zone }) {
    if (!this.#ofSession(session, id)) return;
    Object.assign(this.#current.request, { rect, zone });
    this.#place();
  }

  #hide(session, { id, hidden }) {
    if (!this.#ofSession(session, id)) return;
    this.#current.hidden = hidden;
    this.#place();
  }

  #close(session, { id }) {
    if (this.#ofSession(session, id)) this.#remove();
  }

  // Le lecteur de CETTE app, sous cet `id` : une app ne touche pas à ce qu'elle n'a pas posé.
  #ofSession(session, id) {
    return Boolean(this.#current && this.#current.session === session && this.#current.request.id === id);
  }

  #remove() {
    if (this.#observer) this.#observer.disconnect();
    this.#observer = null;
    if (this.#current) this.#current.wrapper.remove();
    this.#current = null;
  }

  // La fenêtre rognée et le cadre du fournisseur dans le repère de `container` : le cadre de l'app est mesuré à chaque fois (la page peut changer de taille, la
  // barre de GFS se déplacer).
  #place() {
    const now = this.#current;
    if (!now) return;
    const appFrame = now.session.frameElement;
    const part = !now.hidden && appFrame ? visiblePart(now.request.rect, now.request.zone, { width: appFrame.clientWidth, height: appFrame.clientHeight }) :
      null;
    now.wrapper.hidden = !part;
    if (!part) return;
    const outer = this.#container.getBoundingClientRect();
    const box = appFrame.getBoundingClientRect();
    const origin = { x: box.left + appFrame.clientLeft - outer.left, y: box.top + appFrame.clientTop - outer.top };
    const set = (el, left, top, width, height) => {
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    };
    set(now.wrapper, origin.x + part.x, origin.y + part.y, part.width, part.height);
    set(now.frame, part.inner.x, part.inner.y, part.inner.width, part.inner.height);
  }
}
