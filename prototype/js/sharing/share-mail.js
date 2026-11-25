// « Prévenir par e-mail » dans la fenêtre « Partager » (choix du porteur, 25/11) : GFS n'envoie rien, comme l'Annuaire (js/annuaire/annuaire-mail.js) ; le
// bouton ouvre la messagerie de la personne qui partage, avec les adresses qu'elle vient d'ajouter en copie cachée, l'objet, et le lien de la page du document.
// Du code pur, essayé sous Node (test/share-mail.test.mjs).

import { MAILTO_LIMIT, addressesOf, mailLink } from '../annuaire/annuaire-mail.js';

const ADDRESS = /^[^@\s#]+@[^@\s]+\.[^@\s]+$/;

// Une personne désignée par son adresse : ni une catégorie (« @tous »), ni un groupe (« #nom »).
export const isAddress = who => ADDRESS.test(String(who ?? '').trim()) && !String(who).trim().startsWith('@');

// Le message pour les personnes qu'on vient d'ajouter : { href, count } ou { why } (la clé de la phrase qui dit pourquoi le bouton est grisé). `added` : les
// adresses ajoutées depuis l'ouverture de la fenêtre ; `by` : l'adresse de la personne qui partage ; `link` : la page du document (facultative).
export function shareMail({ t, name, by = '', added = [], link = '' }) {
  const addresses = addressesOf(added.filter(isAddress).map(email => ({ email })));
  if (!addresses.length) return { why: 'share.mail.none' };
  const subject = t('share.mail.subject', { name });
  const lines = [t('share.mail.hello'), '', t(by ? 'share.mail.body' : 'share.mail.bodyAnon', { name, by }),
    ...(link ? ['', t('share.mail.open', { link })] : [])];
  const withBody = `${mailLink(addresses)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  if (withBody.length <= MAILTO_LIMIT) return { href: withBody, count: addresses.length };
  // le lien serait coupé par la messagerie : sans le corps, l'objet seul dit l'essentiel
  const short = `${mailLink(addresses)}&subject=${encodeURIComponent(subject)}`;
  return short.length <= MAILTO_LIMIT ? { href: short, count: addresses.length } : { why: 'share.mail.long' };
}
