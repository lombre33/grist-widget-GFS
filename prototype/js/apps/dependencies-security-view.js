// Le tableau de bord de sécurité de la fenêtre « Dépendances » (cahier 3.2.2, choix du porteur du 18/11 : « une sorte de dashboard de sécurité pour que les
// utilisateurs sachent vraiment où ils en sont »). Pour chaque app, S1 à S9 une à une : un état en mots et en icône (jamais la couleur seule), les motifs que
// le contrôle a relevés, ce que l'app dit d'elle-même à côté, et d'où vient le jugement : « Vérifié par GFS » (GFS l'a lu), « Déclaré par l'app » (parole de
// l'app) ou « Pas vérifié ». Les limites de ce que GFS peut voir sont dites en clair, dans un panneau qui s'ouvre. Lecture seule : rien ne s'écrit ici. Les
// états viennent de js/apps/dependencies-security.js.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { formatDate } from './dependencies-model.js';

const LOOK = { tenue: ['ok', 'check'], 'a-noter': ['warn', 'warning'], 'non-tenue': ['bad', 'warning'], 'non-verifiable': ['muted', 'info'] };
const LIMITS = [1, 2, 3, 4];
// L'heure d'un instant ISO, dans la langue de la personne ; vide si l'instant est illisible.
function timeText(iso, locale) {
  try { return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch (error) { return ''; }
}
const joined = list => (Array.isArray(list) ? list.join(', ') : '');
const short = url => String(url).replace(/^https:\/\//, '').slice(0, 70);

export const stateChip = (t, etat) => h('span', { class: `dp-chip dp-${LOOK[etat][0]}` }, icon(LOOK[etat][1]), t(`sec.state.${etat}`));

// Le motif que le contrôle a écrit (un code et ses paramètres) en phrase. Deux codes ont deux phrases : un CDN qui sert des fichiers figés, une page lue sans
// le code.
function reasonText(t, motif) {
  const none = t('sec.noaddr');
  const advisories = (motif.avis || []).map(advisory => `${advisory.paquet} ${advisory.version} (${advisory.niveau}, ${advisory.id})`);
  let key = motif.code;
  if (key === 'empreinte-changee' && motif.immuable) key = 'empreinte-changee-fige';
  if (key === 'non-retrouvee' && !motif.codeLu) key = 'non-retrouvee-page';
  return t(`sec.m.${key}`, { directives: joined(motif.directives), directive: motif.directive, sources: joined(motif.sources), hotes: joined(motif.hotes) ||
    none, nombre: motif.nombre ?? (motif.avis || []).length,
    exemples: joined((motif.exemples || []).map(short)), adresses: joined((motif.adresses || []).map(short)), liste: joined(advisories) });
}

// Ce que la politique laisse atteindre : dit pour S3 (appels fermés) et S6 (rien ne quitte le document), où la personne le cherche.
function permisText(t, permis) {
  if (!permis) return null;
  if (permis.ouvert && permis.ouvert.length) return t('sec.permis.open', { directives: joined(permis.ouvert) });
  const hosts = (permis.adresses || []).map(address => address.hote);
  return hosts.length ? t('sec.permis.hosts', { hosts: joined(hosts) }) : t('sec.permis.none');
}

function sourceTag(t, source) {
  const look = { gfs: ['info', 'shield'], declared: ['muted', 'info'], none: ['muted', 'info'] }[source];
  return h('span', { class: `dp-chip dp-${look[0]} dp-sec-source` }, icon(look[1]), t(`sec.source.${source}`));
}

// Ce que cette session a vu du relais de l'app (S8) : actif (avec la version du kit et l'heure), ou rien reçu.
function relayText(t, relay, locale) {
  if (!relay) return t('sec.relay.off');
  return t(relay.kit ? 'sec.relay.on' : 'sec.relay.on.nokit', { kit: relay.kit, time: timeText(relay.at, locale) });
}

function ruleRow(t, app, rule, locale) {
  const lines = [...rule.motifs.map(motif => reasonText(t, motif)), ...rule.notes.map(note => t(`sec.note.${note.replace(/'/g, '')}`))];
  if (app.permis && ['S3', 'S6'].includes(rule.id)) lines.push(permisText(t, app.permis));
  if (rule.id === 'S8') lines.push(relayText(t, app.relay, locale));
  return h('li', { class: 'dp-sec-rule', dataset: { rule: rule.id, state: rule.etat } },
    stateChip(t, rule.etat),
    h('div', { class: 'dp-sec-main' }, h('strong', null, `${rule.id} · ${t(`sec.rule.${rule.id}`)}`),
      ...lines.filter(Boolean).map(line => h('p', { class: 'dp-sec-reason' }, line)),
      rule.says ? h('p', { class: 'dp-sub dp-says' }, t('sec.says', { text: rule.says.texte })) : null),
    sourceTag(t, rule.source));
}

// Une app : son nom, installée ou non, le verdict de sa politique, ses comptes, le site en ligne, puis ses neuf règles.
function appSection(t, app, locale) {
  const id = `dp-s-${app.id}`;
  const head = h('header', { class: 'dp-group-head' }, h('h3', { id }, app.name),
    h('span', { class: `dp-chip dp-${app.installed ? 'ok' : 'muted'}` }, icon(app.installed ? 'check' : 'info'),
      t(app.installed ? 'sec.app.on' : 'sec.app.off')),
    app.checked ? h('span', { class: `dp-chip dp-${LOOK[app.policy][0]}`, dataset: { policy: app.policy } }, icon(LOOK[app.policy][1]),
      t('sec.policy', { state: t(`sec.state.low.${app.policy}`) })) : null);
  if (!app.checked) return h('section', { class: 'dp-sec-app', dataset: { app: app.id }, 'aria-labelledby': id }, head,
    h('p', { class: 'dp-sub dp-sec-line' }, [t('sec.app.unchecked'), app.relay ? relayText(t, app.relay, locale) : ''].filter(Boolean).join(' · ')));
  const counts = app.counts;
  const live = t(`sec.live.${app.live.etat}`, { state: app.live.verdict ? t(`sec.state.low.${app.live.verdict}`) : '' });
  return h('section', { class: 'dp-sec-app', dataset: { app: app.id }, 'aria-labelledby': id }, head,
    h('p', { class: 'dp-sub dp-sec-line' }, [app.reference ? t('sec.app.ref', { ref: app.reference }) : '',
      t('sec.counts', { ok: counts.tenue, note: counts['a-noter'], bad: counts['non-tenue'], unk: counts['non-verifiable'] }), live]
      .filter(Boolean).join(' · ')),
    h('ul', { class: 'dp-sec-rules' }, ...app.rules.map(rule => ruleRow(t, app, rule, locale))));
}

// Ce que la cible d'un appel bloqué dit, en mots : un mot du navigateur, un nom d'hôte, ou « une adresse que GFS n'a pas pu lire ». Tout vient d'une app que
// GFS tient pour non fiable (js/broker/security-relay.js a déjà réduit chaque champ) : ici du texte, jamais un lien.
function targetText(t, cible) {
  return ['inline', 'eval', 'data', 'blob', 'self', 'wasm-eval', 'mediastream', 'filesystem', 'autre'].includes(cible) ? t(`sec.alert.kw.${cible}`) : cible;
}

function alertRow(t, alert, locale) {
  const by = alert.source === 'app' ? t('sec.alert.by.app') : ['inconnue', 'autre'].includes(alert.source) ? '' :
    t('sec.alert.by.host', { host: alert.source });
  const line = t(alert.disposition === 'report' ? 'sec.alert.line.report' : 'sec.alert.line',
    { directive: alert.directive, target: targetText(t, alert.cible), by });
  return h('li', { class: 'dp-sec-alert', dataset: { app: alert.app, directive: alert.directive } },
    h('span', { class: 'dp-chip dp-bad' }, icon('warning'), t('sec.alert.chip')),
    h('div', { class: 'dp-sec-main' }, h('strong', null, alert.name), h('p', { class: 'dp-sec-reason' }, line.replace(/\s+/g, ' ').replace(/ ([.,])/g, '$1')),
      h('p', { class: 'dp-sub dp-says' }, t('sec.alert.times', { n: alert.times, time: timeText(alert.first, locale) }))));
}

// « Appels bloqués depuis l'ouverture » : la liste des alertes de la session, ou la phrase qui dit qu'il n'y en a pas (et que seules les apps qui relaient
// peuvent en signaler).
function alertsSection(t, alerts, locale) {
  const title = h('h3', { id: 'dp-sec-alerts-title' }, t('sec.alerts.title'));
  const body = alerts.length ? h('ul', { class: 'dp-sec-alerts' }, ...alerts.map(alert => alertRow(t, alert, locale)))
    : h('p', { class: 'dp-sub dp-sec-line', role: 'status' }, t('sec.alerts.none'));
  return h('section', { class: 'dp-sec-alertbox', 'aria-labelledby': 'dp-sec-alerts-title', dataset: { alerts: String(alerts.length) } },
    h('header', { class: 'dp-group-head' }, title, alerts.length ? h('span', { class: 'dp-chip dp-bad' }, icon('warning'),
      t('sec.alerts.count', { n: alerts.length })) : null), body);
}

// Ce que GFS sert lui-même : ses adresses de CDN relues chez le CDN et les signatures du registre npm de ses paquets (outils/controle-catalogue.mjs). Un écart
// se dit en clair, avec la même ligne que les appels bloqués ; ce qui n'a pas encore été lu le dit aussi.
function catalogueRows(t, catalogue) {
  const row = (kind, text) => h('li', { class: 'dp-sec-alert', dataset: { cat: kind } },
    h('span', { class: 'dp-chip dp-bad' }, icon('warning'), t('sec.cat.chip')),
    h('div', { class: 'dp-sec-main' }, h('p', { class: 'dp-sec-reason' }, text)));
  return [...catalogue.cdn.differentes.map(entry => row('cdn', t('sec.cat.cdn.bad', { id: entry.id }))),
    ...catalogue.npm.problemes.map(each =>
      row('npm', t(`sec.cat.npm.${['invalide', 'absente', 'cle-inconnue'].includes(each.signature) ? each.signature : 'invalide'}`,
      { paquet: each.paquet, version: each.version })))];
}

function catalogueSection(t, catalogue, locale) {
  const { cdn, npm } = catalogue;
  const cdnLine = cdn.lu ? [t('sec.cat.cdn', { date: formatDate(cdn.lu, locale), ok: cdn.identiques, n: cdn.n }),
    cdn.nonLues ? t('sec.cat.cdn.unread', { n: cdn.nonLues }) : ''].filter(Boolean).join(' ') : t('sec.cat.cdn.none');
  const npmLine = npm.n && npm.nonVerifiees < npm.n ? t('sec.cat.npm', { date: formatDate(npm.releve, locale), ok: npm.valides, n: npm.n,
    prov: npm.provenance })
    : t('sec.cat.npm.none');
  const rows = catalogueRows(t, catalogue);
  return h('section', { class: 'dp-sec-alertbox', 'aria-labelledby': 'dp-sec-cat-title', dataset: { catalogue: String(catalogue.problems) } },
    h('header', { class: 'dp-group-head' }, h('h3', { id: 'dp-sec-cat-title' }, t('sec.cat.title')),
      catalogue.problems ? h('span', { class: 'dp-chip dp-bad' }, icon('warning'), t('sec.cat.count', { n: catalogue.problems })) : null),
    h('p', { class: 'dp-sub dp-sec-line' }, cdnLine), h('p', { class: 'dp-sub dp-sec-line' }, npmLine),
      rows.length ? h('ul', { class: 'dp-sec-alerts' }, ...rows) : null);
}

// Les limites : un bouton qui ouvre le panneau, comme celui des apps non installées.
function limits(t) {
  const body = h('div', { class: 'dp-sec-limits', id: 'dp-sec-limits', hidden: true }, h('ul', null, ...LIMITS.map(n => h('li', null, t(`sec.limits.${n}`)))));
  const button = h('button', { type: 'button', class: 'dp-more-btn', 'aria-expanded': 'false', 'aria-controls': 'dp-sec-limits',
    dataset: { fk: 'dep-sec-limits' } },
    icon('chev-down'), t('sec.limits'));
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
  });
  return h('div', { class: 'dp-more dp-sec-more' }, button, body);
}

// opts : { t, locale }. Rend { node, render(model) } : `model` vient de `securityOf` (js/apps/dependencies-security.js), ou null (le fichier manque : la vue le
//   dit).
export function buildSecurity({ t, locale }) {
  const node = h('section', { class: 'dp-sec', 'aria-label': t('dep.view.security'), hidden: true });
  function render(model) {
    if (!model) { node.replaceChildren(h('p', { class: 'dp-empty dp-sec-none', role: 'status' }, t('sec.none'))); return; }
    const intro = model.controle ? t('sec.intro', { date: formatDate(model.controle, locale), origin: t(`sec.origin.${model.origine}`) }) : t('sec.intro.none');
    node.replaceChildren(h('p', { class: 'dp-sec-intro' }, intro, model.problems ? ` ${t('sec.problems', { n: model.problems })}.` : ''),
      alertsSection(t, model.alerts, locale), ...(model.catalogue ? [catalogueSection(t, model.catalogue, locale)] : []),
      limits(t), ...model.apps.map(app => appSection(t, app, locale)));
  }
  return { node, render };
}
