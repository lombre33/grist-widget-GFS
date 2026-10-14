// Une app ouverte : son sous-cadre, sa conversation, ce que Grist lui dit. Une seule à la fois est reliée à Grist (contrats 1.4).

import { AppPeer } from './rpc.js';
import { makePolicy, lowestAccess, levelOf } from './filter.js';
import { sliceOf, sliceChanged } from './options-slice.js';
import { makeCallHandler } from './broker.js';
import { frameUrl, buildFrame } from './frames.js';
import { label } from './manifest.js';

const READY_TIMEOUT_MS = 15000;
const REVEAL_TIMEOUT_MS = 4000;

export class AppSession {
  #frame = null;
  #peer = null;
  #unsubscribe = null;
  #timers = [];
  #lastSlice;

  // ctx : { entry, manifest, catalogue, state, port, router, container, readonly, preferences, base, lang, onStatus }
  constructor(ctx) {
    this.ctx = ctx;
    this.manifest = ctx.manifest;
    this.id = ctx.manifest.id;
    this.access = lowestAccess(ctx.manifest.permissions.acces, ctx.state.grantedAccess);
    this.policy = makePolicy(ctx.manifest, ctx.catalogue);
    this.hasCustomOptions = false;
    this.visible = false;
  }

  // Un appel refusé est dit dans la console (avertissement) : c'est ce que lit l'auteur d'une app pour compléter son manifeste.
  #reporting(handler) {
    return async call => {
      try {
        return await handler(call);
      } catch (error) {
        if (error && /^GFS_/.test(error.code || '')) console.warn(`GFS : ${this.id} : ${call.iface}.${call.meth} refusé (${error.code}) : ${error.message}`);
        throw error;
      }
    };
  }

  get frameWindow() { return this.#frame && this.#frame.contentWindow; }
  get isReady() { return Boolean(this.#peer && this.#peer.isReady); }

  open() {
    const { ctx } = this;
    const env = {
      policy: this.policy, port: ctx.port, level: this.access, readonly: ctx.readonly,
      declared: this.policy.reglages, onConfigure: settings => { this.hasCustomOptions = Boolean(settings.hasCustomOptions); },
    };
    this.#peer = new AppPeer({
      send: msg => this.frameWindow.postMessage(msg, '*'),
      onCall: this.#reporting(makeCallHandler(env)),
      onMessage: data => this.#onAppMessage(data),
      onReady: () => this.#onReady(),
    });
    const url = frameUrl({ entry: ctx.entry, manifest: this.manifest, access: this.access, readonly: ctx.readonly, preferences: ctx.preferences, base: ctx.base });
    this.#frame = buildFrame(url, label(this.manifest.nom, ctx.lang));
    this.#frame.classList.add('app-frame--hidden');
    ctx.container.append(this.#frame);
    // Le routeur reconnaît la fenêtre dès que l'élément est dans la page : avant le premier message de l'app.
    ctx.router.setActive(this.frameWindow, data => this.#peer.receive(data));
    this.#unsubscribe = ctx.state.subscribe((kind, message) => this.#fromGrist(kind, message));
    ctx.onStatus('loading', this);
    this.#timers.push(setTimeout(() => { if (!this.isReady) ctx.onStatus('timeout', this); }, READY_TIMEOUT_MS));
  }

  // L'app n'a pas dit `themeInitialized` : on la montre quand même après un délai (Grist fait de même avec un cadre qui tarde).
  #reveal() {
    if (this.visible || !this.#frame) return;
    this.visible = true;
    this.#frame.classList.remove('app-frame--hidden');
  }

  #onAppMessage(data) {
    if (data && data.message === 'themeInitialized') this.#reveal();
  }

  // Le rejeu de l'état à l'app qui devient prête (contrats 4.2, point 2) : réglages, thème, état de la table.
  #onReady() {
    const { state } = this.ctx;
    if (state.options) this.#sendOptions(state.options, true);
    if (state.theme) this.#sendTheme(state.theme, true);
    if (state.table) this.#sendTable(state.table, true);
    this.ctx.onStatus('ready', this);
    this.#timers.push(setTimeout(() => this.#reveal(), REVEAL_TIMEOUT_MS));
  }

  #fromGrist(kind, message) {
    if (!this.isReady) return;
    if (kind === 'options') this.#sendOptions(message, false);
    else if (kind === 'theme') this.#sendTheme(message, false);
    else if (kind === 'table') this.#sendTable(message, false);
    else if (kind === 'record' && levelOf(this.access) >= levelOf('read table')) {
      this.#peer.postMessage({ tableId: message.tableId, rowId: message.rowId, dataChange: false });
    }
  }

  #sendOptions(message, fromReady) {
    const slice = sliceOf(message.options, this.policy.reglages);
    if (!fromReady && !sliceChanged(this.#lastSlice, slice)) return;
    this.#lastSlice = slice;
    const linking = message.settings && message.settings.linking;
    this.#peer.postMessage({ options: slice, settings: { accessLevel: this.access, linking }, fromReady: fromReady || undefined });
  }

  #sendTheme(message, fromReady) {
    this.#peer.postMessage({ theme: message.theme, fromReady: fromReady || undefined });
  }

  #sendTable(message, replay) {
    if (levelOf(this.access) < levelOf('read table')) return;
    this.#peer.postMessage({ tableId: message.tableId, rowId: message.rowId, dataChange: true, mappingsChange: replay ? true : message.mappingsChange });
  }

  // GFS appelle une fonction que l'app a enregistrée (`print`, `editOptions`).
  callApp(name, args, timeoutMs) { return this.#peer.callApp(name, args, timeoutMs); }

  show(visible) { if (this.#frame) this.#frame.classList.toggle('app-frame--behind', !visible); }

  // Rend le clavier à l'app (au retour de l'explorateur) : `focus()` est permis sur une fenêtre d'une autre origine.
  focus() { try { this.frameWindow.focus(); } catch (e) { /* cadre disparu */ } }

  close() {
    this.#timers.forEach(clearTimeout);
    this.#timers = [];
    if (this.#unsubscribe) this.#unsubscribe();
    if (this.#peer) this.#peer.close();
    this.ctx.router.clearActive();
    if (this.#frame) this.#frame.remove();
    this.#frame = null;
    this.#peer = null;
  }
}
