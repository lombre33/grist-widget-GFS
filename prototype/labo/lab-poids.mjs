// Ce que les essais du poids se partagent (labo/run-poids.mjs, labo/run-poids-fenetre.mjs) : des octets sans répétition, l'envoi d'une pièce jointe comme un navigateur le fait, une action appliquée par l'API REST et une lecture SQL
// du document, toutes par la session de la page de Grist (`run.page`, `run.docId`).

export const sql = (run, query) => run.page.evaluate(async ([docId, q]) => (await (await fetch(`/api/docs/${docId}/sql?q=${encodeURIComponent(q)}`)).json()).records.map(record => record.fields), [run.docId, query]);

// Des octets sans répétition (deux contenus de graines différentes ne partagent aucune empreinte), de la taille demandée.
export const noise = (size, seed) => {
  const buffer = Buffer.alloc(size);
  let x = seed >>> 0;
  for (let i = 0; i < size; i++) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; buffer[i] = (x >>> 16) & 255; }
  return buffer;
};

// Les pièces d'un envoi, comme un navigateur les envoie à Grist (POST multipart) : rend leurs numéros, dans l'ordre.
export const upload = (run, files) => run.page.evaluate(async ([docId, list]) => {
  const form = new FormData();
  for (const { name, type, base64 } of list) form.append('upload', new Blob([Uint8Array.from(atob(base64), character => character.charCodeAt(0))], { type }), name);
  const response = await fetch(`/api/docs/${docId}/attachments`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: form });
  return response.json();
}, [run.docId, files.map(({ name, type, buffer }) => ({ name, type, base64: buffer.toString('base64') }))]);

export const apply = (run, actions) => run.page.evaluate(async ([docId, list]) => (await fetch(`/api/docs/${docId}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(list) })).json(), [run.docId, actions]);
