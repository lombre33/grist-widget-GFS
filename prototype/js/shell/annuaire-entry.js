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
