// Sonde du lot « droits » (permissions, étape 6) : ce qu'un widget plein accès VOIT des règles et de son propre rôle, pour chaque compte, dans un VRAI Grist (labo/run-droits-reel.mjs).
// Elle ne modifie rien. Le jeton n'est jamais écrit dans le rapport : seuls des états, des nombres et des noms sortent d'ici.
(function () {
  'use strict';
  const out = {};
  const note = (label, value) => { out[label] = value; document.getElementById('rapport').textContent = JSON.stringify(out, null, 1); };
  const brief = error => String((error && error.message) || error).slice(0, 100);
  async function table(name) {
    try {
      const data = await grist.docApi.fetchTable(name);
      const ids = data.id || [];
      note(`fetchTable ${name}`, { lignes: ids.length, permissionsText: data.permissionsText, memo: data.memo, tableId: data.tableId, linkId: data.linkId });
    } catch (error) { note(`fetchTable ${name}`, { erreur: brief(error) }); }
  }
  async function rest(label, url) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      let data; try { data = JSON.parse(text); } catch (error) { data = undefined; }
      note(label, { statut: response.status, ...(data && data.access !== undefined ? { access: data.access } : {}), ...(data && data.users ? { utilisateurs: data.users.map(user => `${user.email}:${user.access}`) } : {}), ...(!data ? { texte: text.slice(0, 80) } : {}), ...(data && !data.access && !data.users && !data.error ? { cles: Object.keys(data).slice(0, 5) } : {}), ...(data && data.error ? { erreur: data.error } : {}) });
    } catch (error) { note(label, { erreur: brief(error) }); }
  }
  async function run() {
    for (const name of ['_grist_ACLRules', '_grist_ACLResources', '_grist_Shares']) await table(name);
    for (const readOnly of [true, false]) {
      let token;
      try { token = await grist.docApi.getAccessToken({ readOnly }); } catch (error) { note(`jeton readOnly=${readOnly}`, { erreur: brief(error) }); continue; }
      const base = token.baseUrl; const auth = `auth=${encodeURIComponent(token.token)}`;
      note(`jeton readOnly=${readOnly}`, { ttl: token.ttlMsecs, baseUrl: base.replace(/\/docs\/[A-Za-z0-9]+/, '/docs/<id>') });
      for (const path of ['', '/access', '/sql?q=' + encodeURIComponent('select 1 as a'), '/webhooks', '/usersForViewAs', '/states', '/tables', '/download/schema', '/timing']) await rest(`GET ${path.split('?')[0] || 'document'} (readOnly=${readOnly})`, `${base}${path}${path.includes('?') ? '&' : '?'}${auth}`);
    }
    note('fin', true);
  }
  grist.ready({ requiredAccess: 'full' });
  window.addEventListener('load', () => setTimeout(run, 2000));
}());
