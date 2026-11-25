// Refait test/golden/formules-apres-renommage.json d'après une mesure dans un vrai Grist : le lot du kit joué seul, puis les formules relues avant que GFS ne reprenne les siennes
// (`LAB_STALE=<fichier> node labo/run-noms-gfs.mjs`, labo/LISEZ-MOI.md). `stale` : ce que Grist laisse ; `expected` : ce que GFS écrit aujourd'hui ; `untouched` : les formules
// que Grist a suivies tout seul (rien à reprendre).
//   node outils/formules-mesurees.mjs <fichier mesuré> [<fichier d'arrivée>]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [input, output = fileURLToPath(new URL('../test/golden/formules-apres-renommage.json', import.meta.url))] = process.argv.slice(2);
if (!input) { console.error('usage : node outils/formules-mesurees.mjs <fichier mesuré> [<fichier d\'arrivée>]'); process.exit(2); }
const { stale: left, expected } = JSON.parse(readFileSync(input, 'utf8'));
if (!left || !expected) { console.error('Le fichier mesuré n\'a pas de `stale` : relancer la mesure avec LAB_STALE.'); process.exit(2); }
const golden = { _comment: `Mesuré dans Grist 1.7.19 (labo/run-noms-gfs.mjs, LAB_STALE, ${new Date().toISOString().slice(0, 10)}) : \`stale\` = les formules telles que Grist les laisse après le renommage des tables et des colonnes (colonnes d'aide comprises) d'un document bâti par GFS d'avant ; \`expected\` = ce que GFS d'aujourd'hui écrit ; \`untouched\` = celles que Grist a suivies seul. Figé : si les formules changent, ce fichier garde le cas mesuré.`, stale: {}, expected: {}, untouched: {} };
for (const [key, formula] of Object.entries(expected)) {
  if (left[key] === formula) golden.untouched[key] = formula;
  else { golden.stale[key] = left[key]; golden.expected[key] = formula; }
}
writeFileSync(output, `${JSON.stringify(golden, null, 1)}\n`);
console.log(`${Object.keys(golden.stale).length} formules à reprendre, ${Object.keys(golden.untouched).length} suivies par Grist : ${output}`);
