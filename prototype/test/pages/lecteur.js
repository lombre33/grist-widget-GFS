// La page d'essai du lecteur de vidéos sous Firefox (test/lecteur-firefox.mjs) : le vrai `Player` (js/broker/player.js), posé dans `.frames` comme le fait GFS, par-dessus un cadre d'app (une page d'essai, dans un bac à sable
// comme celui d'une vraie app) ; l'app est une doublure (`session`), qui ne fait que porter le cadre et les sites que son manifeste a déclarés. Les feuilles de style et la politique de sécurité sont celles de index.html
// (le test les recopie de la page). `window.__lecteur.call(nom, args)` envoie à GFS l'un des quatre appels de l'app et rend le code de refus (ou null) ; `window.__lecteur.warnings` garde les avertissements de GFS ;
// `window.__violations` garde les refus de la politique de sécurité ; `window.__lecteur.shown(false)` cache l'app derrière l'explorateur ; `window.__lecteur.leave()` ferme l'app.
import { Player } from '/js/broker/player.js';

const frames = document.getElementById('frames');
const appFrame = frames.querySelector('iframe');
const session = { id: 'publipostage', frameElement: appFrame, policy: { lecteurs: ['youtube', 'vimeo'] }, shown: true };
const warnings = [];
const player = new Player({ container: frames, warn: text => warnings.push(text) });
const calls = player.handlers(session);

window.__violations = [];
document.addEventListener('securitypolicyviolation', event => window.__violations.push({ directive: event.violatedDirective, blocked: event.blockedURI }));

window.__lecteur = {
  warnings,
  call(name, args) {
    try { calls[name](args); return null; } catch (error) { return error.code || String(error); }
  },
  current: () => player.current,
  shown(value) { session.shown = value; },
  leave: () => player.closeFor(session),
};
// La page est prête quand elle et le cadre de l'app sont chargés.
window.__ready = new Promise(resolve => {
  if (document.readyState === 'complete') resolve(true);
  else window.addEventListener('load', () => resolve(true), { once: true });
});
