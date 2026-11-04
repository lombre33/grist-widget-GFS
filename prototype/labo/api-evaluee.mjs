// Le script de l'API des widgets, tel que la page de l'app l'ouvre. Le fichier de docs.getgrist.com s'évalue par eval() (console du porteur le 04/11, faits vérifiés 27) ; celui d'un Grist Docker et celui
// de grist-static n'évaluent rien, et ce sont eux que le labo sert à sa place : une page sans `'unsafe-eval'` (Form+, jusqu'à la consigne 018) y démarrait, et pas chez le porteur.
// Le labo sert ce fichier enveloppé dans un `eval(…)`, par défaut depuis que Form+ a appliqué la consigne 018 (04/11) : une page dont la politique refuse l'évaluation y échoue ici comme chez le porteur. Le `var grist;` de
// tête est celui du fichier réel (le Docker le porte aussi) : la page lit alors `grist` vide (« grist is undefined », comme la console du porteur), et non « grist is not defined ».
// `LAB_API_EVAL=0` sert le fichier tel quel (ce qu'un Grist Docker ou grist-static sert) : pour comparer, ou pour une app qui n'a pas encore `'unsafe-eval'` (guide des apps, règle 11).
export const evalWrapped = text => `var grist;\neval(${JSON.stringify(text)});`;

// Le fichier à servir : enveloppé, sauf avec `LAB_API_EVAL=0` (aucune autre valeur ne le coupe).
export const servedPluginApi = (text, env = process.env) => (env.LAB_API_EVAL === '0' ? text : evalWrapped(text));
