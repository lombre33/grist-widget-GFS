// La porte du module Guide (demande du porteur du 27/11) : le bouton de la barre et celui de l'explorateur l'ouvrent ici. Le module (js/guide/) ne se charge
// qu'au premier clic : GFS ne paie ni son code ni sa lecture tant que la personne n'ouvre pas le guide. Le contrôleur (`c`) garde le contrôle monté (`c.guide`)
// pour que la langue le suive.

async function control(c) {
  if (!c.guide) {
    const { createGuide } = await import('../guide/guide-control.js');
    c.guide ??= createGuide(c);
  }
  return c.guide;
}

// Ouvre le guide (celui de la ligne `row` quand l'explorateur le demande, sinon le dernier vu) ; un module qui ne se charge pas (le réseau, un fichier absent)
// se dit à la personne, sans rien casser.
export async function openGuide(c, row = null) {
  try {
    await (await control(c)).open(row);
  } catch (error) {
    console.error('GFS : le guide ne s\'ouvre pas', error);
    c.notice(c.t('gd.loadFailed'));
  }
}

// « Nouveau > Guide » de l'explorateur : le réglage d'un nouveau guide ; même porte que l'ouverture.
export async function newGuide(c) {
  try {
    await (await control(c)).createNew();
  } catch (error) {
    console.error('GFS : le guide ne se crée pas', error);
    c.notice(c.t('gd.loadFailed'));
  }
}
