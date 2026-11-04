// La phrase d'état de l'app active (js/app-status.js) : « se charge… », « ne répond pas. » en rouge. Le porteur a vu (04/11) un « Form+ ne répond pas. » rester sur la liste des fichiers
// quand il est revenu à l'explorateur : la phrase parle de l'app, l'explorateur la cache tant qu'il la recouvre, et elle revient avec l'app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppStatus } from '../js/app-status.js';

// L'élément de la page, réduit à ce que AppStatus lit et écrit.
function fakeElement() {
  const classes = new Set();
  return { hidden: true, textContent: '', classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), contains: name => classes.has(name) } };
}
const shown = element => !element.hidden && element.textContent !== '';

test('une phrase dite est montrée, en rouge quand elle l\'est', () => {
  const element = fakeElement();
  const status = new AppStatus(element);
  status.say('Form+ se charge…');
  assert.ok(shown(element));
  assert.equal(element.textContent, 'Form+ se charge…');
  assert.equal(element.classList.contains('status--bad'), false);
  status.say('Form+ ne répond pas.', true);
  assert.equal(element.textContent, 'Form+ ne répond pas.');
  assert.equal(element.classList.contains('status--bad'), true);
});

test('un texte vide retire la phrase, et le rouge avec elle', () => {
  const element = fakeElement();
  const status = new AppStatus(element);
  status.say('Form+ ne répond pas.', true);
  status.say('');
  assert.equal(element.hidden, true);
  assert.equal(element.textContent, '');
  assert.equal(element.classList.contains('status--bad'), false);
});

test('l\'explorateur qui recouvre l\'app cache la phrase ; elle revient, la même, avec l\'app (le « ne répond pas » rouge ne restait pas à disparaître)', () => {
  const element = fakeElement();
  const status = new AppStatus(element);
  status.say('Form+ ne répond pas.', true);
  status.cover(true);
  assert.equal(shown(element), false, 'cachée sur l\'explorateur');
  assert.equal(element.textContent, '', 'et vide : un lecteur d\'écran ne la lit pas');
  assert.equal(element.classList.contains('status--bad'), false);
  status.cover(false);
  assert.ok(shown(element), 'de retour avec l\'app');
  assert.equal(element.textContent, 'Form+ ne répond pas.');
  assert.equal(element.classList.contains('status--bad'), true, 'toujours en rouge');
});

test('une phrase dite pendant que l\'explorateur est ouvert attend le retour à l\'app', () => {
  const element = fakeElement();
  const status = new AppStatus(element);
  status.cover(true);
  status.say('Form+ se charge…'); // l'app qu'on ouvre depuis l'explorateur : la phrase est dite avant que l'explorateur se ferme
  assert.equal(shown(element), false);
  status.cover(false);
  assert.ok(shown(element));
  assert.equal(element.textContent, 'Form+ se charge…');
});

test('une phrase retirée pendant que l\'explorateur est ouvert ne revient pas avec l\'app', () => {
  const element = fakeElement();
  const status = new AppStatus(element);
  status.say('Form+ ne répond pas.', true);
  status.cover(true);
  status.say(''); // l'app a été fermée (décochée dans « Apps ») : plus rien à dire
  status.cover(false);
  assert.equal(shown(element), false);
  assert.equal(element.classList.contains('status--bad'), false);
});
