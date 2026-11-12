// La page d'essai de la marque `data-lt-active` (labo/essais-navigateur/marque.html) dans un vrai Firefox sans écran, à la vraie souris (test/firefox.mjs) : les boutons « Poser la marque » et « Retirer la marque »
// posent et retirent la marque en zone 3 sans lui prendre le focus (le mousedown refusé du bouton), dans le cadre isolé comme celui d'une app dans GFS (G) comme dans le cadre simple (H), et le rapport le dit.
// Sans Firefox (`labo/installer-firefox.sh`, deux minutes) l'essai est sauté. Il n'y a pas d'extension ici : la réponse qui compte, « LanguageTool obéit-il à la marque ? », est celle de la personne.
import { join } from 'node:path';
import { findFirefox, serveSite, startFirefox } from '../test/firefox.mjs';
import { say, check, LAB } from './lab-common.mjs';

const binary = findFirefox();
if (!binary) { say('Firefox absent (bash labo/installer-firefox.sh) : essai sauté'); process.exit(0); }
const site = await serveSite(join(LAB, 'essais-navigateur'));
const firefox = await startFirefox(binary);
const { page } = firefox;
try {
  await page.goto(`${site.url}/marque.html`);
  await page.view({ width: 1300, height: 1400 });
  await page.until(() => (document.getElementById('rapport').value.match(/origine du cadre/g) || []).length === 2, [], 15000);
  // Les cadres ont la même mise en page : la géométrie de la zone 3 et de ses boutons se lit dans H (même origine), puis se pose sur chacun des deux cadres.
  const geo = await page.run(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
    const frames = [...document.querySelectorAll('iframe')];
    const doc = frames[1].contentDocument;
    const at = id => rect(doc.getElementById(id));
    return { frames: frames.map(rect), inner: { e1: at('e1'), e3: at('e3'), poser: at('poser'), retirer: at('retirer') }, hauteur: doc.documentElement.scrollHeight, vue: frames[1].clientHeight };
  });
  check('les quatre zones et les boutons tiennent dans le cadre sans défiler', geo.hauteur <= geo.vue, [geo.hauteur, geo.vue]);
  const click = (frame, key) => {
    const [fx, fy] = geo.frames[frame];
    const [x, y, w, h] = geo.inner[key];
    return page.click(fx + 1 + x + w / 2, fy + 1 + y + h / 2);
  };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  for (const frame of [0, 1]) {
    await click(frame, 'e3'); await pause(200);
    await click(frame, 'poser'); await pause(300);
    await click(frame, 'e1'); await pause(200);
    await click(frame, 'e3'); await pause(200);
    await click(frame, 'retirer'); await pause(300);
  }
  await pause(2200);
  const report = await page.run(() => document.getElementById('rapport').value);
  const part = id => report.split(/\nCadre /).find(text => text.startsWith(`${id} ·`)) || '';
  say(report.split('\n').slice(0, 2).join(' | '));
  for (const id of ['G', 'H']) {
    const text = part(id);
    check(`${id} : « Poser la marque » pose la marque en zone 3 et la zone garde le focus (Firefox)`, /après « Poser la marque », 1,5 s plus tard : [^\n]*marque vue au clic : e1 absente \/ e2 false \/ e3 false \/ e4 false ; focus encore dans la zone 3 : oui/.test(text), text.split('\n').filter(l => l.includes('Poser')));
    check(`${id} : « Retirer la marque » la retire et la zone garde le focus (Firefox)`, /après « Retirer la marque », 1,5 s plus tard : [^\n]*marque vue au clic : e1 absente \/ e2 false \/ e3 absente \/ e4 false ; focus encore dans la zone 3 : oui/.test(text), text.split('\n').filter(l => l.includes('Retirer')));
  }
  check('G est isolé (origine vide), H a l\'origine du site, dans Firefox', /Cadre G[^]*origine du cadre : null/.test(report) && new RegExp(`Cadre H[^]*origine du cadre : ${site.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(report));
  check('sans LanguageTool, le rapport ne trouve rien et le dit (Firefox)', ['G', 'H'].every(id => /data-lt-installed : non ; éléments lt-\* : aucun/.test(part(id))));
  // Firefox demande /favicon.ico à chaque page : la règle `default-src 'none'` de la page le refuse, ce qui n'est pas une erreur de la page.
  const errors = page.logs.filter(entry => entry.level === 'error' && !/favicon\.ico/.test(entry.text));
  check('aucune erreur dans la console de la page', errors.length === 0, errors.map(e => e.text));
  say('--- rapport ---');
  say(report);
} finally {
  await firefox.close();
  await site.close();
}
