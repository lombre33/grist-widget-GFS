// Le relais des appels bloqués (contrats 5.4, point 14 ; cahier 3.2.2, règle S8) : une app dont la politique de sécurité bloque un appel le dit à GFS, par le
// kit (`Violations.start()`, kit 0.25.0). GFS
// ne voit un cadre d'app que de l'extérieur : une violation de politique ne se lève que dans le cadre qui la subit (faits vérifiés 133). **Cela informe, cela
// ne protège pas** : la protection est la
// politique de l'app, appliquée par le navigateur ; un code piraté peut taire son propre relais.
// L'app est tenue pour **non fiable** : tout ce qu'elle dit est réduit à une forme fermée (un nom de directive connu, un mot du navigateur ou un nom d'hôte, un
// compte plafonné) avant d'être gardé ;
// rien n'est affiché comme lien, rien n'est écrit dans le document, rien ne dépasse la session. Au plus 50 alertes différentes par app, trois avis à la
// personne par app.
// Du code sans accès à la page : l'hôte donne `appName(id)`, `t(clé, vars)`, `notice(texte)` et `now()`.

const DIRECTIVES = new Set(['default-src', 'script-src', 'script-src-elem', 'script-src-attr', 'style-src', 'style-src-elem', 'style-src-attr', 'img-src',
  'font-src', 'connect-src', 'media-src',
  'object-src', 'frame-src', 'child-src', 'worker-src', 'manifest-src', 'base-uri', 'form-action', 'frame-ancestors', 'navigate-to']);
const KEYWORDS = new Set(['inline', 'eval', 'data', 'blob', 'self', 'wasm-eval', 'mediastream', 'filesystem']);
const HOST = /^[a-z0-9](?:[a-z0-9.-]{0,98}[a-z0-9])?$/;
const KIT = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
export const MAX_ALERTS = 50;
export const MAX_NOTICES = 3;
export const MAX_TIMES = 99999;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const word = (value, allowed, fallback) => (typeof value === 'string' && allowed.has(value) ? value : fallback);
const host = (value, fallback) => (typeof value === 'string' && HOST.test(value) ? value : fallback);

// Ce que l'app a dit d'une violation, réduit à la forme fermée de 5.4 point 14 : { directive, cible, source, disposition, fois }.
export function readViolation(args) {
  const times = Number.isInteger(args.fois) ? Math.min(Math.max(args.fois, 1), MAX_TIMES) : 1;
  return {
    directive: word(args.directive, DIRECTIVES, 'autre'),
    cible: KEYWORDS.has(args.cible) ? args.cible : host(args.cible, 'autre'),
    source: ['app', 'inconnue', 'autre'].includes(args.source) ? args.source : host(args.source, 'autre'),
    disposition: args.disposition === 'report' ? 'report' : 'enforce',
    fois: times,
  };
}

export class SecurityRelay {
  #host;
  #apps = new Map();

  // host : { appName(id), t(clé, vars), notice(texte), now() -> Date }
  constructor(host) { this.#host = host; }

  // L'appel `securite` de l'app, pour la table des poignées de l'enveloppe (5.1) : sans réponse (l'app n'en attend pas, et un refus n'apprendrait rien à un
  // code piraté).
  handlers(session) {
    return { securite: args => { this.receive(session.id, args); } };
  }

  #entry(appId) {
    if (!this.#apps.has(appId)) this.#apps.set(appId, { relay: null, alerts: new Map(), notices: 0 });
    return this.#apps.get(appId);
  }

  // `args` : ce que l'app a envoyé, jamais cru. `{ quoi: 'relais', kit }` : le relais de cette app est actif pour la session ; `{ quoi: 'bloque', … }` : une
  //   violation.
  receive(appId, args) {
    if (!isObject(args)) return;
    const at = this.#host.now().toISOString();
    if (args.quoi === 'relais') { this.#entry(appId).relay = { kit: typeof args.kit === 'string' && KIT.test(args.kit) ? args.kit : null, at }; return; }
    if (args.quoi !== 'bloque') return;
    const entry = this.#entry(appId);
    const violation = readViolation(args);
    const key = `${violation.directive}|${violation.cible}|${violation.source}`;
    const known = entry.alerts.get(key);
    if (known) { known.times = Math.max(known.times, violation.fois); known.last = at; return; }
    if (entry.alerts.size >= MAX_ALERTS) return;
    entry.alerts.set(key, { app: appId, directive: violation.directive, cible: violation.cible, source: violation.source, disposition: violation.disposition,
      times: violation.fois, first: at, last: at });
    if (entry.notices < MAX_NOTICES && violation.disposition === 'enforce') {
      entry.notices += 1;
      const named = KEYWORDS.has(violation.cible) || violation.cible === 'autre' ? this.#host.t(`sec.alert.kw.${violation.cible}`) : violation.cible;
      this.#host.notice(this.#host.t('sec.alert.notice', { app: this.#host.appName(appId), directive: violation.directive, target: named }));
    }
  }

  // Ce que la session a vu : { relays: { <app>: { kit, at } }, alerts: [{ app, directive, cible, source, disposition, times, first, last }] } (les plus
  // récentes d'abord).
  snapshot() {
    const relays = {};
    const alerts = [];
    for (const [appId, entry] of this.#apps) {
      if (entry.relay) relays[appId] = { ...entry.relay };
      for (const alert of entry.alerts.values()) alerts.push({ ...alert });
    }
    return { relays, alerts: alerts.sort((a, b) => b.last.localeCompare(a.last)) };
  }
}
