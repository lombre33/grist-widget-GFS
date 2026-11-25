// Copier un texte dans le presse-papiers (l'adresse ou le téléphone d'une fiche de l'annuaire). Le widget tourne dans un cadre que Grist n'autorise pas
// toujours à écrire dans le presse-papiers : l'API du navigateur d'abord, puis, si elle refuse, la sélection d'un champ caché (la vieille voie, qui marche dans
// un cadre). Rend true quand le texte est copié, false sinon : la fenêtre le dit à la personne dans les deux cas.

export async function copyText(value, doc = document) {
  const win = doc.defaultView;
  try {
    await win.navigator.clipboard.writeText(value);
    return true;
  } catch (error) { /* le cadre refuse : la sélection ci-dessous */ }
  try {
    const field = doc.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.className = 'an-copy-field';
    doc.body.append(field);
    field.select();
    const done = doc.execCommand('copy');
    field.remove();
    return done;
  } catch (error) {
    return false;
  }
}
