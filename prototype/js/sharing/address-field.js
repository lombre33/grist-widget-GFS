// La saisie des personnes d'un groupe (demande du porteur du 25/11, « comme Google ») : par défaut, une adresse à la fois (on tape, Entrée, elle devient une
// pastille qu'un clic retire, on tape la suivante) ; la zone « plusieurs adresses à la fois » (une par ligne, ou séparées par des virgules : l'import en masse)
// est une option qu'on active. Rien ici ne parle à Grist : le champ rend le texte que `PersonnesIci` garde (une adresse par ligne).

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { splitAddresses, withAddress } from './group-suggest.js';

// La pastille d'une personne : son adresse et le bouton qui la retire.
function chipOf(t, address, remove) {
  const label = t('manage.groups.removeOne', { address });
  const button = h('button', { type: 'button', class: 'mg-chip-x', title: label, 'aria-label': label, dataset: { fk: `manage-person-remove-${address}` } },
    icon('x'));
  button.addEventListener('click', () => remove(address));
  return h('li', { class: 'mg-chip', dataset: { person: address } }, h('span', null, address), button);
}

// Les éléments du champ : la ligne de saisie avec ses pastilles, la zone « plusieurs adresses », la phrase d'erreur, la case qui change de zone, l'aide (que la
// phrase d'erreur remplace tant qu'elle est là : à 700 × 400, le bouton « Créer le groupe » reste ainsi visible).
function partsOf(t) {
  const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: 'email',
    'aria-label': t('manage.groups.person'),
    placeholder: t('manage.groups.person'), dataset: { fk: 'manage-group-people' } });
  const chips = h('ul', { class: 'mg-chips', 'aria-label': t('manage.groups.people.list') });
  const area = h('textarea', { rows: '3', 'aria-label': t('manage.groups.people'), placeholder: t('manage.groups.people'), spellcheck: 'false',
    dataset: { fk: 'manage-group-bulk' } });
  return { input, chips, area, box: h('div', { class: 'field mg-chipbox' }, icon('mail'), h('div', { class: 'mg-wrap' }, chips, input)),
    areaBox: h('div', { class: 'field mg-area', hidden: true }, area), error: h('p', { class: 'fine mg-err', hidden: true, 'aria-live': 'polite' }),
    toggle: h('input', { type: 'checkbox', dataset: { fk: 'manage-group-bulk-toggle' } }), hint: h('p', { class: 'fine' }, t('manage.groups.people.hint')) };
}

// opts : { t, value } (`value` : le texte déjà tapé du groupe). Rend { node, text(), take(), add(address), focus() } :
//   `text()` les adresses de la liste (sans ce qui est en train d'être tapé), `take()` le texte à écrire, ce qui attendait dans la ligne de saisie ajouté, ou
//   null
//   quand ce qui attend n'est pas une adresse (le champ le dit et garde le clavier), `add(address)` une adresse de plus (celle d'une suggestion).
export function addressField({ t, value = '' }) {
  const { input, chips, area, box, areaBox, error, toggle, hint } = partsOf(t);
  let list = [];
  const draw = () => { chips.replaceChildren(...list.map(address => chipOf(t, address, drop))); box.scrollTop = box.scrollHeight; };
  const push = good => { list = [...new Set([...list, ...good])]; draw(); };
  function drop(address) { list = list.filter(item => item !== address); draw(); input.focus(); }
  const complain = bad => {
    error.hidden = !bad.length;
    error.textContent = !bad.length ? '' : t(bad.length === 1 ? 'manage.groups.badAddress' : 'manage.groups.badAddresses', { address: bad.join(', ') });
    input.setAttribute('aria-invalid', String(bad.length > 0));
    hint.hidden = bad.length > 0;
  };
  // Les adresses du texte entrent dans la liste ; ce qui n'en est pas reste dans la ligne de saisie, avec la phrase qui le dit.
  const commit = text => {
    const { good, bad } = splitAddresses(text);
    push(good);
    input.value = bad.join(' ');
    complain(bad);
    return !bad.length;
  };
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (input.value.trim()) commit(input.value);
  });
  // Une adresse suivie d'un espace, d'une virgule ou d'un point-virgule entre seule ; un texte qui n'est pas une adresse attend Entrée (qui le dit).
  input.addEventListener('input', () => {
    complain([]);
    if (/[\s,;]$/.test(input.value) && !splitAddresses(input.value).bad.length) commit(input.value);
  });
  input.addEventListener('paste', event => {
    const pasted = event.clipboardData ? event.clipboardData.getData('text') : '';
    if (!pasted) return;
    event.preventDefault();
    commit(`${input.value} ${pasted}`);
  });
  // La case « plusieurs adresses à la fois » : la zone reprend les adresses en lignes (et ce qui attendait dans la ligne de saisie) ; en revenant, la zone
  // devient la liste.
  toggle.addEventListener('change', () => {
    const bulk = toggle.checked;
    if (bulk) area.value = [...list, ...input.value.split(/\s+/).filter(Boolean)].join('\n');
    else { list = []; commit(area.value); }
    if (bulk) { input.value = ''; complain([]); }
    box.hidden = bulk;
    areaBox.hidden = !bulk;
    hint.textContent = t(bulk ? 'manage.groups.people.hint.bulk' : 'manage.groups.people.hint');
    (bulk ? area : input).focus({ preventScroll: true });
  });
  if (value) commit(value);
  draw();
  return {
    node: h('div', { class: 'mg-people' }, box, areaBox, error, h('label', { class: 'mg-bulk' }, toggle, h('span', null, t('manage.groups.bulk'))), hint),
    text: () => (toggle.checked ? area.value : list.join('\n')),
    take() {
      if (toggle.checked) return area.value;
      if (commit(input.value)) return list.join('\n');
      input.focus({ preventScroll: true });
      return null;
    },
    add(address) { if (toggle.checked) area.value = withAddress(area.value, address); else push(splitAddresses(address).good); },
    focus: () => (toggle.checked ? area : input).focus({ preventScroll: true }),
  };
}
