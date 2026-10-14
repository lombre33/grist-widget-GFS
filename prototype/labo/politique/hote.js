// L'hôte d'un essai de politique (run-politique.mjs) : il fabrique, un cas à la fois, un sous-cadre isolé comme celui de GFS (mêmes drapeaux `sandbox`),
// de cinq façons, et rend ce que l'enfant a répondu. La page de l'hôte porte la politique de GFS (index.html du prototype).
const params = new URLSearchParams(location.search);
const BASE = params.get('base');
const SANDBOX = params.get('sandbox');
const POLICY = `connect-src ${new URL(BASE).origin}`;
const WAIT = 3500;

async function childHtml() {
  const text = await (await fetch(`${BASE}enfant.html`)).text();
  return text.replace('src="enfant.js"', `src="${BASE}enfant.js"`);
}

const CASES = {
  simple: async () => ({ src: `${BASE}enfant.html` }),
  attributSansAccord: async () => ({ src: `${BASE}enfant.html`, csp: POLICY }),
  attributAvecAccord: async () => ({ src: `${BASE}enfant.html?accord`, csp: POLICY }),
  srcdoc: async () => ({ srcdoc: await childHtml() }),
  blob: async () => ({ src: URL.createObjectURL(new Blob([await childHtml()], { type: 'text/html' })) }),
};

window.runCase = async name => {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', SANDBOX);
  const answer = new Promise(resolve => {
    window.addEventListener('message', event => { if (event.source === frame.contentWindow && event.data && event.data.enfant) resolve(event.data.enfant); });
    setTimeout(() => resolve(null), WAIT);
  });
  const attributes = await CASES[name]();
  for (const [key, value] of Object.entries(attributes)) frame.setAttribute(key, value);
  document.body.append(frame);
  const seen = await answer;
  frame.remove();
  return seen;
};
