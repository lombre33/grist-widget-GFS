// Le catalogue : les apps livrées avec cette version de GFS (contrats 2.1). Un id hors catalogue n'est jamais chargé.
// Provisoire : tant que les apps n'ont pas leur `gfs.json`, le manifeste de chacune est écrit ici, dans manifestes/ ; il passera à la
// racine du dépôt de chaque app (la ligne `manifeste` disparaît alors, et le dossier de l'app suffit).
//
// `dossier` est le sous-module Git de l'app. L'adresse du sous-cadre est toujours calculée à partir de ces deux lignes, jamais lue
// dans un réglage, une table ou un message (contrats 1.3, point 2).

export const CATALOGUE = Object.freeze([
  Object.freeze({ id: 'publipostage', dossier: 'apps/publipostage/', manifeste: 'manifestes/publipostage.json' }),
  Object.freeze({ id: 'automation', dossier: 'apps/automation/', manifeste: 'manifestes/automation.json' }),
  Object.freeze({ id: 'form', dossier: 'apps/form/', manifeste: 'manifestes/form.json' }),
]);

export const catalogueEntry = id => CATALOGUE.find(entry => entry.id === id) || null;
