// Les gestes et la lecture communs aux deux essais de Form+ : `run-form` (dans GFS) et `run-form-seul` (sans GFS, posée comme widget de Grist).

// Ce que Form+ a enregistré (consignes 007, 008 et 013) : les lignes de `FormPlus_Formulaires` (nom, section du widget, formulaire géré `vsId`) et, pour chacune, ce qui sert au lien public de CE
// formulaire seul : sa petite table `FormPlus_Pub_<vsId>` (`pub` : combien de lignes, et si la ligne porte bien son `vsId`), la colonne cachée `FormPlusDef_<vsId>` de la table du formulaire (`def` :
// une Référence vers cette petite table qui affiche `Definition`) et l'état de son champ dans la copie (`champ` : `cache`, `visible` ou `absent` ; `autres` : les champs de définition d'un autre
// formulaire restés dans la copie, qu'un lien lirait aussi). `gates` : les sections de formulaire posées pour `FormPlus_Formulaires` (le portillon d'avant `c249c4a`), publiées ou non. `ancienne` :
// la colonne `FormPlusDef` d'avant la 013, partagée par tous les formulaires. `target` : un cadre qui parle à Grist avec l'accès complet.
export function savedForms(target) {
  return target.evaluate(async () => {
    const meta = await grist.docApi.fetchTable('_grist_Tables');
    const columns = await grist.docApi.fetchTable('_grist_Tables_column');
    const sections = await grist.docApi.fetchTable('_grist_Views_section');
    const fields = await grist.docApi.fetchTable('_grist_Views_section_field');
    const tableOf = id => meta.tableId[meta.id.indexOf(id)];
    const colOf = id => columns.colId[columns.id.indexOf(id)];
    const ref = meta.id[meta.tableId.indexOf('FormPlus_Formulaires')];
    const gates = sections.id.flatMap((id, i) => (ref && sections.tableRef[i] === ref && sections.parentKey[i] === 'form'
      ? [{ id, page: sections.parentId[i], publiee: /"publish":\s*true/.test(sections.shareOptions[i] || ''), champs: fields.parentId.filter(parent => parent === id).length }] : []));
    const forms = sections.id.filter((id, i) => sections.parentKey[i] === 'form').length;
    const ancienne = columns.colId.includes('FormPlusDef');
    if (!ref) return { table: false, gates, forms, rows: [], ancienne };
    const data = await grist.docApi.fetchTable('FormPlus_Formulaires');
    const parse = text => { try { return JSON.parse(text || '{}'); } catch (error) { return {}; } };
    const rows = [];
    for (let i = 0; i < data.id.length; i++) {
      const vsId = parse(data.Definition && data.Definition[i]).vsId || null;
      const defAt = vsId ? columns.colId.indexOf(`FormPlusDef_${vsId}`) : -1;
      const def = defAt < 0 ? null : { table: tableOf(columns.parentId[defAt]), type: columns.type[defAt], affiche: columns.visibleCol[defAt] ? colOf(columns.visibleCol[defAt]) : null };
      const mine = defAt < 0 ? -1 : fields.id.findIndex((id, j) => fields.parentId[j] === vsId && fields.colRef[j] === columns.id[defAt]);
      const champ = mine < 0 ? 'absent' : (/"formIsHidden":\s*true/.test(fields.widgetOptions[mine] || '') ? 'cache' : 'visible');
      const autres = fields.id.flatMap((id, j) => (fields.parentId[j] === vsId && j !== mine && /^FormPlusDef/.test(colOf(fields.colRef[j]) || '') ? [colOf(fields.colRef[j])] : []));
      const pubTable = `FormPlus_Pub_${vsId}`;
      let pub = null;
      if (vsId && meta.tableId.includes(pubTable)) {
        const small = await grist.docApi.fetchTable(pubTable);
        pub = { lignes: small.id.length, sienne: small.id.length === 1 && parse(small.Definition[0]).vsId === vsId };
      }
      rows.push({ id: data.id[i], nom: data.Nom[i], widget: data.IdSectionWidget && data.IdSectionWidget[i], vsId, def, champ, cache: champ === 'cache', autres, pub });
    }
    return { table: true, gates, forms, rows, ancienne };
  });
}

export const formLink = sectionId => `http://127.0.0.1:8910/o/docs/forms/LABO/${sectionId}`;

// Amène le champ du lien à l'écran, d'où que Form+ parte : l'écran de départ (« Vous avez déjà un lien de formulaire ? »), le panneau « Partir de zéro » (« Changer de méthode »), ou un
// formulaire déjà ouvert (Paramètres, « Changer de formulaire source »). 012, point 3 : le bouton « Changer de formulaire source » reste dans la page.
async function openLinkField(page, form) {
  const shown = selector => form.locator(`${selector}:visible`).first().isVisible().catch(() => false);
  // Le cadre vient de s'ouvrir ou de se recharger : attendre qu'un de ces éléments soit à l'écran, puis qu'il se pose (l'écran de départ peut céder la place à l'éditeur du formulaire retenu).
  await form.locator('#link:visible, #change-source-btn:visible, [data-etab="settings"]:visible, [data-startgo]:visible').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  if (await shown('#link')) return;
  if (!(await shown('#change-source-btn')) && !(await shown('[data-startgo]')) && await shown('[data-etab="settings"]')) {
    await form.locator('[data-etab="settings"]:visible').first().click();
    await page.waitForTimeout(500);
  }
  if (await shown('#change-source-btn')) {
    await form.locator('#change-source-btn:visible').first().click();
    await page.waitForTimeout(500);
  }
  if (await shown('[data-startgo="choices"]')) {
    await form.locator('[data-startgo="choices"]:visible').first().click();
    await page.waitForTimeout(500);
  }
  await form.locator('[data-startgo="link"]:visible').first().waitFor({ timeout: 30000 });
  await form.locator('[data-startgo="link"]:visible').first().click();
}

// Les fenêtres d'accord des deux côtés pendant un geste de Form+, dans l'ordre où elles s'ouvrent : celles de Form+ (la fenêtre du kit, `#pp-dialog-message`) et, dans GFS, celles de la
// publication (`.ask`, contrats 3.3 point 9). Chacune est acceptée à la vraie souris et son texte gardé : { cote: 'Form+', titre, texte } ou { cote: 'GFS', titre, lignes }. `host` : le cadre de GFS
// (`null` sans GFS). Rend la liste une fois que plus rien ne s'ouvre pendant `quiet` ms.
const CONFIRM = /Créer la table|Create the table|Publier la copie|Publish the copy|Fermer cette porte|Close this door|^Créer$|^Create$/;
export async function acceptWindows(page, form, host = null, { quiet = 6000, limit = 90000 } = {}) {
  const seen = [];
  const started = Date.now();
  let last = started;
  while (Date.now() - started < limit && Date.now() - last < quiet) {
    const own = form.locator('#pp-dialog-message');
    const ask = host ? host.locator('.ask').first() : null;
    if (await own.isVisible().catch(() => false)) {
      const titre = await form.locator('.pp-dialog-title, #pp-dialog-title, [id^="pp-dialog"] h2, [id^="pp-dialog"] h3').first().innerText().catch(() => '');
      seen.push({ cote: 'Form+', titre: titre.replace(/\s+/g, ' '), texte: (await own.innerText()).replace(/\s+/g, ' ') });
      await form.getByRole('button', { name: CONFIRM }).first().click();
    } else if (ask && await ask.isVisible().catch(() => false)) {
      seen.push({ cote: 'GFS', titre: await ask.locator('h2').innerText(), lignes: await ask.locator('.ask-items li').allInnerTexts() });
      await host.locator('[data-fk="ask-yes"]').click();
    } else {
      await page.waitForTimeout(250);
      continue;
    }
    last = Date.now();
    await page.waitForTimeout(400);
  }
  return seen;
}

// Enregistrer un formulaire à la vraie souris et au vrai clavier : le champ du lien, le lien du formulaire natif `sectionId` (la clé de partage n'est pas lue par Form+ pour enregistrer),
// « Générer », puis chaque fenêtre d'accord qui s'ouvre, des deux côtés (`acceptWindows`). Rend la liste des fenêtres vues, vide quand rien ne s'est ouvert.
export async function saveByLink(page, form, sectionId, host = null, options = {}) {
  // Le guide de publication (Form+ c32ae54) est à l'écran après « Créer le formulaire » : son étape 3 a son propre champ, où le lien se tape et Entrée le valide (le collage aussi).
  const guideField = form.locator('#guide-link:visible').first();
  if (await guideField.isVisible().catch(() => false)) {
    await guideField.click();
    await page.keyboard.type(formLink(sectionId));
    await page.keyboard.press('Enter');
    return acceptWindows(page, form, host, options);
  }
  await openLinkField(page, form);
  await form.locator('#link').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(formLink(sectionId));
  await form.locator('#generate').click();
  return acceptWindows(page, form, host, options);
}

// Le message que Form+ écrit sous le champ du lien (« Configuration enregistrée… », ou la raison d'un refus).
export const linkMessage = form => form.locator('#cfg-msg').innerText().then(text => text.replace(/\s+/g, ' ').trim(), () => '');

// Un formulaire natif de `Clients` sur SA page (une nouvelle page du document, que n'occupe aucun widget) : le cas des personnes qui le posent dans leur document. Rend `{ sectionRef,
// viewRef }`. Poser une section sur la page d'un widget fait reconstruire son cadre par Grist ; sur une page à part, rien ne bouge.
export function ownPageForm(target) {
  return target.evaluate(async () => {
    const tables = await grist.docApi.fetchTable('_grist_Tables');
    const clients = tables.id[tables.tableId.indexOf('Clients')];
    return (await grist.docApi.applyUserActions([['CreateViewSection', clients, 0, 'form', null, null]])).retValues[0];
  });
}

// Un formulaire natif de `Clients` posé sur la page du WIDGET (la personne met son widget à côté de son formulaire). Grist reconstruit alors le cadre qui porte le widget, pendant le geste même :
// la réponse n'arrive pas toujours, on relit donc la section posée. `reopen` : comment retrouver le cadre reconstruit (par défaut celui de GFS, `lab.gfsFrame` ; sans GFS, celui de Form+).
// Rend `{ host, section, view }` : le cadre reconstruit, la section de formulaire et la page du widget.
export async function formOnWidgetPage(lab, host, reopen = null) {
  await host.evaluate(async () => {
    const sections = await grist.docApi.fetchTable('_grist_Views_section');
    const tables = await grist.docApi.fetchTable('_grist_Tables');
    const widget = sections.id.find((id, i) => sections.parentKey[i] === 'custom');
    await grist.docApi.applyUserActions([['CreateViewSection', tables.id[tables.tableId.indexOf('Clients')], sections.parentId[sections.id.indexOf(widget)], 'form', null, null]]);
  }).catch(() => {});
  await lab.page.waitForTimeout(5000);
  const rebuilt = reopen ? await reopen() : await lab.gfsFrame(/access=full/);
  if (!reopen) await lab.gfsReady(rebuilt);
  const found = await rebuilt.evaluate(async () => {
    const sections = await grist.docApi.fetchTable('_grist_Views_section');
    const widget = sections.id.find((id, i) => sections.parentKey[i] === 'custom');
    const view = sections.parentId[sections.id.indexOf(widget)];
    return { view, section: sections.id.find((id, i) => sections.parentKey[i] === 'form' && sections.parentId[i] === view) };
  });
  return { host: rebuilt, ...found };
}

// L'ancien portillon (Form+ à `038dd1b`) : une section de formulaire PUBLIÉE sur `FormPlus_Formulaires`, que la 008 a retirée du code et que la 012 (point 7) ferme avec l'accord de la personne. Poser la
// publication (`shareOptions`) comme Grist le fait pour une section qu'on publie. Rend la section posée.
export function oldGate(target) {
  return target.evaluate(async () => {
    const tables = await grist.docApi.fetchTable('_grist_Tables');
    const made = (await grist.docApi.applyUserActions([['CreateViewSection', tables.id[tables.tableId.indexOf('FormPlus_Formulaires')], 0, 'form', null, null]])).retValues[0];
    await grist.docApi.applyUserActions([['UpdateRecord', '_grist_Views_section', made.sectionRef, { shareOptions: JSON.stringify({ publish: true, form: true }) }]]);
    return made.sectionRef;
  });
}
