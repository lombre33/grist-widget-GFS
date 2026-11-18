// Le bouton « LanguageTool » de la barre (js/shell/dock-assembly.js, contrats 5.2, point 13) : ce que le bouton et la ligne des réglages font quand le navigateur ne
// retient pas le choix, et à qui l'état suivant est dit. Le montage de la barre elle-même se mesure dans le labo (« vrai Grist ») et sous Firefox.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LangtoolBar } from '../js/shell/dock-assembly.js';

function bench({ kept = true, shown = false, session = null } = {}) {
  const log = [];
  const correcteurs = {
    state: { shown, coupes: false },
    toggleCut: () => { log.push('toggleCut'); return kept; },
    setShown: on => { log.push(`setShown:${on}`); return kept; },
  };
  const bar = new LangtoolBar({
    correcteurs, dock: { setLt: state => log.push(['setLt', state]) }, session: () => session,
    notice: text => log.push(['notice', text]), t: key => `t:${key}`,
  });
  return { bar, log };
}

test('le bouton de la barre coupe ou rallume ; si le navigateur ne retient pas le choix, GFS le dit', () => {
  const kept = bench();
  kept.bar.toggle();
  assert.deepEqual(kept.log, ['toggleCut']);
  const lost = bench({ kept: false });
  lost.bar.toggle();
  assert.deepEqual(lost.log, ['toggleCut', ['notice', 't:lang.notKept']]);
});

test('la ligne « Bouton LanguageTool » inverse l\'état courant, et le dit aussi quand le choix n\'est pas retenu', () => {
  const off = bench({ shown: false });
  off.bar.choose();
  assert.deepEqual(off.log, ['setShown:true']);
  const on = bench({ shown: true, kept: false });
  on.bar.choose();
  assert.deepEqual(on.log, ['setShown:false', ['notice', 't:lang.notKept']]);
});

test('un nouvel état : la barre le montre ; l\'app ouverte n\'est prévenue que si « coupés » a changé', () => {
  const sent = [];
  const session = { sendCorrecteurs: message => sent.push(message) };
  const b = bench({ session });
  b.bar.sync({ shown: true, coupes: true }, { shown: true, coupes: false });
  b.bar.sync({ shown: false, coupes: true }, { shown: true, coupes: true });
  assert.deepEqual(sent, [{ coupes: true }], 'la seconde synchro ne change pas « coupés » : l\'app n\'a rien à apprendre');
  assert.equal(b.log.filter(entry => entry[0] === 'setLt').length, 2, 'la barre se met à jour à chaque fois');
});

test('sans app ouverte, l\'état se montre dans la barre et rien n\'est envoyé', () => {
  const b = bench({ session: null });
  assert.doesNotThrow(() => b.bar.sync({ shown: true, coupes: true }, { shown: true, coupes: false }));
  assert.deepEqual(b.log, [['setLt', { shown: true, coupes: true }]]);
});
