// Plusieurs personnes à la fois sur UN vrai serveur Grist, sans navigateur : `GRIST_MULTI=1 bash vrai-serveur.sh` ouvre la page de connexion d'essai de Grist
// (`/test/login`), et chaque personne garde son pot de cookies. Les essais qui attaquent la donnée brute par l'API REST avec le compte de chacun n'ont plus à
// relancer le serveur entre deux comptes (run-annuaire-verrou.mjs). Le verrou est celui de Grist : on le prouve par l'attaque, jamais par l'écran.

export const GRIST = process.env.GRIST_URL || 'http://127.0.0.1:8484';

// Une session ouverte pour `email` : { email, call(méthode, chemin, corps) -> { status, json, text } }.
export async function login(email) {
  const jar = new Map();
  const keep = response => { for (const line of response.headers.getSetCookie()) { const [pair] = line.split(';'); const at = pair.indexOf('='); jar.set(pair.slice(0, at), pair.slice(at + 1)); } };
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
  keep(await fetch(`${GRIST}/test/login?username=${encodeURIComponent(email)}&name=${encodeURIComponent(email.split('@')[0])}&password=x&next=&signInSubmitButton=login`, { redirect: 'manual' }));
  const call = async (method, path, body) => {
    const response = await fetch(`${GRIST}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie() }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    keep(response);
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch (error) { /* texte */ }
    return { status: response.status, json, text: text.slice(0, 600) };
  };
  return { email, call };
}

// Un document neuf du propriétaire (`owner`, une session) ; rend son identifiant.
export async function newDocument(owner, name) {
  const orgs = (await owner.call('GET', '/api/orgs')).json;
  const org = orgs[0].id;
  let spaces = (await owner.call('GET', `/api/orgs/${org}/workspaces`)).json;
  if (!spaces.length) spaces = [{ id: (await owner.call('POST', `/api/orgs/${org}/workspaces`, { name: 'Essais' })).json }];
  return (await owner.call('POST', `/api/workspaces/${spaces[0].id}/docs`, { name })).json;
}

// Partage le document : { adresse: 'editors' | 'viewers' | 'owners' }.
export const share = (owner, docId, users) => owner.call('PATCH', `/api/docs/${docId}/access`, { delta: { users } });

// Des actions utilisateur en un lot (comme `applyUserActions` du widget) ; rend la réponse (200, ou le refus de Grist).
export const applyAs = (person, docId, actions) => person.call('POST', `/api/docs/${docId}/apply`, actions);

// Les lignes d'une table, `[{ id, …colonnes }]` ; null quand Grist refuse la lecture.
export async function rowsOf(person, docId, table) {
  const answer = await person.call('GET', `/api/docs/${docId}/tables/${table}/records`);
  return answer.status === 200 ? answer.json.records.map(row => ({ id: row.id, ...row.fields })) : null;
}

// Les lignes en colonnes, comme les rend `fetchTable` du widget : { id: [...], colonne: [...] }.
export function columnar(rows) {
  const out = { id: rows.map(row => row.id) };
  for (const key of new Set(rows.flatMap(row => Object.keys(row)))) if (key !== 'id') out[key] = rows.map(row => row[key]);
  return out;
}
