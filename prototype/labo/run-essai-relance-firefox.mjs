// La page d'essai de la relance de LanguageTool (labo/essais-navigateur/relance.html) dans un vrai Firefox sans écran, à la vraie souris (test/firefox.mjs), le navigateur de la personne : le cadre isolé comme celui
// d'une app dans GFS naît avec ses zones cachées (partie A) et gelées (partie B), « Montrer les zones » et « Rendre modifiables » les montrent et les rendent modifiables et relancent A1 à A3 et B1 à B3 chacune à sa
// façon (A0 et B0 jamais marquées), et le rapport le dit. Sans Firefox (`labo/installer-firefox.sh`, deux minutes) l'essai est sauté. Il n'y a pas d'extension ici : la réponse qui compte, « LanguageTool démarre-t-il
// dans une zone cachée ou gelée ? », est celle de la personne.
import { join } from 'node:path';
import { findFirefox, serveSite, startFirefox } from '../test/firefox.mjs';
import { say, check, LAB } from './lab-common.mjs';

const binary = findFirefox();
if (!binary) { say('Firefox absent (bash labo/installer-firefox.sh) : essai sauté'); process.exit(0); }
const site = await serveSite(join(LAB, 'essais-navigateur'));
const firefox = await startFirefox(binary);
const { page } = firefox;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await page.goto(`${site.url}/relance.html`);
  await page.view({ width: 1000, height: 1300 });
  await page.until(() => /origine du cadre/.test(document.getElementById('rapport').value), [], 15000);
  const frameState = () => page.runInFrame('relance-cadre.html', () => Object.fromEntries([...document.querySelectorAll('.editable')].map(e => [e.id, `${e.getClientRects().length > 0 ? 'montrée' : 'cachée'}/${e.getAttribute('contenteditable')}/${e.getAttribute('data-lt-active') ?? 'sans marque'}`])));
  const geo = () => page.runInFrame('relance-cadre.html', () => {
    const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
    return { montrer: rect('montrer'), cacher: rect('cacher'), degeler: rect('degeler'), t0: rect('t0'), a0: rect('a0'), b0: rect('b0') };
  });
  const frameBox = await page.run(() => { const r = document.querySelector('iframe').getBoundingClientRect(); return [r.x, r.y]; });
  const click = async key => { const [x, y, w, h] = (await geo())[key]; await page.click(frameBox[0] + 1 + x + w / 2, frameBox[1] + 1 + y + h / 2); };

  let zones = await frameState();
  check('au départ (Firefox) : A0 à A3 cachées, B0 à B3 montrées et gelées, le témoin montré et modifiable',
    ['a0', 'a1', 'a2', 'a3'].every(id => zones[id] === 'cachée/true/sans marque') && ['b0', 'b1', 'b2', 'b3'].every(id => zones[id] === 'montrée/false/sans marque') && zones.t0 === 'montrée/true/sans marque', zones);
  await click('t0'); await pause(300);
  await click('montrer'); await pause(1000);
  zones = await frameState();
  check('« Montrer les zones » montre A0 à A3, sans marque restante (Firefox)', ['a0', 'a1', 'a2', 'a3'].every(id => zones[id] === 'montrée/true/sans marque'), zones);
  await click('a0'); await pause(300);
  await click('cacher'); await pause(300);
  zones = await frameState();
  check('« Cacher de nouveau » recache A0 à A3 (Firefox)', ['a0', 'a1', 'a2', 'a3'].every(id => zones[id].startsWith('cachée/true')), zones);
  await click('montrer'); await pause(1000);
  await click('degeler'); await pause(1000);
  zones = await frameState();
  check('« Rendre modifiables » : B0 à B3 passent à contenteditable="true", sans marque restante (Firefox)', ['b0', 'b1', 'b2', 'b3'].every(id => zones[id] === 'montrée/true/sans marque'), zones);
  await pause(2200);
  const report = await page.run(() => document.getElementById('rapport').value);
  say(report.split('\n').slice(0, 2).join(' | '));
  check('chaque relance laisse sa trace au rapport, A0 et B0 aucune (Firefox)',
    /a1 : marque posée à \+0 ms/.test(report) && /a1 : marque retirée à \+\d+ ms/.test(report) && /a2 : marque retirée à \+[01] ms/.test(report) && /a3 : marque retirée à \+4\d\d ms/.test(report)
    && /b1 : marque retirée/.test(report) && /b3 : marque retirée à \+4\d\d ms/.test(report) && !/\b[ab]0 : marque/.test(report));
  check('le cadre est isolé (origine vide) et sans LanguageTool le rapport le dit (Firefox)', /origine du cadre : null/.test(report) && /data-lt-installed : non ; éléments lt-\* : aucun/.test(report));
  const errors = page.logs.filter(entry => entry.level === 'error' && !/favicon\.ico/.test(entry.text));
  check('aucune erreur dans la console de la page', errors.length === 0, errors.map(e => e.text));
  say('--- rapport ---');
  say(report);
} finally {
  await firefox.close();
  await site.close();
}
