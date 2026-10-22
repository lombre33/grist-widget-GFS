// Les gestes et la lecture communs aux deux essais de Form+ : `run-form` (dans GFS) et `run-form-seul` (sans GFS, posée comme widget de Grist).

// Ce que Form+ a enregistré (consignes 007 et 008) : les lignes de `FormPlus_Formulaires` (nom, section du widget, formulaire géré `vsId`, et l'état du champ `FormPlusDef` de cette
// copie : `cache` (caché, comme la 008 le veut), `visible` (la copie l'a reçu de son formulaire d'origine, Form+ ne le cache pas) ou `absent`), la colonne `FormPlusDef` (une
// Référence vers `FormPlus_Formulaires` qui affiche `Definition`) et les sections de formulaire posées pour cette table, publiées ou non (`gates` : le portillon des versions d'avant
// `c249c4a`, retiré par la 008, point 3 ; toujours vide maintenant). `target` : un cadre qui parle à Grist avec l'accès complet.
export function savedForms(target) {
  return target.evaluate(async () => {
    const meta = await grist.docApi.fetchTable('_grist_Tables');
    const columns = await grist.docApi.fetchTable('_grist_Tables_column');
    const sections = await grist.docApi.fetchTable('_grist_Views_section');
    const fields = await grist.docApi.fetchTable('_grist_Views_section_field');
    const ref = meta.id[meta.tableId.indexOf('FormPlus_Formulaires')];
    const tableOf = id => meta.tableId[meta.id.indexOf(id)];
    const gates = sections.id.flatMap((id, i) => (ref && sections.tableRef[i] === ref && sections.parentKey[i] === 'form'
      ? [{ id, page: sections.parentId[i], publiee: /"publish":\s*true/.test(sections.shareOptions[i] || ''), champs: fields.parentId.filter(parent => parent === id).length }] : []));
    const forms = sections.id.filter((id, i) => sections.parentKey[i] === 'form').length;
    if (!ref) return { table: false, gates, forms, rows: [], def: null };
    const defAt = columns.colId.indexOf('FormPlusDef');
    const shown = defAt < 0 ? null : columns.colId[columns.id.indexOf(columns.visibleCol[defAt])];
    const def = defAt < 0 ? null : { id: columns.id[defAt], table: tableOf(columns.parentId[defAt]), type: columns.type[defAt], affiche: shown || null };
    const fieldOf = vsId => {
      const at = fields.id.findIndex((id, i) => fields.parentId[i] === vsId && def && fields.colRef[i] === def.id);
      if (at < 0) return 'absent';
      return /"formIsHidden":\s*true/.test(fields.widgetOptions[at] || '') ? 'cache' : 'visible';
    };
    const data = await grist.docApi.fetchTable('FormPlus_Formulaires');
    const managed = text => { try { return JSON.parse(text || '{}').vsId; } catch (error) { return null; } };
    return {
      table: true, gates, forms, def,
      rows: data.id.map((id, i) => {
        const vsId = managed(data.Definition && data.Definition[i]);
        const champ = vsId ? fieldOf(vsId) : null;
        return { id, nom: data.Nom[i], widget: data.IdSectionWidget && data.IdSectionWidget[i], vsId, champ, cache: champ === 'cache' };
      }),
    };
  });
}

// Enregistrer un formulaire à la vraie souris et au vrai clavier : « Repartir d'un formulaire existant », le lien du formulaire natif `sectionId` (la clé de partage n'est pas lue
// par Form+ pour enregistrer), « Générer », puis « Créer la table » quand Form+ demande l'accord de la personne. `beforeYes` : appelé quand la fenêtre est ouverte (une capture).
// Rend le texte de la fenêtre d'accord, ou null quand Form+ n'en ouvre pas.
export async function saveByLink(page, form, sectionId, beforeYes = async () => {}) {
  await form.waitForSelector('[data-startgo="link"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await form.locator('[data-startgo="link"]').click();
  await form.locator('#link').click();
  await page.keyboard.type(formLink(sectionId));
  await form.locator('#generate').click();
  const dialog = form.locator('#pp-dialog-message');
  const asked = await dialog.waitFor({ timeout: 5000 }).then(() => dialog.innerText(), () => null);
  if (asked) {
    await beforeYes();
    await form.getByRole('button', { name: /Créer la table|Create the table/ }).click();
  }
  return asked;
}

export const formLink = sectionId => `http://127.0.0.1:8910/o/docs/forms/LABO/${sectionId}`;

// Le concepteur est déjà ouvert sur un formulaire : coller le lien d'un autre (le champ de l'adresse), puis « Générer ».
export async function pasteLink(page, form, sectionId) {
  await form.locator('#link').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(formLink(sectionId));
  await form.locator('#generate').click();
}

// Un formulaire natif de `Clients` sur SA page (une nouvelle page du document, que n'occupe aucun widget) : le cas des personnes qui le posent dans leur document. Rend `{ sectionRef,
// viewRef }`. Poser une section sur la page d'un widget fait reconstruire son cadre par Grist ; sur une page à part, rien ne bouge.
export function ownPageForm(target) {
  return target.evaluate(async () => {
    const tables = await grist.docApi.fetchTable('_grist_Tables');
    const clients = tables.id[tables.tableId.indexOf('Clients')];
    return (await grist.docApi.applyUserActions([['CreateViewSection', clients, 0, 'form', null, null]])).retValues[0];
  });
}

// Les fenêtres d'accord à la publication que GFS ouvre pendant un geste de Form+ (contrats 3.3, point 9) : « Autoriser » à la vraie souris à chacune, et le texte de ce qu'elle dit. `host` : le
// cadre de GFS. Rend la liste des fenêtres vues ({ title, items }) ; vide quand le geste n'ouvre rien de nouveau. `wait` : combien de temps attendre la première (ms).
export async function allowPublications(host, wait = 8000) {
  const seen = [];
  const dialog = host.locator('.ask');
  for (;;) {
    const opened = await dialog.first().waitFor({ timeout: seen.length ? 3000 : wait }).then(() => true, () => false);
    if (!opened) return seen;
    seen.push({ title: await dialog.locator('h2').innerText(), items: await dialog.locator('.ask-items li').allInnerTexts() });
    await host.locator('[data-fk="ask-yes"]').click();
    await dialog.first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
}

