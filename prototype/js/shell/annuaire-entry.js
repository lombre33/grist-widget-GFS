// La porte du module Annuaire (demande du porteur du 25/11) : le bouton de la barre et celui de l'explorateur l'ouvrent ici. Le module (js/annuaire/) ne se
// charge qu'au premier clic : GFS ne paie ni son code ni sa lecture tant que la personne n'ouvre pas l'annuaire. Le contrôleur (`c`) garde le contrôle monté
// (`c.annuaire`) pour que la langue le suive.

// Ouvre l'annuaire (celui de la ligne `row` quand l'explorateur le demande, sinon le dernier vu) ; un module qui ne se charge pas (le réseau, un fichier
// absent) se dit à la personne, sans rien casser.
export async function openAnnuaire(c, row = null) {
  try {
    if (!c.annuaire) {
      const { createAnnuaire } = await import('../annuaire/annuaire-control.js');
      c.annuaire ??= createAnnuaire(c);
    }
    await c.annuaire.open(row);
  } catch (error) {
    console.error('GFS : l\'annuaire ne s\'ouvre pas', error);
    c.notice(c.t('an.loadFailed'));
  }
}

// « Choisir une personne dans l'annuaire » pour une app (contrats 5.4, point 16) : la fenêtre de choix s'ouvre par-dessus l'app. Rend la personne choisie ({
// nom, email, titre, telephone, annuaire }) ou `null` (annulé, ou le module ne se charge pas : la personne en est prévenue).
export async function pickPerson(c, opts) {
  try {
    if (!c.annuaire) {
      const { createAnnuaire } = await import('../annuaire/annuaire-control.js');
      c.annuaire ??= createAnnuaire(c);
    }
    return await c.annuaire.pick(opts);
  } catch (error) {
    console.error('GFS : le choix d\'une personne n\'aboutit pas', error);
    c.notice(c.t('an.loadFailed'));
    return null;
  }
}

// Ferme la fenêtre de choix quand l'app qui la demandait n'est plus là.
export function cancelPick(c) {
  if (c.annuaire) c.annuaire.cancelPick();
}
