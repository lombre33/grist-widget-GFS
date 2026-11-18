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

function ruleRow(t, app, rule) {
  const lines = [...rule.motifs.map(motif => reasonText(t, motif)), ...rule.notes.map(note => t(`sec.note.${note.replace(/'/g, '')}`))];
  if (app.permis && ['S3', 'S6'].includes(rule.id)) lines.push(permisText(t, app.permis));
  return h('li', { class: 'dp-sec-rule', dataset: { rule: rule.id, state: rule.etat } },
    stateChip(t, rule.etat),
    h('div', { class: 'dp-sec-main' }, h('strong', null, `${rule.id} · ${t(`sec.rule.${rule.id}`)}`),
      ...lines.filter(Boolean).map(line => h('p', { class: 'dp-sec-reason' }, line)),
      rule.says ? h('p', { class: 'dp-sub dp-says' }, t('sec.says', { text: rule.says.texte })) : null),
    sourceTag(t, rule.source));
}

// Une app : son nom, installée ou non, le verdict de sa politique, ses comptes, le site en ligne, puis ses neuf règles.
function appSection(t, app) {
  const id = `dp-s-${app.id}`;
  const head = h('header', { class: 'dp-group-head' }, h('h3', { id }, app.name),
    h('span', { class: `dp-chip dp-${app.installed ? 'ok' : 'muted'}` }, icon(app.installed ? 'check' : 'info'),
      t(app.installed ? 'sec.app.on' : 'sec.app.off')),
    app.checked ? h('span', { class: `dp-chip dp-${LOOK[app.policy][0]}`, dataset: { policy: app.policy } }, icon(LOOK[app.policy][1]),
      t('sec.policy', { state: t(`sec.state.low.${app.policy}`) })) : null);
  if (!app.checked) return h('section', { class: 'dp-sec-app', dataset: { app: app.id }, 'aria-labelledby': id }, head,
    h('p', { class: 'dp-sub dp-sec-line' }, t('sec.app.unchecked')));
  const c = app.counts;
  const live = t(`sec.live.${app.live.etat}`, { state: app.live.verdict ? t(`sec.state.low.${app.live.verdict}`) : '' });
  return h('section', { class: 'dp-sec-app', dataset: { app: app.id }, 'aria-labelledby': id }, head,
    h('p', { class: 'dp-sub dp-sec-line' }, [app.reference ? t('sec.app.ref', { ref: app.reference }) : '',
      t('sec.counts', { ok: c.tenue, note: c['a-noter'], bad: c['non-tenue'], unk: c['non-verifiable'] }), live].filter(Boolean).join(' · ')),
    h('ul', { class: 'dp-sec-rules' }, ...app.rules.map(rule => ruleRow(t, app, rule))));
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
    const origin = t(`sec.origin.${model.origine}`);
    node.replaceChildren(h('p', { class: 'dp-sec-intro' }, t('sec.intro', { date: formatDate(model.controle, locale), origin }),
      model.problems ? ` ${t('sec.problems', { n: model.problems })}.` : ''), limits(t), ...model.apps.map(app => appSection(t, app)));
  }
  return { node, render };
}
