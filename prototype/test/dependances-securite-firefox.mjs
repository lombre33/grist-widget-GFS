// La vue « Sécurité » de la fenêtre « Dépendances » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; demande du porteur du 18/11 :
// « une sorte de dashboard de sécurité pour que les utilisateurs sachent vraiment où ils en sont »). La vraie fenêtre, ouverte à la vraie souris par « Réglages » puis « Dépendances… » (test/pages/
// explorateur.js, `window.__security` : le vrai bibliotheques/securite.json, lu par la vraie fenêtre). À mesurer : les deux boutons de vue en tête, « Sécurité » avec le compte des règles non tenues ;
// un clic montre une section par app avec ses neuf règles (état en mot et en icône, motifs en phrases sans trace d'un texte non remplacé, origine du jugement), sans mot coupé ni débordement à 700 × 400 ;
// la recherche et les filtres de la liste s'effacent (ils ne parlent que d'elle) et reviennent avec la liste ; « Ce que ce tableau ne voit pas » s'ouvre et se referme ; sans fichier de contrôle, la vue le
// dit au lieu de disparaître ; avec lui, « Portées par l'app » dit si GFS a retrouvé chaque adresse et le détail donne ce que GFS en sait ; Échap ferme.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createI18n } from '../js/i18n/i18n.js';
import { Run, centerOfSelector, closeLeftOpen } from './corbeille-firefox.mjs';
import { centerOfMenuItem } from './copier-firefox.mjs';
import { ROOT } from './helpers.mjs';

// Ce que la page montre de la fenêtre, de ses deux vues et du tableau de bord.
function state() {
  const t = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const modal = document.querySelector('.mod.dp');
  if (!modal) return { modal: null };
  const box = modal.getBoundingClientRect();
  const body = modal.querySelector('.dp-body');
  const shown = node => Boolean(node) && !node.hidden && node.getBoundingClientRect().height > 0;
  const over = node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); };
  const cut = node => node.scrollWidth > node.clientWidth + 1;
  const sec = modal.querySelector('.dp-sec');
  const rule = li => {
    const chip = li.querySelector(':scope > .dp-chip');
    const source = li.querySelector(':scope > .dp-sec-source');
    return { id: li.dataset.rule, state: li.dataset.state, chip: t(chip), icon: Boolean(chip && chip.querySelector('svg')), source: t(source), title: t(li.querySelector('strong')),
      reasons: [...li.querySelectorAll('.dp-sec-reason')].map(t), says: t(li.querySelector('.dp-says')), height: Math.round(li.getBoundingClientRect().height),
      wide: over(li) || [...li.querySelectorAll('*')].some(over) || li.scrollWidth > li.clientWidth + 1 };
  };
  const apps = sec ? [...sec.querySelectorAll('.dp-sec-app')].map(app => ({ id: app.dataset.app, name: t(app.querySelector('h3')), chips: [...app.querySelectorAll('.dp-group-head .dp-chip')].map(t),
    policy: (app.querySelector('[data-policy]') || { dataset: {} }).dataset.policy || null, line: t(app.querySelector('.dp-sec-line')), rules: [...app.querySelectorAll('.dp-sec-rule')].map(rule),
    wide: over(app) })) : [];
  const limits = modal.querySelector('.dp-sec-more .dp-more-btn');
  const active = document.activeElement;
  const text = sec ? t(sec) : '';
  return { modal: { count: t(modal.querySelector('.mod-count')), headHeight: Math.round(modal.querySelector('.mod-head').getBoundingClientRect().height),
    views: [...modal.querySelectorAll('.dp-tab')].map(button => ({ view: button.dataset.view, text: t(button), pressed: button.getAttribute('aria-pressed'), count: t(button.querySelector('.dp-count')),
      over: over(button), fk: button.dataset.fk })),
    viewsGroup: (() => { const group = modal.querySelector('.dp-views'); return group ? { role: group.getAttribute('role'), label: group.getAttribute('aria-label') } : null; })(),
    barShown: shown(modal.querySelector('.dp-bar')), listShown: shown(modal.querySelector('.dp-list')), colsShown: shown(modal.querySelector('.dp-cols')),
    searchShown: shown(modal.querySelector('.dp-search')), secShown: shown(sec), empty: !modal.querySelector('.dp-empty').hidden,
    intro: sec ? t(sec.querySelector('.dp-sec-intro')) : null, none: sec ? t(sec.querySelector('.dp-sec-none')) : null,
    limits: limits ? { text: t(limits), expanded: limits.getAttribute('aria-expanded'), panel: shown(modal.querySelector('.dp-sec-limits')), items: modal.querySelectorAll('.dp-sec-limits li').length,
      over: over(limits), height: Math.round(limits.getBoundingClientRect().height) } : null,
    apps, leaked: /\{[a-z]+[|}]|\bsec\.[a-z]|\bdep\.[a-z]|undefined|\[object/i.test(text),
    carried: [...modal.querySelectorAll('.dp-carried')].map(block => ({ group: block.closest('.dp-group').dataset.group, note: t(block.querySelector('.dp-carried-note')),
      items: [...block.querySelectorAll('.dp-item')].map(li => ({ key: li.dataset.key, host: t(li.querySelector('.dp-host').firstChild), sub: t(li.querySelector('.dp-host .dp-sub')),
        facts: [...li.querySelectorAll('.dp-detail .dp-fact')].map(fact => ({ title: t(fact.querySelector('dt')), body: t(fact.querySelector('dd')) })),
        clipped: [...li.querySelectorAll('.dp-row *')].filter(cut).length })) })),
    alertsBox: (() => { const box = modal.querySelector('.dp-sec-alertbox'); return box ? { count: box.dataset.alerts, title: t(box.querySelector('h3')), chip: t(box.querySelector('.dp-group-head .dp-chip')), text: t(box) } : null; })(),
    alerts: [...modal.querySelectorAll('.dp-sec-alert')].map(li => ({ app: li.dataset.app, directive: li.dataset.directive, chip: t(li.querySelector('.dp-chip')), icon: Boolean(li.querySelector('.dp-chip svg')),
      name: t(li.querySelector('strong')), text: t(li.querySelector('.dp-sec-reason')), times: t(li.querySelector('.dp-says')), height: Math.round(li.getBoundingClientRect().height),
      wide: over(li) || [...li.querySelectorAll('*')].some(over) || li.scrollWidth > li.clientWidth + 1, links: li.querySelectorAll('a, img').length })),
    relayLines: apps.map(app => ({ id: app.id, s8: (app.rules.find(rule => rule.id === 'S8') || { reasons: [] }).reasons.at(-1) || null })),
    focus: active && active.dataset ? active.dataset.fk || null : null,
    inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1, size: [Math.round(box.width), Math.round(box.height)],
    hscroll: body.scrollWidth > body.clientWidth + 1, scrolls: body.scrollHeight > body.clientHeight + 1,
    outside: [...modal.querySelectorAll('.mod-head *, .mod-foot *')].filter(over).map(node => node.className || node.tagName).slice(0, 5) } };
}

const settingsAt = () => { const button = document.querySelector('button use[href="#i-sliders"]').closest('button'); const box = button.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };
const buttonAt = selector => { const node = document.querySelector(selector); if (!node) return null; node.scrollIntoView({ block: 'center' }); const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };

const STATES = ['tenue', 'a-noter', 'non-tenue', 'non-verifiable'];

export async function securiteProblems(page, language, tag) {
  const found = [];
  const { t } = createI18n(language);
  const run = new Run(page, tag, found, 'fenêtre « Dépendances » : sécurité');
  const snap = () => page.run(state);
  const expect = async (kind, what, test) => {
    let now = await snap();
    for (let i = 0; i < 60 && !test(now); i += 1) { await new Promise(resolve => setTimeout(resolve, 75)); now = await snap(); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify(now).slice(0, 700)})`);
    return now;
  };
  const report = JSON.parse(readFileSync(join(ROOT, 'bibliotheques/securite.json'), 'utf8'));
  const shownApps = ['automation', 'publipostage', 'form'];
  const problems = shownApps.reduce((total, id) => total + Object.values(report.apps[id].regles).filter(rule => rule.etat === 'non-tenue').length, 0);
  const open = async () => {
    await page.click(...await page.run(settingsAt));
    await page.until(() => document.querySelector('.menu') !== null, [], 1500);
    await page.click(...await page.run(centerOfMenuItem, t('dep.menu')));
    return expect('ouverture', 'la fenêtre devait s\'ouvrir', s => s.modal && s.modal.views.length === 2);
  };
  const close = async () => {
    await page.press('Escape');
    await expect('Échap', 'Échap devait fermer la fenêtre', s => s.modal === null);
  };
  try {
    await page.run(() => { window.__resetSettings(); window.__saved = []; window.__dependencyBlocked = null; window.__carried = true; window.__security = true; });
    await run.reset().catch(() => {});

    // 1. À l'ouverture : deux boutons de vue, « Bibliothèques » enfoncé, « Sécurité » avec le compte des règles non tenues ; la liste est là, le tableau de bord caché ; rien ne déborde.
    const start = await open();
    if (!start.modal) return found;
    const [libs, security] = start.modal.views;
    if (libs.view !== 'libs' || security.view !== 'security' || libs.text !== `${t('dep.view.libs')}` || !security.text.startsWith(t('dep.view.security'))) run.note('les vues', `les deux boutons devaient dire « ${t('dep.view.libs')} » et « ${t('dep.view.security')} » (${libs.text} | ${security.text})`);
    if (libs.pressed !== 'true' || security.pressed !== 'false') run.note('la vue choisie', 'la liste des bibliothèques devait être la vue de l\'ouverture');
    if (security.count !== String(problems)) run.note('le compte', `« ${t('dep.view.security')} » devait compter ${problems} règle(s) non tenue(s) (${security.count})`);
    if (!start.modal.viewsGroup || start.modal.viewsGroup.role !== 'group' || start.modal.viewsGroup.label !== t('dep.views')) run.note('le groupe de vues', 'les deux boutons devaient former un groupe nommé');
    if (!start.modal.barShown || !start.modal.listShown || start.modal.secShown) run.note('la vue de l\'ouverture', 'la liste et sa barre devaient se voir, le tableau de bord rester caché');
    if (libs.over || security.over || start.modal.outside.length || !start.modal.inPage || start.modal.hscroll) run.note('déborde', `l'en-tête devait tenir dans la fenêtre (${start.modal.outside.join(', ')})`);

    // 2. « Portées par l'app » avec le contrôle : la note du haut le dit ; chaque ligne dit si GFS a retrouvé son adresse ; le détail donne ce que GFS en sait.
    const pp = start.modal.carried.find(block => block.group === 'publipostage');
    if (!pp || pp.note !== t('dep.c.note.top.checked')) run.note('portées : la note', `la note du bloc devait dire ce que GFS a retrouvé « ${t('dep.c.note.top.checked')} » (${pp && pp.note})`);
    const wantFound = new Set(report.apps.publipostage.adressesTrouvees);
    for (const item of pp ? pp.items : []) {
      const want = wantFound.has(item.host) ? t('dep.c.row.found') : t('dep.c.row.notfound');
      if (item.sub !== want) run.note('portées : l\'adresse retrouvée', `${item.key} devait dire « ${want} » (${item.sub})`);
      if (item.clipped) run.note('texte coupé', `la ligne ${item.key} coupe un mot`);
    }
    await page.click(...await page.run(buttonAt, '[data-fk="dep-publipostage|portee|tiptap"]'));
    const detail = await expect('portées : le détail', 'le détail de TipTap devait donner « Ce que GFS en a retrouvé »', s => s.modal && s.modal.carried.some(block => block.items.some(item => item.key === 'publipostage|portee|tiptap' && item.facts.some(fact => fact.title === t('dep.c.verified.title')))));
    const tipFact = detail.modal && detail.modal.carried.flatMap(block => block.items).find(item => item.key === 'publipostage|portee|tiptap');
    const verified = tipFact && tipFact.facts.find(fact => fact.title === t('dep.c.verified.title'));
    if (verified && /\{|undefined|dep\.c\./.test(verified.body)) run.note('portées : le détail', `le détail laisse un texte non rempli (${verified.body})`);
    await page.click(...await page.run(buttonAt, '[data-fk="dep-publipostage|portee|tiptap"]'));

    // 3. Un clic sur « Sécurité » : la liste, ses colonnes, sa barre et sa recherche s'effacent ; le tableau de bord se montre ; le bouton s'enfonce.
    await page.click(...await page.run(buttonAt, '[data-fk="dep-view-security"]'));
    const dash = await expect('la vue sécurité', 'un clic sur « Sécurité » devait montrer le tableau de bord à la place de la liste',
      s => s.modal && s.modal.secShown && !s.modal.listShown && !s.modal.barShown && !s.modal.colsShown && !s.modal.empty);
    if (!dash.modal || !dash.modal.secShown) return found;
    if (dash.modal.views[1].pressed !== 'true' || dash.modal.views[0].pressed !== 'false') run.note('le bouton de vue', '« Sécurité » devait être le bouton enfoncé');
    if (!dash.modal.intro || !dash.modal.intro.includes(t('sec.source.gfs')) || !dash.modal.intro.includes(t('sec.source.declared'))) run.note('l\'introduction', `l'introduction devait dire la date et la différence entre « ${t('sec.source.gfs')} » et « ${t('sec.source.declared')} » (${dash.modal.intro})`);
    if (dash.modal.apps.map(app => app.id).join() !== shownApps.join()) run.note('les apps', `les apps devaient venir installées d'abord, puis par nom : ${shownApps.join(', ')} (${dash.modal.apps.map(app => app.id).join(', ')})`);
    if (dash.modal.leaked) run.note('un texte non rempli', 'le tableau de bord laisse voir une clé, un « undefined » ou un modèle de phrase non remplacé');
    if (!dash.modal.inPage || dash.modal.hscroll || dash.modal.outside.length) run.note('déborde', 'la fenêtre ne devait ni sortir de la page ni défiler en largeur');

    // 4. Chaque app : ses neuf règles, un état en mot et en icône (jamais la couleur seule), l'origine du jugement, le verdict de sa politique et ses comptes ; rien de coupé ni qui déborde.
    for (const app of dash.modal.apps) {
      const data = report.apps[app.id];
      if (app.rules.map(rule => rule.id).join() !== 'S1,S2,S3,S4,S5,S6,S7,S8,S9') run.note('les règles', `${app.name} devait montrer S1 à S9 (${app.rules.map(rule => rule.id).join(', ')})`);
      if (app.wide) run.note('déborde', `la section de ${app.name} déborde`);
      for (const rule of app.rules) {
        const wantState = data.regles[rule.id].etat;
        if (rule.state !== wantState || rule.chip !== t(`sec.state.${wantState}`) || !rule.icon) run.note('l\'état d\'une règle', `${app.name} ${rule.id} devait dire « ${t(`sec.state.${wantState}`)} » avec une icône (${rule.state} | ${rule.chip} | icône ${rule.icon})`);
        if (!rule.source || !STATES.includes(rule.state)) run.note('l\'origine du jugement', `${app.name} ${rule.id} devait dire d'où vient son état (${rule.source})`);
        if (rule.title !== `${rule.id} · ${t(`sec.rule.${rule.id}`)}`) run.note('le titre d\'une règle', `${app.name} ${rule.id} : « ${rule.title} »`);
        if (rule.state !== 'tenue' && rule.state !== 'non-verifiable' && !rule.reasons.length && !data.regles[rule.id].notes) run.note('un motif manquant', `${app.name} ${rule.id} est ${rule.state} sans dire pourquoi`);
        if (rule.wide) run.note('texte coupé', `${app.name} ${rule.id} : la ligne coupe ou fait déborder un mot`);
        if (rule.height < 30) run.note('hauteur', `${app.name} ${rule.id} mesure ${rule.height} px (30 au moins)`);
      }
      const counts = Object.fromEntries(STATES.map(each => [each, Object.values(data.regles).filter(rule => rule.etat === each).length]));
      const wantLine = t('sec.counts', { ok: counts.tenue, note: counts['a-noter'], bad: counts['non-tenue'], unk: counts['non-verifiable'] });
      if (!app.line || !app.line.includes(wantLine)) run.note('les comptes', `${app.name} devait dire « ${wantLine} » (${app.line})`);
      if (!app.chips.some(chip => chip.includes(t(app.policy ? `sec.state.low.${app.policy}` : 'sec.app.unchecked')))) run.note('le verdict de la politique', `${app.name} devait dire l'état de sa politique (${app.chips.join(' | ')} | ${app.policy})`);
    }
    // Les phrases du contrôle : Publipostage+ n'ouvre pas ses appels sortants à l'écart, ils sont dits ; l'app sans règle contrôlée ne se dit jamais « tenue ».
    const ppApp = dash.modal.apps.find(app => app.id === 'publipostage');
    const s3 = ppApp && ppApp.rules.find(rule => rule.id === 'S3');
    if (s3 && s3.state === 'non-tenue' && !s3.reasons.length) run.note('un motif manquant', 'S3 de Publipostage+ est non tenue sans phrase');
    const unchecked = dash.modal.apps.filter(app => !app.rules.length);
    if (unchecked.some(app => !app.line || !app.line.includes(t('sec.app.unchecked')))) run.note('une app non contrôlée', 'une app sans contrôle devait le dire');

    // 4b. Les alertes relayées par les apps (kit 0.25.0, contrats 5.4 point 14) : sans alerte, la phrase qui dit pourquoi cela ne prouve rien ; avec, une ligne par alerte (nom de l'app, directive, cible en mots,
    // compte et heure), rien de cliquable, le relais actif dit dans la section de l'app, le compte du bouton les ajoute aux règles non tenues.
    const none = dash.modal.alertsBox;
    if (!none || none.count !== '0' || !none.text.includes(t('sec.alerts.none'))) run.note('les alertes : aucune', `sans alerte, la fenêtre devait dire « ${t('sec.alerts.none')} » (${none && none.text})`);
    const relay = (cible, directive = 'connect-src', source = 'app', times = 1) => ({ app: 'publipostage', directive, cible, source, disposition: 'enforce', times, first: '2026-11-18T10:02:00.000Z', last: '2026-11-18T10:02:00.000Z' });
    await page.run(alertsData => { window.__relay = alertsData; }, { relays: { publipostage: { kit: '0.25.0', at: '2026-11-18T10:00:00.000Z' } },
      alerts: [relay('evil.example'), relay('inline', 'script-src-elem', 'esm.sh', 12), relay('autre', 'img-src', 'inconnue')] });
    await page.click(...await page.run(buttonAt, '[data-fk="dep-view-libs"]'));
    await page.click(...await page.run(buttonAt, '[data-fk="dep-view-security"]'));
    const warned = await expect('les alertes', 'trois alertes devaient se montrer', s => s.modal && s.modal.alerts.length === 3);
    if (warned.modal && warned.modal.alerts.length === 3) {
      const [first, second, third] = warned.modal.alerts;
      if (warned.modal.alertsBox.count !== '3' || warned.modal.alertsBox.chip !== t('sec.alerts.count', { n: 3 })) run.note('les alertes : le compte', `l'en-tête devait compter 3 alertes (${warned.modal.alertsBox.chip})`);
      if (first.chip !== t('sec.alert.chip') || !first.icon || first.name !== 'Publipostage+') run.note('une alerte', `une alerte devait dire « ${t('sec.alert.chip')} » avec une icône et le nom de l'app (${first.chip} | ${first.name})`);
      const want = [t('sec.alert.line', { directive: 'connect-src', target: 'evil.example', by: t('sec.alert.by.app') }),
        t('sec.alert.line', { directive: 'script-src-elem', target: t('sec.alert.kw.inline'), by: t('sec.alert.by.host', { host: 'esm.sh' }) }),
        t('sec.alert.line', { directive: 'img-src', target: t('sec.alert.kw.autre'), by: '' })].map(line => line.replace(/\s+/g, ' ').replace(/ ([.,])/g, '$1'));
      [first, second, third].forEach((alert, index) => { if (alert.text !== want[index]) run.note('le texte d\'une alerte', `l'alerte ${index + 1} devait dire « ${want[index]} » (${alert.text})`); });
      if (!second.times.includes(t('sec.alert.times', { n: 12, time: '' }).split(',')[0])) run.note('le compte d\'une alerte', `l'alerte 2 devait dire « 12 fois » (${second.times})`);
      for (const alert of warned.modal.alerts) {
        if (alert.links) run.note('les alertes : liens', 'une alerte ne devait offrir ni lien ni image (du texte seulement)');
        if (alert.wide || alert.height < 30) run.note('texte coupé', `une alerte coupe ou déborde (${alert.height} px)`);
      }
      if (/\{|undefined|sec\./.test(warned.modal.alertsBox.text)) run.note('un texte non rempli', 'les alertes laissent voir une clé ou un modèle de phrase');
      const s8 = warned.modal.relayLines.find(line => line.id === 'publipostage');
      if (!s8 || !s8.s8 || !s8.s8.startsWith(t('sec.relay.on', { kit: '0.25.0', time: '' }).split('(')[0])) run.note('le relais actif', `Publipostage+ devait dire que son relais est actif (${s8 && s8.s8})`);
      const form = warned.modal.relayLines.find(line => line.id === 'form');
      if (!form || form.s8 !== t('sec.relay.off')) run.note('le relais absent', `Form+ devait dire qu'aucun relais n'a été reçu (${form && form.s8})`);
      if (warned.modal.views[1].count !== String(problems + 3)) run.note('le compte du bouton', `le bouton devait compter les règles non tenues et les alertes (${problems + 3}) : ${warned.modal.views[1].count}`);
    }
    await page.run(() => { window.__relay = null; });

    // 5. « Ce que ce tableau ne voit pas » : un bouton de 44 px qui ouvre, puis referme, quatre limites en clair.
    if (!dash.modal.limits || dash.modal.limits.text !== t('sec.limits') || dash.modal.limits.expanded !== 'false' || dash.modal.limits.panel) run.note('les limites', `le bouton « ${t('sec.limits')} » devait être là, refermé`);
    if (dash.modal.limits && (dash.modal.limits.height < 40 || dash.modal.limits.over)) run.note('les limites : le bouton', `le bouton mesure ${dash.modal.limits.height} px (40 au moins) ou déborde`);
    await page.click(...await page.run(buttonAt, '[data-fk="dep-sec-limits"]'));
    const limits = await expect('les limites : ouvrir', 'un clic devait ouvrir les quatre limites', s => s.modal && s.modal.limits && s.modal.limits.expanded === 'true' && s.modal.limits.panel && s.modal.limits.items === 4);
    if (limits.modal && limits.modal.hscroll) run.note('déborde', 'les limites ouvertes font défiler en largeur');
    await page.click(...await page.run(buttonAt, '[data-fk="dep-sec-limits"]'));
    await expect('les limites : refermer', 'un second clic devait les refermer', s => s.modal && s.modal.limits && s.modal.limits.expanded === 'false' && !s.modal.limits.panel);

    // 6. De retour sur « Bibliothèques » : la liste, sa barre et ses colonnes reviennent, le tableau de bord se cache.
    await page.click(...await page.run(buttonAt, '[data-fk="dep-view-libs"]'));
    await expect('retour à la liste', 'un clic sur « Bibliothèques » devait rendre la liste et sa barre', s => s.modal && s.modal.listShown && s.modal.barShown && s.modal.colsShown && !s.modal.secShown && s.modal.views[0].pressed === 'true');
    await close();

    // 7. Sans fichier de contrôle : la vue dit pourquoi au lieu de disparaître, le bouton n'a pas de compte (« — »), et la liste garde ses textes d'avant.
    await page.run(() => { window.__security = false; });
    const bare = await open();
    if (bare.modal) {
      if (bare.modal.views[1].count !== '—') run.note('sans fichier : le compte', `sans contrôle, « ${t('dep.view.security')} » devait afficher « — » (${bare.modal.views[1].count})`);
      const nowCarried = bare.modal.carried.find(block => block.group === 'publipostage');
      if (nowCarried && nowCarried.note !== t('dep.c.note.top')) run.note('sans fichier : les portées', `sans contrôle, la note devait rester « ${t('dep.c.note.top')} » (${nowCarried.note})`);
      await page.click(...await page.run(buttonAt, '[data-fk="dep-view-security"]'));
      await expect('sans fichier', `sans contrôle, la vue devait dire « ${t('sec.none')} »`, s => s.modal && s.modal.secShown && s.modal.none === t('sec.none'));
      await close();
    }
  } catch (error) {
    run.note('la mesure a échoué', error.message.slice(0, 300));
    await closeLeftOpen(page);
  } finally {
    await page.run(() => { window.__carried = false; window.__security = false; window.__relay = null; }).catch(() => {});
  }
  return found;
}
