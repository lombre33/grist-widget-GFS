// Sonde N du labo (contrats 5.2, point 10) : une app écrite avec le VRAI kit commun (0.6.0), comme le seront Publipostage+, Form+, Automation+, Grist-BI et Thusday avec leur consigne « ambiance ». Elle démarre
// `Ambiance.start()` et ne fait rien d'autre : le kit lit l'ambiance de GFS et la pose sur sa page par le CSSOM. Ce que la sonde en a vu se lit dans `document.body.dataset.sonde`, que le labo lit : ce que
// l'abonné de `GfsLink.onAmbiance` a reçu (jeton par jeton, de quoi comparer à ce que la page porte), l'état de la page quand `ready` s'est réglé, et chaque refus de la politique de sécurité du contenu.
import { GfsLink } from '/kit/js/gfs-link.js';
import { Ambiance } from '/kit/js/ambiance.js';

const seen = { hosted: GfsLink.hosted, pret: false, auDepart: null, abonne: [], violations: [] };
const publish = () => { document.body.dataset.sonde = JSON.stringify(seen); };
const root = document.documentElement;
// Ce que la page porte : les propriétés `--*` posées en ligne (le CSSOM), dont la propriété à elle de l'app, que l'ambiance ne doit jamais toucher.
const inline = () => [...root.style].filter(name => name.startsWith('--')).length;
const look = () => ({ inline: inline(), accent: getComputedStyle(root).getPropertyValue('--accent').trim(), propre: root.style.getPropertyValue('--sonde-propre') });

document.addEventListener('securitypolicyviolation', event => { seen.violations.push(event.violatedDirective); publish(); });
root.style.setProperty('--sonde-propre', 'garde');
// De quoi comparer ce que la page porte à ce que l'app a lu : quatre jetons de chaque mode, le nombre de jetons de chaque liste, l'arrondi de la forme.
const sample = tokens => Object.fromEntries(['--accent', '--accent-solid', '--surface', '--text'].map(name => [name, tokens[name]]));
GfsLink.onAmbiance(message => {
  seen.abonne.push(message && {
    id: message.id, couleur: message.couleur, ajustee: message.ajustee, tokens: { clair: sample(message.clair), sombre: sample(message.sombre) },
    n: { clair: Object.keys(message.clair).length, sombre: Object.keys(message.sombre).length, forme: Object.keys(message.forme).length }, radius: message.forme['--radius-md'] || null,
  });
  publish();
});
const ambiance = Ambiance.start();
ambiance.ready.then(() => { seen.pret = true; seen.auDepart = look(); publish(); });
publish();
// Ce que fait le script d'API de Grist au démarrage d'une app : `ready`, puis le thème (GFS montre alors le cadre et retire sa phrase « se charge… »).
window.parent.postMessage({ mtype: 5 }, '*');
window.parent.postMessage({ mtype: 4, data: { message: 'themeInitialized' } }, '*');
