// Les vérifications du guide (module Guide, demande du porteur du 27/11, maquette « À vérifier ») : ce qui se périme en silence. Une démarche sans personne à
// contacter, un contact introuvable (poste vacant, service sans responsable, fiche supprimée ou masquée par « Ma présence »), une démarche pas relue depuis
// longtemps, un brouillon, une boucle dans les mères. Du code sans effet de bord, essayé sous Node : la vue (js/guide/guide-plan.js) le montre, et le seul
// geste d'écriture, « Marquer vérifiée », est à js/guide/guide-control.js.

// Les familles de points, de la plus grave à la moins grave (l'ordre d'affichage) : { code: rang }.
export const SEVERITY = Object.freeze({ loop: 0, lostPerson: 1, vacant: 1, noLead: 1, noContact: 2, stale: 3, draft: 4 });

// Le jour limite : « aaaa-mm-jj » de `today` moins `months` mois (UTC).
export function cutoffOf(today, months) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

// Les contacts perdus d'une démarche, pour les rôles qu'elle dit elle-même (un contact perdu à la mère se dit à la mère, pas dans chaque fille) :
// [{ code, role, labels }].
function lostOf(answer) {
  return answer.filter(item => !item.empty && item.own && item.kind !== 'text').flatMap(item => {
    const lost = (item.viaFallback ? item.replaced : item.entries).filter(entry => !entry.found && !entry.plain);
    if (!lost.length) return [];
    return [{ code: item.kind === 'person' ? 'lostPerson' : item.kind === 'post' ? 'vacant' : 'noLead', role: item.role.label,
      labels: lost.map(entry => entry.label).filter(Boolean) }];
  });
}

// Les points d'une démarche : [{ code, role?, labels? }], dans l'ordre de gravité. « Sans contact » ne se dit qu'une fois, sur la démarche du haut (celles qui
// sont dessous le sont par héritage). `today` : « aaaa-mm-jj ».
function issuesOf(model, proc, { answerFor, config, today }) {
  const answer = answerFor(proc.row);
  const issues = [];
  if (model.index.loops.has(proc.row)) issues.push({ code: 'loop' });
  issues.push(...lostOf(answer));
  if (config.roles.length && answer.every(item => item.empty) && model.index.parentOf.get(proc.row) === null) issues.push({ code: 'noContact' });
  if (config.verified && config.reviewMonths > 0 && (!proc.verified || proc.verified < cutoffOf(today, config.reviewMonths))) {
    issues.push({ code: 'stale', since: proc.verified });
  }
  if (proc.draft) issues.push({ code: 'draft' });
  return issues.sort((a, b) => SEVERITY[a.code] - SEVERITY[b.code]);
}

// Le relevé : { items: [{ proc, issues }] (les démarches qui ont au moins un point, les plus graves d'abord, puis par titre), count (combien de démarches),
// total (combien de points) }. `model` : la lecture du guide (procs, index, config), `answerFor(row)` : js/guide/guide-contacts.js `answerOf`, `today` :
// « aaaa-mm-jj ».
export function checksOf(model, { answerFor, today }) {
  const config = model.config;
  const items = model.procs.map(proc => ({ proc, issues: issuesOf(model, proc, { answerFor, config, today }) })).filter(item => item.issues.length);
  items.sort((a, b) => SEVERITY[a.issues[0].code] - SEVERITY[b.issues[0].code] || a.proc.title.localeCompare(b.proc.title, 'fr'));
  return { items, count: items.length, total: items.reduce((sum, item) => sum + item.issues.length, 0) };
}

// La valeur à écrire dans la colonne « Vérifiée le » (`genre` : celui de la colonne) : des secondes depuis 1970 pour une colonne de date, « aaaa-mm-jj » pour
// un texte ; null quand GFS ne sait pas l'écrire.
export function verifiedValue(genre, today) {
  if (genre === 'date') return Math.floor(Date.parse(`${today}T00:00:00Z`) / 1000);
  return genre === 'text' || genre === 'choice' ? today : null;
}
