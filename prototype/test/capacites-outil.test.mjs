// L'outil qui liste les capacités déclarées par les apps du catalogue (contrats 3.4 ; décision du porteur du 03/11 : « un client peut les lister »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, describe, readManifests, ROOT } from '../outils/capacites.mjs';
import { publipostage, automation, form } from './helpers.mjs';

const WHY = { fr: 'Pour « Mes tâches » : montrer les tâches de la personne', en: 'For “My tasks”: show the person\'s own tasks' };

// Un dossier de manifestes comme celui du prototype, où Publipostage+ déclare l'identité.
function withIdentity() {
  const root = mkdtempSync(join(tmpdir(), 'gfs-capacites-'));
  mkdirSync(join(root, 'manifestes'));
  const declared = publipostage();
  declared.permissions.identite = { pourquoi: WHY };
  for (const m of [declared, automation(), form()]) writeFileSync(join(root, 'manifestes', `${m.id}.json`), JSON.stringify(m));
  return root;
}
const collect = () => { const lines = []; return { lines, write: text => lines.push(text) }; };

test('--identite : aucune app du catalogue ne la reçoit tant qu\'aucune ne l\'a déclarée', () => {
  const out = collect();
  const rows = main(['--identite'], ROOT, out.write);
  assert.deepEqual(rows, []);
  assert.match(out.lines.join('\n'), /Aucune app du catalogue ne reçoit l'adresse e-mail/);
});

test('--identite : l\'app qui la déclare, avec sa raison dans la langue demandée', () => {
  const root = withIdentity();
  try {
    const fr = collect();
    const rows = main(['--identite'], root, fr.write);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].app, 'publipostage');
    assert.equal(fr.lines.length, 1);
    assert.match(fr.lines[0], /^publipostage \(Publipostage\+\) · identite : Pour « Mes tâches »/);
    const en = collect();
    main(['--identite', '--en'], root, en.write);
    assert.match(en.lines[0], /identite : For “My tasks”/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('sans filtre : toutes les capacités déclarées, ou « aucune » pour une app qui n\'en déclare pas', () => {
  const root = withIdentity();
  try {
    const all = collect();
    const rows = main([], root, all.write);
    assert.ok(rows.some(row => row.capacite === 'identite'));
    assert.ok(rows.some(row => row.app === 'form' && row.capacite === 'jeton'));
    assert.equal(all.lines.length, rows.length, 'une ligne par capacité');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('--json : la liste pour un programme', () => {
  const root = withIdentity();
  try {
    const out = collect();
    main(['--identite', '--json'], root, out.write);
    const parsed = JSON.parse(out.lines.join('\n'));
    assert.deepEqual(parsed.map(row => [row.app, row.capacite, row.pourquoi]), [['publipostage', 'identite', WHY]]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('describe : une raison absente est dite, jamais passée sous silence', () => {
  assert.match(describe({ app: 'x', nom: { fr: 'X', en: 'X' }, capacite: 'jeton', detail: '', pourquoi: null }, 'fr'), /\(aucune raison donnée\)/);
});

test('un manifeste illisible arrête la liste en le nommant', () => {
  const root = mkdtempSync(join(tmpdir(), 'gfs-capacites-'));
  try {
    mkdirSync(join(root, 'manifestes'));
    assert.throws(() => readManifests(root), /manifestes\/publipostage\.json/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
