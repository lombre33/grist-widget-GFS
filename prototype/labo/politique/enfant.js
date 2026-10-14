// L'enfant d'un essai de politique (run-politique.mjs) : une page qui dit à son parent si son script et son script en ligne se sont exécutés, et si elle
// atteint une adresse de la même machine, puis celle d'un autre site (la même machine sous un autre nom : un autre site pour le navigateur).
const base = new URL(document.currentScript.src);
const seen = { script: true, inline: window.__inline === true };

async function attempt(url) {
  try { return (await fetch(url)).ok ? 'ok' : 'refus'; } catch (error) { return error.name; }
}

async function run() {
  seen.proche = await attempt(`${base.origin}/ping.txt`);
  base.hostname = 'localhost';
  seen.autre = await attempt(`${base.origin}/ping.txt`);
  parent.postMessage({ enfant: seen }, '*');
}

run();
