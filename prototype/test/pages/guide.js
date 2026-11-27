// La page d'essai du guide des démarches (module Guide, 27/11) : le vrai contrôle (js/guide/guide-control.js), la vraie fenêtre, la vraie lecture et les vraies feuilles de style
// de index.html, sur un faux Grist en mémoire (test/fake-grist.mjs) qui tient le document fictif de test/guide-fixtures.mjs. `?lang=fr|en` ; `?none=1` : aucun guide encore.
// `window.__guide` est le contrôle, `window.__guideNotices` garde les messages du pied, `window.__guideBatches()` les actions reçues par le faux Grist.
import { createI18n } from '/js/i18n/i18n.js';
import { installSprite } from '/js/ui/icons.js';
import { fakeGrist } from '/test/fake-grist.mjs';
import { GuideStore } from '/js/guide/guide-store.js';
import { AnnuaireStore } from '/js/annuaire/annuaire-store.js';
import { GuideControl } from '/js/guide/guide-control.js';
import { ThemeSetting } from '/js/theme/theme.js';
import { ThemeHost } from '/js/theme/theme-apply.js';
import { guideDocument, guideConfig, configFixture, PROCEDURES_TABLE } from '/test/guide-fixtures.mjs';

// Le document fictif en tables du faux Grist.
const tablesOf = document => Object.fromEntries(Object.entries(document).map(([name, data]) => {
  const names = Object.keys(data).filter(key => key !== 'id');
  return [name, { columns: ['id', ...names], rows: data.id.map((id, at) => Object.fromEntries([['id', id], ...names.map(key => [key, data[key][at]])])) }];
}));

const memory = () => { const store = { value: null, read: () => store.value, write: value => { store.value = value; return true; } }; return store; };

async function mount() {
  const query = new URLSearchParams(location.search);
  const language = query.get('lang') === 'en' ? 'en' : 'fr';
  let i18n = createI18n(language);
  let lang = language;
  installSprite(document);
  const grist = fakeGrist(tablesOf(guideDocument()));
  const consent = async () => true;
  const directories = new AnnuaireStore({ port: grist.port, consent });
  await directories.create({ name: 'Annuaire principal', table: 'Personnes', config: configFixture() });
  if (query.get('none') !== '1') await new GuideStore({ port: grist.port, consent }).create({ name: 'Démarches du personnel', table: PROCEDURES_TABLE, config: guideConfig() });
  window.__guideNotices = [];
  window.__guideAsks = [];
  const control = new GuideControl({ port: grist.port, container: document.getElementById('stage'), t: (key, vars) => i18n.t(key, vars), locale: () => (lang === 'en' ? 'en-GB' : 'fr-FR'),
    inertTargets: () => [], ask: async options => { window.__guideAsks.push(options.title); return true; }, notice: text => window.__guideNotices.push(text), writeBlock: () => null,
    fullAccess: () => true, identity: () => query.get('me') || '' });
  window.__guide = control;
  const theme = new ThemeSetting({ ambianceStore: memory(), colorStore: memory(), accessStore: memory() });
  window.__theme = theme;
  window.__ambiance = id => theme.choose(id);
  new ThemeHost({ win: window, setting: theme }).start();
  window.__guideBatches = () => JSON.parse(JSON.stringify(grist.batches));
  window.__guideLanguage = next => { lang = next; i18n = createI18n(next); control.relocalize(); };
}

window.__ready = mount().then(() => true);
