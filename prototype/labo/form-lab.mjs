// Les gestes et la lecture communs aux deux essais de Form+ : `run-form` (dans GFS) et `run-form-seul` (sans GFS, posée comme widget de Grist).

// Ce que Form+ a enregistré (consigne 007) : les lignes de `FormPlus_Formulaires` (nom, section du widget, formulaire géré) et les sections de formulaire posées pour cette table
// (`ensureTableGate`), publiées ou non, avec leurs champs. `target` : un cadre qui parle à Grist avec l'accès complet.
export function savedForms(target) {
  return target.evaluate(async () => {
    const meta = await grist.docApi.fetchTable('_grist_Tables');
    const sections = await grist.docApi.fetchTable('_grist_Views_section');
    const fields = await grist.docApi.fetchTable('_grist_Views_section_field');
    const ref = meta.id[meta.tableId.indexOf('FormPlus_Formulaires')];
    const gates = sections.id.flatMap((id, i) => (ref && sections.tableRef[i] === ref && sections.parentKey[i] === 'form'
      ? [{ id, page: sections.parentId[i], publiee: /"publish":\s*true/.test(sections.shareOptions[i] || ''), champs: fields.parentId.filter(parent => parent === id).length }] : []));
    const forms = sections.id.filter((id, i) => sections.parentKey[i] === 'form').length;
    if (!ref) return { table: false, gates, forms, rows: [] };
    const data = await grist.docApi.fetchTable('FormPlus_Formulaires');
    const managed = text => { try { return JSON.parse(text || '{}').vsId; } catch (error) { return null; } };
    return { table: true, gates, forms, rows: data.id.map((id, i) => ({ id, nom: data.Nom[i], widget: data.IdSectionWidget && data.IdSectionWidget[i], vsId: managed(data.Definition && data.Definition[i]) })) };
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
  await page.keyboard.type(`http://127.0.0.1:8910/o/docs/forms/LABO/${sectionId}`);
  await form.locator('#generate').click();
  const dialog = form.locator('#pp-dialog-message');
  const asked = await dialog.waitFor({ timeout: 5000 }).then(() => dialog.innerText(), () => null);
  if (asked) {
    await beforeYes();
    await form.getByRole('button', { name: /Créer la table|Create the table/ }).click();
  }
  return asked;
}
