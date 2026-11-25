// Le bouton « Prévenir par e-mail » de la fenêtre « Partager » (js/sharing/share-window.js) : un lien « mailto: » grisé, avec sa raison, tant qu'aucune
// personne n'a été ajoutée par son adresse dans cette fenêtre ; le message se compose dans js/sharing/share-mail.js. GFS n'envoie rien.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { shareMail, isAddress } from './share-mail.js';

// o : { t, name (le fichier), link?() (la page du document), say(texte) (le bas de la fenêtre) }. Rend { node, paint(par), added(record, réponse) } : `paint`
//   recompose le message pour la personne qui partage (`par`), `added` note une personne ajoutée (si l'écriture a réussi) et le recompose.
export function mailButton({ t, name, link, say }) {
  const node = h('a', { class: 'btn', 'aria-disabled': 'true', target: '_blank', rel: 'noopener', dataset: { fk: 'share-mail' } }, icon('mail'),
    t('share.mail'));
  const people = new Set();
  let by = '';
  const paint = who => {
    if (typeof who === 'string') by = who;
    const plan = shareMail({ t, name, by, added: [...people], link: link ? link() : '' });
    if (plan.href) { node.href = plan.href; node.removeAttribute('aria-disabled'); node.title = t('share.mail.tip', { n: plan.count }); } else {
      node.removeAttribute('href');
      node.setAttribute('aria-disabled', 'true');
      node.title = t(plan.why);
    }
  };
  node.addEventListener('click', event => { if (node.getAttribute('aria-disabled') === 'true') { event.preventDefault(); say(node.title); } });
  const added = (record, answer) => {
    if (record && (!answer || answer.ok) && record.Droit !== 'aucun' && isAddress(record.Personne)) {
      people.add(String(record.Personne).trim().toLowerCase()); paint(); }
  };
  return { node, paint, added };
}
