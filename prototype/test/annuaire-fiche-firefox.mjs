// La fiche d'une personne en sections sous Firefox (règle du 03/11 ; module Annuaire, retour du porteur du 25/11 : « sur le volet droit, le découpage hiérarchique », comme sa
// carte du suivi de projet), à la vraie souris et sur le vrai contrôle avec un faux Grist en mémoire (test/pages/annuaire.js). Suite de test/annuaire-firefox.mjs. À mesurer :
// les trois sections dans l'ordre (Coordonnées, Rattachement, Informations) avec leur titre, le rattachement (chaque niveau un cran plus bas, puis le poste, tout dans la fiche),
// une relation vide qui garde sa ligne avec un tiret, « Écrire » (un lien « mailto: » qui s'ouvre à part, absent sans adresse), et la lisibilité de chaque texte.
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';

const PROBES = { sectionTitle: ['.an-fs-h', '.an-side'], stepKey: ['.an-hp-k', '.an-side'], stepValue: ['.an-hp-v', '.an-side'], empty: ['.an-empty', '.an-side'], write: ['.an-write', '.an-write'] };

function sectionsSnap() {
  const card = document.querySelector('.an-side .an-fiche-card');
  if (!card) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const write = card.querySelector('.an-write');
  return {
    box: box(card), sections: [...card.querySelectorAll('.an-fs')].map(each => ({ title: text(each.querySelector('.an-fs-h')), box: box(each) })),
    steps: [...card.querySelectorAll('.an-hp-step')].map(step => ({ key: text(step.querySelector('.an-hp-k')), value: text(step.querySelector('.an-hp-v')), sub: step.classList.contains('is-sub'), box: box(step) })),
    empties: [...card.querySelectorAll('.an-fr')].filter(row => row.querySelector('.an-empty')).map(row => text(row.querySelector('dt'))),
    write: write ? { href: write.getAttribute('href'), target: write.target, rel: write.rel, text: text(write), box: box(write) } : null,
    subtitle: card.querySelector('.an-fiche-id .an-pe-sub') ? text(card.querySelector('.an-fiche-id .an-pe-sub')) : '',
  };
}

const insideX = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack;

async function openFiche(page, note, click, row, where) {
  await page.run(selector => { const node = document.querySelector(selector); if (node) node.scrollIntoView({ block: 'center' }); }, `[data-fk="pe:${row}"]`);
  if (!await click(`[data-fk="pe:${row}"]`)) return null;
  await delay(120);
  const snap = await page.run(sectionsSnap);
  if (!snap) note('fiche', `${where} : aucune fiche`);
  return snap;
}

export async function ficheSectionsProblems(page, t, note, click) {
  const where = 'la fiche en sections (Camille Durand)';
  const snap = await openFiche(page, note, click, 1, where);
  if (!snap) return;
  const titles = snap.sections.map(each => each.title);
  const wanted = [t('an.fiche.contact'), t('an.fiche.attach'), t('an.fiche.fields')];
  if (titles.join() !== wanted.join()) note('fiche', `${where} : les sections sont « ${titles.join(' | ')} » (« ${wanted.join(' | ')} » attendues)`);
  for (const each of snap.sections) if (!insideX(each.box, snap.box)) note('fiche', `${where} : la section « ${each.title} » sort de la fiche`);
  if (snap.steps.map(step => step.key).join() !== `Pôle,Direction,Service,${t('an.fiche.post')}`) note('fiche', `${where} : le rattachement dit « ${snap.steps.map(step => step.key).join(' › ')} » (« Pôle › Direction › Service › ${t('an.fiche.post')} » attendu)`);
  if (snap.steps.some(step => !step.value)) note('fiche', `${where} : un niveau du rattachement n'a pas de valeur`);
  if (snap.steps.at(-1) && snap.steps.at(-1).value !== snap.subtitle) note('fiche', `${where} : le poste du rattachement (« ${snap.steps.at(-1).value} ») n'est pas celui de l'en-tête (« ${snap.subtitle} »)`);
  snap.steps.forEach((step, i) => {
    if (!insideX(step.box, snap.box)) note('fiche', `${where} : l'étage « ${step.key} » sort de la fiche`);
    if (i && step.box.left <= snap.steps[i - 1].box.left) note('fiche', `${where} : l'étage « ${step.key} » n'est pas un cran plus bas que le précédent`);
    if (i && !step.sub) note('fiche', `${where} : l'étage « ${step.key} » n'a pas son trait`);
    if (i > 0 && step.box.top <= snap.steps[i - 1].box.top) note('fiche', `${where} : l'étage « ${step.key} » n'est pas sous le précédent`);
  });
  if (!snap.empties.includes('Assistant·e')) note('fiche', `${where} : une relation vide n'a pas sa ligne avec un tiret (${snap.empties.join(' | ') || 'aucune'})`);
  if (!snap.write) note('fiche', `${where} : « ${t('an.write')} » manque`);
  else {
    if (snap.write.href !== 'mailto:camille.durand@exemple.fr' || snap.write.target !== '_blank' || !snap.write.rel.includes('noopener')) note('fiche', `${where} : « ${t('an.write')} » est ${JSON.stringify(snap.write)}`);
    if (snap.write.box.height < 24) note('cible trop petite', `${where} : « ${t('an.write')} » mesure ${Math.round(snap.write.box.height)} px (24 au moins)`);
    if (!insideX(snap.write.box, snap.box)) note('fiche', `${where} : « ${t('an.write')} » sort de la fiche`);
  }
  await page.run(contrasts, PROBES).then(values => { for (const [what, value] of Object.entries(values)) if (value < 4.5) note('contraste', `${where} : « ${what} » trop pâle (${value.toFixed(2)})`); });
  await click('[data-fk="side-x"]');
  await delay(250);
  // Sans adresse (Yanis Morel, ligne 6) : pas de « Écrire » ; le reste de la fiche tient.
  const bare = await openFiche(page, note, click, 6, 'la fiche d\'une personne sans adresse');
  if (bare && bare.write) note('fiche', `la fiche d'une personne sans adresse : « ${t('an.write')} » est là alors qu'il n'y a pas d'adresse`);
  await click('[data-fk="side-x"]');
  await delay(250);
}
