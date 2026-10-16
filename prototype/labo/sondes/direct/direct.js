// Sonde du direct : comment un widget apprend-il qu'une AUTRE table que la sienne a changé ?
// Un document de test a deux tables : « Live » (le canal) et « Autre » (celle d'un widget qui n'est pas lié à Live).
// Trois widgets de cette page, chacun avec son rôle (paramètre `role` de l'adresse) :
//   ecrit   lié à Live, accès complet : écrit une ligne `{ Seq, T0, Data }` (T0 = l'heure de la frappe) ;
//   pousse  lié à Live, accès complet (comme GFS ; « Read table » n'autorise pas includeColumns: 'normal', et les colonnes ajoutées par AddColumn sont masquées dans la section) :
//           Grist le prévient (grist.onRecords) ; il note l'arrivée et la passe aux autres cadres (BroadcastChannel) ;
//   relit   lié à Autre, accès complet : relit Live (docApi.fetchTable) à intervalle fixe, et reçoit ce que `pousse` lui passe.
// Tous les cadres sont dans la même page : une seule horloge (Date.now), le délai d'une ligne est donc exact.
// `net` (millisecondes, par sens) simule un réseau : il retarde l'écriture, la prévenance et chacune des deux étapes d'une relecture.
(() => {
  const params = new URLSearchParams(location.search);
  const role = params.get('role') || 'relit';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const state = { role, ready: false, net: 0, pollMs: 0, polling: false, arrivals: { pousse: [], relais: [], relit: [] }, write: [], poll: { calls: 0, ms: [], bytes: [] } };
  window.sonde = state;
  const label = document.getElementById('etat');
  const say = text => { if (label) label.textContent = `${role} : ${text}`; };
  const median = values => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const bus = typeof BroadcastChannel === 'function' ? new BroadcastChannel('gfs-sonde-direct') : null;

  const record = (bucket, seq, t0) => state.arrivals[bucket].push({ seq, delay: Date.now() - t0 });

  // Les lignes d'une table rendue en colonnes (docApi.fetchTable) ou en lignes (onRecords) : { Seq, T0 }.
  const fromColumns = table => table.id.map((id, i) => ({ id, Seq: table.Seq && table.Seq[i], T0: table.T0 && table.T0[i] }));

  // `prime` : la première lecture ne fait que retenir les lignes déjà là (elles ne sont pas des arrivées).
  function noteNew(bucket, rows, seen, prime = false) {
    for (const row of rows) {
      if (typeof row.Seq === 'number' && row.Seq > 0 && !seen.has(row.Seq)) { seen.add(row.Seq); if (!prime) record(bucket, row.Seq, row.T0); }
    }
  }

  async function ensureColumns(tableId) {
    const columns = await grist.docApi.fetchTable(tableId);
    const missing = [['Seq', 'Int'], ['T0', 'Numeric'], ['Data', 'Text']].filter(([id]) => !(id in columns));
    if (missing.length) await grist.docApi.applyUserActions(missing.map(([id, type]) => ['AddColumn', tableId, id, { type, isFormula: false }]));
  }

  if (role === 'ecrit') {
    let seq = 0;
    state.table = null;
    state.fill = async (count, size = 200) => {
      const table = state.table;
      const data = 'x'.repeat(size);
      await grist.docApi.applyUserActions([['BulkAddRecord', table, Array(count).fill(null), { Seq: Array(count).fill(-1), T0: Array(count).fill(0), Data: Array(count).fill(data) }]]);
    };
    state.clear = async () => {
      const columns = await grist.docApi.fetchTable(state.table);
      if (columns.id.length) await grist.docApi.applyUserActions([['BulkRemoveRecord', state.table, columns.id]]);
    };
    state.writeSeries = async ({ count = 40, min = 350, max = 650, size = 200 } = {}) => {
      const data = 'x'.repeat(size);
      for (let i = 0; i < count; i++) {
        const t0 = Date.now();
        seq += 1;
        if (state.net) await sleep(state.net);
        const started = performance.now();
        await grist.docApi.applyUserActions([['AddRecord', state.table, null, { Seq: seq, T0: t0, Data: data }]]);
        state.write.push(performance.now() - started + state.net);
        await sleep(min + Math.random() * (max - min));
      }
      return seq;
    };
    grist.ready({ requiredAccess: 'full' });
    grist.getSelectedTableId().then(async table => { state.table = table; await ensureColumns(table); state.ready = true; say('prêt'); });
  } else if (role === 'pousse') {
    const seen = new Set();
    let primed = false;
    state.reset = () => { state.arrivals.pousse = []; };
    grist.onRecords(async rows => {
      if (state.net && primed) await sleep(state.net);
      const fresh = rows.filter(r => typeof r.Seq === 'number' && r.Seq > 0 && !seen.has(r.Seq));
      noteNew('pousse', rows, seen, !primed);
      if (primed && bus && fresh.length) bus.postMessage(fresh.map(r => ({ Seq: r.Seq, T0: r.T0 })));
      primed = true;
    }, { includeColumns: 'normal' });
    grist.ready({ requiredAccess: 'full' });
    state.ready = true; say('prêt');
  } else {
    const seenPoll = new Set();
    const seenRelay = new Set();
    state.reset = () => { state.arrivals.relais = []; state.arrivals.relit = []; state.poll = { calls: 0, ms: [], bytes: [] }; };
    if (bus) bus.onmessage = event => noteNew('relais', event.data, seenRelay);
    state.startPolling = async pollMs => {
      state.pollMs = pollMs;
      if (state.polling) return;
      state.polling = true;
      (async () => {
        noteNew('relit', fromColumns(await grist.docApi.fetchTable('Live')), seenPoll, true);
        while (state.pollMs > 0) {
          const started = performance.now();
          if (state.net) await sleep(state.net);
          const call = performance.now();
          const table = await grist.docApi.fetchTable('Live');
          state.poll.ms.push(performance.now() - call);
          state.poll.bytes.push(JSON.stringify(table).length);
          state.poll.calls += 1;
          if (state.net) await sleep(state.net);
          noteNew('relit', fromColumns(table), seenPoll);
          await sleep(Math.max(0, state.pollMs - (performance.now() - started)));
        }
        state.polling = false;
      })();
    };
    state.stopPolling = () => { state.pollMs = 0; };
    state.summary = () => ({ calls: state.poll.calls, fetchMedianMs: median(state.poll.ms), bytesMedian: median(state.poll.bytes) });
    grist.ready({ requiredAccess: 'full' });
    state.ready = true; say('prêt');
  }
})();
