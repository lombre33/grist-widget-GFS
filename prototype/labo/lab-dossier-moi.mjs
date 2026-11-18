// Les gestes que les essais d'un dossier de « Moi » partagé dans un VRAI Grist ont en commun (run-partager-moi.mjs, run-renommer-dossier.mjs) : un fichier de plus dans la table des fichiers, la ligne de
// rangement d'une personne, la fenêtre « Partager… » d'un fichier ou d'un dossier à la vraie souris, la lecture d'une table. Un seul endroit, pour que les essais ne se recopient pas.
import { createI18n } from '../js/i18n/i18n.js';
import { check } from './lab-common.mjs';
import { openRowMenu } from './lab-pdf.mjs';
import { gfsFrame } from './lab-droits.mjs';
import { call, rowsOf } from './lab-rest.mjs';

const { t } = createI18n(process.env.LAB_LANG || 'fr');
export const FILES = 'GFS_Fichiers', SHARES = 'GFS_Partages', FILING = 'GFS_Rangement';

export const has = (value, who) => JSON.stringify(value ?? null).toLowerCase().includes(who);
export const fileRow = async (run, name) => ((await rowsOf(run, FILES)) || []).find(row => row.Nom === name);
export const keyOf = row => `gfs-fichiers:${row.Identifiant}`;
// La cible d'un partage de dossier de « Moi » à l'ancienne mode (le chemin) ; `idTarget`, celle d'aujourd'hui (le numéro de la ligne d'état du dossier).
export const personal = (who, path) => `dossier:moi:${who}/${path}`;
export const idTarget = (who, id) => `dossier:moi:${who}//${id}`;

// Un fichier de plus dans la table des fichiers (une ligne sans pièce jointe : la liste et le partage ne lisent que les lignes), à l'adresse de la session de la page : Grist écrit l'auteur.
export async function addFile(run, name, id, who) {
  const answer = await call(run.page, 'POST', `/api/docs/${run.docId}/tables/${FILES}/records`, { records: [{ fields: { Identifiant: id, Nom: name, Type: 'application/pdf', Auteur: who, Taille: 1000, Origine: 'import' } }] });
  check(`« ${name} » est ajouté (auteur écrit par Grist)`, answer.status === 200, answer.text);
  return fileRow(run, name);
}
// La ligne de rangement d'une personne : où ELLE range ce fichier.
export const filing = (who, row, folder) => ['AddRecord', FILING, null, { Utilisateur: who, App: 'gfs-fichiers', Fichier: row.Identifiant, Dossier: folder, Favori: false }];

export async function openShareFor(frame, name) {
  await openRowMenu(frame, name);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('.mod.sh .rt-content').waitFor();
}
export const closeShare = async frame => { await frame.locator('[data-fk="share-close"]').click(); await frame.locator('.mod.sh').waitFor({ state: 'detached' }); };
export const folderRow = (frame, name) => frame.locator('.ls-row.folder', { has: frame.locator('.t', { hasText: new RegExp(`^${name}$`) }) });
// « Partager… » du menu d'un dossier ; rend vrai quand l'article est grisé.
export async function openFolderShare(frame, name) {
  await folderRow(frame, name).click({ button: 'right' });
  const entry = frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) });
  await entry.waitFor();
  const greyed = (await entry.getAttribute('aria-disabled')) === 'true';
  await entry.click();
  await frame.locator('.mod.sh .rt-content').waitFor();
  return greyed;
}
export async function pickWho(frame, who, label = who) {
  await frame.locator('[data-fk="share-add"]').click();
  await frame.locator('[data-fk="share-add"]').fill(label);
  await frame.locator(`[data-fk="share-pick-${who}"]`).click();
  await frame.locator('[data-fk="share-confirm"]').click();
  await frame.locator('.mod.sh .rr[data-share]').first().waitFor({ timeout: 15000 });
}
export async function waitReload(page, old) {
  for (let i = 0; i < 240 && !old.isDetached(); i++) await page.waitForTimeout(250);
  return gfsFrame(page, { keep: true });
}

// Les lignes d'état de dossier d'une personne dans `GFS_Rangement` (ni app ni fichier, un chemin) : [{ id, Dossier }], dans l'ordre des numéros.
export const stateRows = async (run, who) => ((await rowsOf(run, FILING)) || []).filter(row => String(row.Utilisateur).toLowerCase() === who && !row.App && !row.Fichier && row.Dossier);
// Le numéro de la ligne d'état du dossier `path` de `who`, ou null.
export const folderId = async (run, who, path) => (await stateRows(run, who)).find(row => row.Dossier === path)?.id ?? null;
// Les lignes de partage dont la cible est `target`.
export const sharesOn = async (run, target) => ((await rowsOf(run, SHARES)) || []).filter(row => row.Cible === target);

// Active le partage du document par « Partager… » d'un fichier (la question dit ce que le rangement devient) ; rend le cadre rechargé par Grist.
export async function activateSharing(run, name) {
  const { page } = run;
  let { frame } = run;
  await openShareFor(frame, name);
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), frame.locator('[data-fk="ask-yes"]').click()]);
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 40000 });
  await closeShare(frame);
  return frame;
}

// Les phrases que le widget dit, toutes (une phrase en remplace une autre, parfois dans le même instant : la dernière ne dit pas ce qu'a dit le geste avant elle). Rend une fonction qui lit la liste.
export async function watchToasts(frame) {
  await frame.evaluate(() => {
    window.__toasts = [];
    const node = document.getElementById('toast');
    new MutationObserver(() => { const text = node.textContent.trim(); if (text && window.__toasts.at(-1) !== text) window.__toasts.push(text); })
      .observe(node, { childList: true, characterData: true, subtree: true });
  });
  return () => frame.evaluate(() => window.__toasts.slice());
}
