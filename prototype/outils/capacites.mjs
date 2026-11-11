// Les capacités que les apps du catalogue déclarent dans leur manifeste (contrats 3.4) et la raison qu'elles en donnent : la liste que relit un client, son responsable de la sécurité.
// « Quelles apps reçoivent l'adresse e-mail de la personne ? » : `--identite` (décision du porteur du 03/11 : GFS ne la donne qu'aux apps qui la déclarent, contrats 5.2, point 9).
//
//   node outils/capacites.mjs                toutes les capacités déclarées, une ligne chacune, raison en français
//   node outils/capacites.mjs --identite     seulement l'identité (l'adresse e-mail de la personne)
//   node outils/capacites.mjs --en           les raisons en anglais
//   node outils/capacites.mjs --json         la même liste pour un programme

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATALOGUE } from '../js/apps/catalogue.js';
import { listCapabilities, label } from '../js/apps/manifest.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Les manifestes du catalogue, lus sur le disque (un manifeste illisible est dit, jamais passé sous silence).
export function readManifests(root = ROOT) {
  return CATALOGUE.map((entry) => {
    try { return JSON.parse(readFileSync(join(root, entry.manifeste), 'utf8')); } catch (error) { throw new Error(`${entry.manifeste} : ${error.message}`); }
  });
}

// Une ligne de la liste, dans la langue demandée : « app · capacité (détail) : raison ».
export const describe = (row, lang) => `${row.app} (${label(row.nom, lang)}) · ${row.capacite}${row.detail ? ` [${row.detail}]` : ''} : ${label(row.pourquoi, lang) || '(aucune raison donnée)'}`;

export function main(argv, root = ROOT, write = text => process.stdout.write(`${text}\n`)) {
  const lang = argv.includes('--en') ? 'en' : 'fr';
  let rows = listCapabilities(readManifests(root));
  if (argv.includes('--identite')) rows = rows.filter(row => row.capacite === 'identite');
  if (argv.includes('--json')) { write(JSON.stringify(rows, null, 2)); return rows; }
  if (!rows.length) write(argv.includes('--identite') ? 'Aucune app du catalogue ne reçoit l\'adresse e-mail de la personne.' : 'Aucune app du catalogue ne déclare de capacité.');
  for (const row of rows) write(describe(row, lang));
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
