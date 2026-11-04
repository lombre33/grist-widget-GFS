// Le script de l'API des widgets, tel que la page de l'app l'ouvre. Le fichier de docs.getgrist.com s'évalue par eval() (console du porteur le 04/11, faits vérifiés 27) ; celui d'un Grist Docker et celui
// de grist-static n'évaluent rien, et ce sont eux que le labo sert à sa place : une page sans `'unsafe-eval'` (Form+, jusqu'à la consigne 018) y démarrait, et pas chez le porteur.
// `LAB_API_EVAL=1` sert le même fichier enveloppé dans un `eval(…)` : une page dont la politique refuse l'évaluation y échoue ici comme chez lui. Le `var grist;` de tête est celui du fichier réel
// (le Docker le porte aussi) : la page lit alors `grist` vide (« grist is undefined », comme la console du porteur), et non « grist is not defined ».
// Pas le défaut tant qu'une app de la suite n'a pas `'unsafe-eval'` pour ce fichier (guide des apps, règle 11) : ses passes échoueraient sans que GFS y puisse rien.
export const evalWrapped = text => `var grist;\neval(${JSON.stringify(text)});`;

// Le fichier à servir : tel quel, ou enveloppé quand `LAB_API_EVAL=1`.
export const servedPluginApi = (text, env = process.env) => (env.LAB_API_EVAL === '1' ? evalWrapped(text) : text);
