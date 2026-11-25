// « Prévenir par e-mail » (js/sharing/share-mail.js, choix du porteur du 25/11) : le message que la messagerie de la personne ouvre pour celles qu'elle vient d'ajouter.
// GFS n'envoie rien ; le dessin du bouton à 700 × 400 se mesure sous Firefox (test/partager-firefox.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareMail, isAddress } from '../js/sharing/share-mail.js';
import { MAILTO_LIMIT } from '../js/annuaire/annuaire-mail.js';
import { createI18n } from '../js/i18n/i18n.js';

const FR = createI18n('fr');
const EN = createI18n('en');

test('seules les adresses de personnes comptent : ni une catégorie, ni un groupe, ni un texte qui n\'en est pas une', () => {
  assert.deepEqual(['a@b.fr', ' c@d.org ', '@tous', '@editeurs', '#compta', 'Camille', 'a@b', ''].map(isAddress), [true, true, false, false, false, false, false, false]);
});

test('le message : les personnes ajoutées en copie cachée, l\'objet, qui partage, et le lien du document', () => {
  const plan = shareMail({ t: FR.t, name: 'Contrat 2025.pdf', by: 'chef@exemple.org', added: ['a@b.fr', 'C@d.org', 'a@b.fr', '@tous'], link: 'https://grist.exemple.org/o/x/doc/p/3' });
  assert.equal(plan.count, 2, 'une adresse écrite deux fois n\'est écrite qu\'une fois, une catégorie n\'y est pas');
  assert.match(plan.href, /^mailto:\?bcc=a@b\.fr,C@d\.org&subject=/);
  const params = new URLSearchParams(plan.href.slice(plan.href.indexOf('?') + 1));
  assert.equal(params.get('subject'), '« Contrat 2025.pdf » vous est partagé dans Grist');
  assert.equal(params.get('body'), 'Bonjour,\n\nchef@exemple.org vous a partagé « Contrat 2025.pdf » dans Grist.\n\nOuvrez le document : https://grist.exemple.org/o/x/doc/p/3');
  const en = new URLSearchParams(shareMail({ t: EN.t, name: 'Deal.pdf', by: 'chef@exemple.org', added: ['a@b.fr'] }).href.split('?')[1]);
  assert.equal(en.get('body'), 'Hello,\n\nchef@exemple.org shared “Deal.pdf” with you in Grist.', 'sans lien, aucune ligne vide de plus');
});

test('sans adresse ajoutée, le bouton est grisé et dit pourquoi ; la personne qui partage peut rester inconnue', () => {
  assert.deepEqual(shareMail({ t: FR.t, name: 'A', added: [] }), { why: 'share.mail.none' });
  assert.deepEqual(shareMail({ t: FR.t, name: 'A', added: ['@tous', '#groupe'] }), { why: 'share.mail.none' });
  const anon = new URLSearchParams(shareMail({ t: FR.t, name: 'A', added: ['a@b.fr'] }).href.split('?')[1]);
  assert.equal(anon.get('body'), 'Bonjour,\n\nOn vous a partagé « A » dans Grist.');
});

test('un message trop long pour un lien : sans le corps d\'abord, puis grisé avec sa raison', () => {
  const some = Array.from({ length: 60 }, (_, i) => `personne${i}@exemple.org`);
  const link = `https://grist.exemple.org/${'x'.repeat(400)}`;
  const plan = shareMail({ t: FR.t, name: 'A', by: 'chef@exemple.org', added: some, link });
  assert.ok(plan.href && plan.href.length <= MAILTO_LIMIT && !/body=/.test(plan.href), 'l\'objet seul tient');
  const many = Array.from({ length: 200 }, (_, i) => `personne${i}@exemple.org`);
  assert.deepEqual(shareMail({ t: FR.t, name: 'A', added: many }), { why: 'share.mail.long' });
});
