// Le script de l'API des widgets que le labo sert en `LAB_API_EVAL=1` (labo/api-evaluee.mjs). Le fichier de docs.getgrist.com s'évalue par eval() ; celui que le labo servait n'évaluait rien, et Form+, dont la
// politique de page refusait l'évaluation, y démarrait quand même (vu par le porteur le 04/11 ; faits vérifiés 27). Ici, un contexte `vm` qui refuse l'évaluation de texte joue la politique sans `'unsafe-eval'`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { evalWrapped, servedPluginApi } from '../labo/api-evaluee.mjs';

// Un fichier réduit à ce qui compte : il déclare `grist` en tête, comme le vrai, et le remplit.
const API = 'var grist;\n(() => { grist = { ready: () => \'prête\' }; })();\n';
const refusingEval = () => vm.createContext({}, { codeGeneration: { strings: false, wasm: false } }); // la page sans `'unsafe-eval'`
const allowingEval = () => vm.createContext({});                                                       // la page qui l'a

test('enveloppé, le fichier rend le même `grist` à une page qui permet l\'évaluation', () => {
  const page = allowingEval();
  vm.runInContext(evalWrapped(API), page);
  assert.equal(vm.runInContext('grist.ready()', page), 'prête');
});

test('enveloppé, il échoue dans une page qui la refuse, comme chez le porteur : EvalError, puis `grist` vide (« is undefined »), jamais « is not defined »', () => {
  const page = refusingEval();
  assert.throws(() => vm.runInContext(evalWrapped(API), page), error => error.name === 'EvalError' || /Code generation from strings disallowed/.test(error.message));
  assert.equal(vm.runInContext('grist', page), undefined, '`grist` est déclaré, et vide');
  assert.throws(() => vm.runInContext('grist.ready()', page), error => error.name === 'TypeError' && /reading 'ready'/.test(error.message)); // (le TypeError d'un contexte `vm` n'est pas celui de Node : on lit son nom)
});

test('tel quel, le fichier du labo démarre dans la même page sans évaluation : ce que le labo servait, et qui cachait la panne', () => {
  const page = refusingEval();
  vm.runInContext(API, page);
  assert.equal(vm.runInContext('grist.ready()', page), 'prête');
});

test('le texte du fichier passe tel quel dans l\'enveloppe, guillemets, retours à la ligne et U+2028 compris', () => {
  const text = 'var grist;\ngrist = { texte: "a\\"b\'c`d${e} f g" };';
  const page = allowingEval();
  vm.runInContext(evalWrapped(text), page);
  assert.equal(vm.runInContext('grist.texte', page), 'a"b\'c`d${e} f g');
});

test('le labo sert le fichier tel quel par défaut, et enveloppé avec LAB_API_EVAL=1 (aucune autre valeur)', () => {
  assert.equal(servedPluginApi(API, {}), API);
  assert.equal(servedPluginApi(API, { LAB_API_EVAL: '0' }), API);
  assert.equal(servedPluginApi(API, { LAB_API_EVAL: 'oui' }), API);
  assert.equal(servedPluginApi(API, { LAB_API_EVAL: '1' }), evalWrapped(API));
});
