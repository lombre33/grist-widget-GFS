// Le détail d'une ligne de la fenêtre « Dépendances » (js/apps/dependencies-window.js) : ce qui permet de l'auditer sans quitter GFS. Qui l'utilise, les
// fichiers que GFS en sert et leur empreinte, l'intégrité de la copie (recalculée à la demande), les adresses que le navigateur contacte en mode CDN, les avis
// de sécurité, la licence face à la GPL 3.0 et les liens vers le site et le dépôt. Rien ne s'y écrit ; les liens sont des adresses https lues dans le relevé
// commité de GFS, jamais dans un réglage ni un message.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { formatBytes } from '../weight/weight.js';
import { safeLink } from './dependencies-model.js';
import { verdict } from './dependencies-audit.js';

// Un lien qui s'ouvre dans un nouvel onglet, sans rien transmettre de la page.
export function externalLink(t, { href, what, name, text, cls = 'dp-link' }) {
  return h('a', { class: cls, href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': t('dep.d.link.label', { what, name }) }, text, icon('open'));
}

const fact = (title, ...content) => h('div', { class: 'dp-fact' }, h('dt', null, title), h('dd', null, ...content));

function usersFact(t, row) {
  if (!row.uses.length) return fact(t('dep.d.users'), t('dep.d.users.none'));
  return fact(t('dep.d.users'), h('ul', { class: 'dp-lines' }, ...row.uses.map(use =>
    h('li', null, t('dep.d.use', { app: use.appName, what: use.what, state: t(`dep.state.${use.state}`).toLowerCase() })))));
}

function filesFact(t, row, locale) {
  const lines = row.files.map(file => h('li', null,
    h('span', null, t('dep.d.file', { name: file.id, version: file.version, size: formatBytes(file.poids, locale, t) })),
    h('code', { class: 'dp-fp', title: t('dep.d.fingerprint') }, file.copie.integrite)));
  const cdn = row.files.filter(file => file.cdn);
  const note = !cdn.length ? null : h('p', { class: 'dp-sub' }, cdn.every(file => file.memeEmpreinte) ? t('dep.d.fingerprint.same') :
    t('dep.d.fingerprint.cdn'));
  return fact(t('dep.d.files'), h('ul', { class: 'dp-lines' }, ...lines), note);
}

function addressesFact(t, row) {
  const hosts = [...new Set(row.files.map(file => file.cdnHost).filter(Boolean))];
  return fact(t('dep.d.addresses'), hosts.length && row.files.every(file => file.cdn) ? t('dep.d.addresses.cdn', { hosts: hosts.join(', ') }) :
    t('dep.d.addresses.none'));
}

// Un avis : son niveau et son titre, l'adresse de sa fiche, la version qui le corrige.
function advisoryLine(t, row, advisory) {
  const level = t(`dep.level.${advisory.niveau}`);
  const href = safeLink(advisory.url);
  const fixed = advisory.corrigeEn ? t('dep.d.advisory.fixed', { version: advisory.corrigeEn }) : t('dep.d.advisory.nofix');
  return h('li', null, h('span', { class: 'dp-chip dp-bad' }, icon('warning'), t('dep.gap.avis', { level })), ' ', advisory.titre, ' · ',
    href ? externalLink(t, { href, what: advisory.id, name: row.paquet, text: advisory.id }) : advisory.id, ' · ', fixed);
}

function advisoriesFact(t, row, surveyed) {
  if (!row.advisories.length) return fact(t('dep.d.advisories'), row.releveAncien ? t('dep.d.stale', { version: row.version }) :
    t('dep.d.advisories.none', { date: surveyed }));
  return fact(t('dep.d.advisories'), h('ul', { class: 'dp-lines' }, ...row.advisories.map(advisory => advisoryLine(t, row, advisory))));
}

function licenceFact(t, row) {
  return fact(t('dep.d.licence'), row.licenceFit === 'inconnue' ? t('dep.d.licence.inconnue') : t(`dep.d.licence.${row.licenceFit}`, { licence: row.licence }));
}

function linksFact(t, row) {
  const links = [['dep.d.site', row.site], ['dep.d.repo', row.depot]].filter(([, href]) => href).map(([key, href]) =>
    externalLink(t, { href, what: t(key), name: row.paquet, text: t(key) }));
  return links.length ? fact(t('dep.d.links'), h('span', { class: 'dp-links' }, ...links)) : null;
}

// Le texte du résultat de la vérification : `state` est `null` (pas encore demandée), `'running'` ou la liste des résultats de `verifyCopy`.
export function integrityText(t, state) {
  if (!state) return '';
  if (state === 'running') return t('dep.d.verifying');
  const kind = verdict(state);
  if (kind === 'ok') return state.length > 1 ? t('dep.d.ok.n', { n: state.length }) : t('dep.d.ok');
  if (kind === 'different') return t('dep.d.different', { file: state.find(result => result.state === 'different').address.split('/').pop() });
  return t('dep.d.error', { reason: (state.find(result => result.state === 'erreur') || {}).reason || '' });
}

// Rend { node, setIntegrity(state) }. `verify()` : le geste de la personne (le bouton « Vérifier la copie ») ; `state` : ce qu'une vérification déjà faite a
// rendu.
export function buildDetail({ t, locale, row, surveyed, state, verify }) {
  const status = h('span', { class: 'dp-integrity', role: 'status', 'aria-live': 'polite' }, integrityText(t, state));
  const button = h('button', { type: 'button', class: 'btn sm dp-verify', dataset: { fk: `dep-verify-${row.key}` }, on: { click: verify } }, icon('check'),
    t('dep.d.verify'));
  const facts = [usersFact(t, row), filesFact(t, row, locale), fact(t('dep.d.integrity'), button, status), addressesFact(t, row),
    advisoriesFact(t, row, surveyed),
    licenceFact(t, row), linksFact(t, row)].filter(Boolean);
  const setIntegrity = next => { status.textContent = integrityText(t, next); button.disabled = next === 'running'; };
  setIntegrity(state);
  return { node: h('div', { class: 'dp-detail' }, h('dl', { class: 'dp-facts' }, ...facts)), setIntegrity };
}
