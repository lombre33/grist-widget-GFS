// Les relations sous Firefox (règle du 03/11 ; module Annuaire, demande du porteur du 25/11 : assistant·e, référent·e, suppléant·e ; choix du porteur : une petite ligne sur la
// carte de l'organigramme), à la vraie souris, sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js). Suite de test/annuaire-firefox.mjs. À mesurer : dans la
// fiche, ce que la personne désigne et ce qui la désigne (le sens inverse), seulement quand la relation en a un ; un clic sur la personne liée ouvre sa fiche ; une personne au nom
// très long ne fait pas sortir la ligne de la fiche ; dans l'organigramme des responsables, la petite ligne « Assistant·e : … » sur les cartes qui la demandent, des cartes toutes
// de la même hauteur, la ligne dans la carte ; l'organigramme des structures n'en a pas. Le réglage de l'onglet « Relations » est à test/annuaire-setup-firefox.mjs.
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';

const PROBES = { ocLine: ['.an-oc-line', '.an-oc'], relLink: ['.an-fiche-card .an-link-b', '.an-side'] };

// ---------- ce qui s'exécute dans la page ----------

function ficheRows() {
  const card = document.querySelector('.an-side .an-fiche-card');
  if (!card) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  return { name: card.querySelector('h3').textContent.trim(), box: box(card),
    rows: [...card.querySelectorAll('.an-fr')].map(row => ({ label: row.querySelector('dt').textContent.trim(), box: box(row),
      people: [...row.querySelectorAll('.an-link-b')].map(button => ({ name: button.textContent.trim(), row: button.dataset.row, box: box(button) })) })) };
}

function orgCards() {
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  return [...document.querySelectorAll('.an-oc')].map(card => {
    const outer = box(card);
    return { title: card.querySelector('.an-oc-title').textContent.trim(), height: card.offsetHeight, // la hauteur avant le zoom de l'organigramme
      lines: [...card.querySelectorAll('.an-oc-line')].map(line => ({ text: line.textContent.trim(), title: line.title, inside: box(line).bottom <= outer.bottom + 0.5 && box(line).right <= outer.right + 0.5 })) };
  });
}

const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack;

// ---------- les mesures ----------

// Une fiche : les libellés et les personnes de chaque ligne de relation, chaque ligne et chaque bouton dans la fiche.
async function oneFiche(page, note, click, row, where, expected) {
  if (!await click(`[data-fk="pe:${row}"]`)) return null;
  const fiche = await page.run(ficheRows);
  if (!fiche) { note('fiche', `${where} : aucune fiche`); return null; }
  for (const [label, names] of expected) {
    const found = fiche.rows.find(each => each.label === label);
    if (!found) { note('relations', `${where} : pas de ligne « ${label} » (${fiche.rows.map(each => each.label).join(' | ')})`); continue; }
    if (found.people.map(each => each.name).join() !== names.join()) note('relations', `${where} : « ${label} » dit « ${found.people.map(each => each.name).join(', ')} » (« ${names.join(', ')} » attendu)`);
    if (!inside(found.box, fiche.box)) note('relations', `${where} : la ligne « ${label} » sort de la fiche`);
    for (const person of found.people) if (!inside(person.box, found.box)) note('relations', `${where} : « ${person.name} » sort de la ligne « ${label} »`);
  }
  return fiche;
}

// Les fiches : le sens direct, le sens inverse, un clic sur la personne liée, un nom très long, pas de ligne quand une relation n'a pas de sens inverse.
async function ficheProblems(page, t, note, click) {
  const manager = t('an.rel.manager');
  const team = t('an.rel.team');
  const nathan = await oneFiche(page, note, click, 3, 'la fiche de Nathan Roussel', [[manager, ['Emma Rolland']], [team, ['Camille Durand', 'Inès Marchand']], ['Assistant·e', ['Inès Marchand']]]);
  if (nathan) {
    await page.run(contrasts, PROBES).then(values => { for (const [what, value] of Object.entries(values)) if (value < 4.5) note('contraste', `la fiche d'une personne liée : « ${what} » trop pâle (${value.toFixed(2)})`); });
    if (nathan.rows.some(each => each.label === 'Référent·e de')) note('relations', 'la fiche de Nathan Roussel : une ligne « Référent·e de » alors que la relation n\'a pas de sens inverse');
  }
  await click('[data-fk="side-x"]');
  const ines = await oneFiche(page, note, click, 2, 'la fiche d\'Inès Marchand', [['Assistant·e de', ['Emma Rolland', 'Nathan Roussel']], ['Référent·e', ['Emma Rolland']]]);
  if (ines) {
    const linked = ines.rows.find(each => each.label === 'Référent·e');
    if (linked && linked.people[0] && await click('[data-fk="rel:Referents>:5"]')) {
      const after = await page.run(ficheRows);
      if (!after || after.name !== 'Emma Rolland') note('relations', `un clic sur « Emma Rolland » dans la fiche d'Inès ouvre « ${after ? after.name : 'rien'} »`);
    }
  }
  await click('[data-fk="side-x"]');
  await oneFiche(page, note, click, 4, 'la fiche de Louis Girard', [['Assistant·e', ['Jean-Baptiste de la Rochefoucauld-Montmorency']]]);
  await click('[data-fk="side-x"]');
}

// L'organigramme des responsables : la ligne sur la carte de qui a un assistant ou une assistante, rien sur les autres, la même hauteur partout.
async function orgProblems(page, note, click) {
  const where = 'l\'organigramme des responsables';
  await click('[data-fk="v:org"]');
  await delay(150);
  await click('[data-fk="om:managers"]');
  await delay(150);
  const cards = await page.run(orgCards);
  const line = name => (cards.find(card => card.title === name) || { lines: [] }).lines;
  if (!cards.length) { note('organigramme', `${where} : aucune carte`); return; }
  for (const name of ['Nathan Roussel', 'Emma Rolland']) {
    if (line(name).map(each => each.text).join() !== 'Assistant·e : Inès Marchand') note('relations', `${where} : la carte de « ${name} » dit « ${line(name).map(each => each.text).join(' | ')} » (« Assistant·e : Inès Marchand » attendu)`);
  }
  const long = line('Louis Girard')[0];
  if (!long || !long.text.includes('Jean-Baptiste') || long.title !== long.text) note('relations', `${where} : la ligne de « Louis Girard » (nom très long) ne garde pas son texte entier en info-bulle`);
  if (cards.some(card => card.title === 'Camille Durand' && card.lines.length)) note('relations', `${where} : « Camille Durand », sans assistant, a une ligne sur sa carte (les référents ne demandent pas de ligne)`);
  if (cards.some(card => card.lines.length > 2)) note('relations', `${where} : une carte a plus de deux lignes`);
  const heights = new Set(cards.map(card => Math.round(card.height)));
  if (heights.size !== 1) note('relations', `${where} : les cartes n'ont pas toutes la même hauteur (${[...heights].join(', ')} px)`);
  if ([...heights][0] < 80) note('relations', `${where} : les cartes mesurent ${[...heights][0]} px : la place de la petite ligne manque (81 px attendus)`);
  for (const card of cards) for (const each of card.lines) if (!each.inside) note('relations', `${where} : la ligne « ${each.text} » sort de la carte « ${card.title} »`);
  await page.run(contrasts, PROBES).then(values => { for (const [what, value] of Object.entries(values)) if (what === 'ocLine' && value < 4.5) note('contraste', `${where} : « ${what} » trop pâle (${value.toFixed(2)})`); });
  await click('[data-fk="om:structures"]');
  await delay(150);
  if ((await page.run(orgCards)).some(card => card.lines.length)) note('relations', 'l\'organigramme des structures montre des lignes de relation (elles sont à celui des responsables)');
  await click('[data-fk="v:list"]');
}

export async function relationsReadProblems(page, t, note, click) {
  await ficheProblems(page, t, note, click);
  await orgProblems(page, note, click);
}
