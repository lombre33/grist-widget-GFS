// L'onglet « Options » du réglage de l'annuaire (module Annuaire, demande du porteur du 25/11 ; fenêtre « Réglages de l'annuaire » de la maquette, scène 13) :
// trois options. « Ma présence » : l'administrateur l'allume avec une colonne oui/non de la table des personnes (« apparaître dans l'annuaire »), chacun
// choisit alors d'apparaître ou non (js/annuaire/annuaire-presence.js). « À vérifier » : quels contrôles font monter la pastille
// (js/annuaire/annuaire-check.js) ; « départ dépassé » demande la colonne de la date de départ. « Écrire au groupe » : combien d'adresses par message, et si
// elles vont en Cci ou en « À » (js/annuaire/annuaire-mail.js). Une colonne qui manque se choisit dans la liste avec recherche, ou se crée (avec l'accord de la
// personne, dans sa propre fenêtre). Grisé, jamais masqué : un contrôle sans sa colonne reste là, avec ce qu'il lui faut. `host` : voir
// js/annuaire/annuaire-setup.js.

import { h } from '../ui/dom.js';
import { CHECK_KINDS, MAIL_PER } from './annuaire-config.js';
import { checkNeeds } from './annuaire-check.js';
import { pickColumn } from './annuaire-setup-path.js';
import { chooser, switchButton, iconButton, formRow } from './annuaire-setup-shared.js';

const PER_STEP = 5; // d'un cran du compteur « Par message »

// Un bloc : son titre, sa phrase, ses lignes.
const block = (title, sub, ...rows) => h('section', { class: 'an-ob' }, h('header', { class: 'an-ob-h' }, h('b', null, title), h('small', null, sub)),
  h('div', { class: 'an-ob-b' }, ...rows.filter(Boolean)));

// Une ligne « interrupteur, libellé, aide ».
function switchRow({ on, label, sub, fk, data, disabled = false, title = '' }) {
  return h('div', { class: `an-ob-row${disabled ? ' is-off' : ''}` }, switchButton({ on, label, fk, data, disabled, title }),
    h('span', { class: 'an-ob-t' }, h('b', null, label), sub ? h('small', null, sub) : null));
}

function presenceBlock(host) {
  const { t, draft } = host;
  const { presence } = draft.config;
  return block(t('an.opt.presence'), t('an.opt.presenceSub'),
    switchRow({ on: presence.on, label: t('an.opt.presenceOn'), sub: t('an.opt.presenceOnSub'), fk: 'op:on', data: { act: 'opt-presence' } }),
    formRow(t('an.opt.presenceCol'), chooser(t, 'op:col', presence.col, { act: 'opt-presence-col' })),
    h('p', { class: 'an-set-hint an-ob-note' }, t('an.opt.presenceNote')));
}

function checksBlock(host) {
  const { t, draft } = host;
  const { config } = draft;
  const rows = CHECK_KINDS.map(kind => {
    const needs = checkNeeds(kind, config);
    return switchRow({ on: config.checks.includes(kind) && !needs, label: t(`an.check.kind.${kind}`), sub: needs ? t(needs) : '', fk: `oc:${kind}`,
      data: { act: 'opt-check', kind }, disabled: Boolean(needs), title: needs ? t(needs) : '' });
  });
  const leave = formRow(t('an.opt.leave'), chooser(t, 'op:leave', config.leave, { act: 'opt-leave' }));
  return block(t('an.opt.checks'), t('an.opt.checksSub'), ...rows, leave);
}

function mailBlock(host) {
  const { t, draft } = host;
  const { per, to } = draft.config.mail;
  const stepper = h('span', { class: 'an-ob-step' }, iconButton(t, { glyph: 'minus', label: t('an.opt.perLess'), fk: 'om:less',
    data: { act: 'opt-per', by: String(-PER_STEP) },
    disabled: per <= MAIL_PER.min }), h('b', { 'aria-live': 'polite' }, String(per)), iconButton(t, { glyph: 'plus', label: t('an.opt.perMore'), fk: 'om:more',
    data: { act: 'opt-per', by: String(PER_STEP) }, disabled: per >= MAIL_PER.max }));
  const choice = (value, key) => h('button', { type: 'button', class: 'an-ob-seg-b', 'aria-pressed': String(to === value),
    dataset: { act: 'opt-to', to: value, fk: `om:${value}` } },
    t(key));
  return block(t('an.opt.mail'), t('an.opt.mailSub'), formRow(t('an.opt.per'), stepper),
    formRow(t('an.opt.to'), h('span', { class: 'an-ob-seg', role: 'group', 'aria-label': t('an.opt.to') }, choice('bcc', 'an.opt.bcc'),
      choice('to', 'an.opt.toPlain')),
      t('an.opt.toNote')));
}

export function optionsTab(host) {
  return h('div', { class: 'an-tabpanel an-obs' }, h('p', { class: 'an-set-help' }, host.t('an.opt.help')), presenceBlock(host), checksBlock(host),
    mailBlock(host));
}

// ---------- les gestes ----------

// Une colonne oui/non (ou de date) à choisir ou à créer ; null quand la personne renonce.
function pickOption(host, { title, text, type, genre, label, current }) {
  return pickColumn(host, { title, text, types: [{ type, label: host.t(label) }], filter: col => col.genre === genre, clear: true, current });
}

async function presenceColumn(host) {
  const { t, draft } = host;
  const { presence } = draft.config;
  const col = await pickOption(host, { title: t('an.opt.presencePick'), text: t('an.opt.presencePickText'), type: 'Bool', genre: 'bool', label: 'an.type.bool',
    current: presence.col });
  if (col === null) return false;
  presence.col = col;
  if (!col) presence.on = false;
  host.changed();
  host.focus('op:col');
  return Boolean(col);
}

async function presenceSwitch(host) {
  const { presence } = host.draft.config;
  if (!presence.on && !presence.col && !(await presenceColumn(host))) { host.focus('op:on'); return; }
  presence.on = !presence.on;
  host.repaint();
  host.focus('op:on');
}

async function leaveColumn(host) {
  const { t, draft } = host;
  const col = await pickOption(host, { title: t('an.opt.leavePick'), text: t('an.opt.leavePickText'), type: 'Date', genre: 'date', label: 'an.type.date',
    current: draft.config.leave });
  if (col === null) return;
  draft.config.leave = col;
  const { checks } = draft.config;
  // choisir la colonne allume le contrôle
  if (col && !checks.includes('dep')) draft.config.checks = CHECK_KINDS.filter(kind => kind === 'dep' || checks.includes(kind));
  host.changed();
  host.focus('op:leave');
}

const ACTS = Object.freeze({
  'opt-presence': host => void presenceSwitch(host),
  'opt-presence-col': host => void presenceColumn(host),
  'opt-leave': host => void leaveColumn(host),
  'opt-check': (host, data) => {
    const { config } = host.draft;
    config.checks = CHECK_KINDS.filter(kind => (kind === data.kind ? !config.checks.includes(kind) : config.checks.includes(kind)));
    host.repaint();
    host.focus(`oc:${data.kind}`);
  },
  'opt-per': (host, data) => {
    const { mail } = host.draft.config;
    mail.per = Math.min(MAIL_PER.max, Math.max(MAIL_PER.min, mail.per + Number(data.by)));
    host.repaint();
    host.focus(`om:${Number(data.by) < 0 ? 'less' : 'more'}`, 'om:less', 'om:more');
  },
  'opt-to': (host, data) => { host.draft.config.mail.to = data.to === 'to' ? 'to' : 'bcc'; host.repaint(); host.focus(`om:${data.to}`); },
});

// Rend true quand le geste est de cet onglet.
export function optionsAct(host, act, data) {
  const run = ACTS[act];
  if (run) run(host, data);
  return Boolean(run);
}
