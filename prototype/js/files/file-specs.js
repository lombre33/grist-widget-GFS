// Les déclarations de fichiers que GFS lit (contrats 2.4) : celles de ses propres fichiers, des annuaires et des apps installées, chacune avec le nom de sa
// table : [{ table, spec }]. L'index des noms (js/explorer/index-model.js) en fait ses tables-résumés ; les droits (js/rights/rights-reader.js) et le rangement
// des pages (js/files/page-tree.js) en ont besoin pour le poser et le reconnaître.

import { FILES_MANIFEST } from './gfs-files.js';
import { ANNUAIRES_MANIFEST } from './annuaire-files.js';

export const fileSpecsOf = manifests => [FILES_MANIFEST, ANNUAIRES_MANIFEST, ...manifests].flatMap(manifest =>
  (manifest.fichiers || []).map(spec => ({ table: spec.table, spec })));
