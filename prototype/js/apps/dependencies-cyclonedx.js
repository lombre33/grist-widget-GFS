// L'inventaire CycloneDX 1.5 de la fenêtre « Dépendances » (demande du porteur, 18/11 : « clarté et audit de sécurité ») : la nomenclature logicielle (SBOM) de
// ce que GFS sert, au format que lisent les outils d'audit (Dependency-Track, Grype, OSV-Scanner…). Un composant par bibliothèque (le paquet npm, sa version,
// son identifiant `purl`), sa licence, son empreinte quand elle est celle d'un fichier de la copie, ses adresses (site, dépôt, CDN), et les avis du relevé daté
// comme des vulnérabilités. Du code sans effet de bord : il lit les lignes de js/apps/dependencies-model.js, il n'appelle rien ; la date et le numéro de série
// sont donnés, pour que deux rapports d'un même relevé se comparent.

const SEVERITY = { critical: 'critical', high: 'high', moderate: 'medium', low: 'low' };
const SOURCE = { vendorise: 'frozen-copy', cdn: 'cdn' };

// L'identifiant d'un paquet npm (https://github.com/package-url/purl-spec) : l'arobase d'une portée s'écrit « %40 ».
export const purlOf = (name, version) => `pkg:npm/${name.startsWith('@') ? `%40${name.slice(1)}` : name}@${version}`;

// L'empreinte d'un fichier : CycloneDX la veut en hexadécimal (96 chiffres pour SHA-384), le catalogue la garde en base 64 (« sha384-… »).
export function hexOf(integrity) {
  try {
    const hex = [...atob(String(integrity).replace(/^sha384-/, ''))].map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    return /^[0-9a-f]{96}$/.test(hex) ? hex : null;
  } catch (error) { return null; }
}

// La licence : un identifiant SPDX seul, ou une expression (« (MIT OR GPL-3.0-or-later) »). Tel que le registre le donne.
const licenceOf = spdx => (!spdx ? [] : [/[\s()]/.test(spdx) ? { expression: spdx } : { license: { id: spdx } }]);

// La source retenue d'une ligne : celle de toutes ses fonctions, `mixed` quand elles diffèrent, `none` quand aucune app ne l'utilise.
function sourceOfRow(row) {
  const modes = new Set(row.uses.filter(use => use.unit).map(use => use.unit.mode));
  return modes.size === 0 ? 'none' : (modes.size > 1 ? 'mixed' : SOURCE[[...modes][0]]);
}

// Les adresses : le site, le dépôt, et chaque CDN avec son empreinte (les adresses que le navigateur contacte en mode CDN).
function referencesOf(row) {
  const refs = [];
  if (row.site) refs.push({ type: 'website', url: row.site });
  if (row.depot) refs.push({ type: 'vcs', url: row.depot });
  for (const file of row.files) {
    const hash = file.cdn && hexOf(file.cdn.integrite);
    if (file.cdn) refs.push({ type: 'distribution', url: file.cdn.src, comment: `CDN address of ${file.id}`,
      ...(hash ? { hashes: [{ alg: 'SHA-384', content: hash }] } : {}) });
  }
  return refs;
}

// Les empreintes : sur le composant quand un seul fichier le porte seul (un script classique) ; sinon, dans ses propriétés, fichier par fichier (un fichier
// assemblé porte plusieurs paquets : son empreinte n'est pas celle de l'un d'eux).
function hashesOf(row) {
  const [only] = row.files;
  const hash = row.files.length === 1 && only.forme !== 'module' ? hexOf(only.copie.integrite) : null;
  return hash ? { hashes: [{ alg: 'SHA-384', content: hash }] } : {};
}

function componentOf(row) {
  const ref = purlOf(row.paquet, row.version);
  const [group, name] = row.paquet.startsWith('@') ? row.paquet.split('/') : [null, row.paquet];
  const properties = [{ name: 'gfs:state', value: row.state }, { name: 'gfs:source', value: sourceOfRow(row) },
    ...(row.latest ? [{ name: 'gfs:latest-stable', value: row.latest }] : []),
    ...row.apps.map(app => ({ name: 'gfs:used-by', value: app })),
    ...row.files.map(file => ({ name: `gfs:copy:${file.id}`, value: `${file.copie.chemin} ${file.copie.integrite}` }))];
  return { type: 'library', 'bom-ref': ref, ...(group ? { group } : {}), name: group ? name : row.paquet, version: row.version, purl: ref,
    scope: row.state === 'active' ? 'required' : 'optional', licenses: licenceOf(row.licence), ...hashesOf(row), externalReferences: referencesOf(row),
      properties };
}

// Les avis du relevé comme des vulnérabilités, un enregistrement par avis : les lignes qui le portent sont dans `affects`.
function vulnerabilitiesOf(rows) {
  const found = new Map();
  for (const row of rows) {
    for (const advisory of row.advisories) {
      const ref = purlOf(row.paquet, row.version);
      const known = found.get(advisory.id);
      if (known) { known.affects.push({ ref }); continue; }
      found.set(advisory.id, { id: advisory.id, source: { name: 'GitHub Advisory Database', url: advisory.url }, description: advisory.titre,
        ratings: [{ source: { name: 'GitHub Advisory Database' }, severity: SEVERITY[advisory.niveau] || 'unknown',
          ...(typeof advisory.cvss === 'number' ? { score: advisory.cvss } : {}) }],
        recommendation: advisory.corrigeEn ? `Upgrade to ${advisory.corrigeEn} or later.` : 'No fixed version is indicated.',
        advisories: [{ url: advisory.url }], affects: [{ ref }] });
    }
  }
  return [...found.values()];
}

// `generated` : la date de l'export, en ISO ; `serial` : un UUID ; `surveyed` : la date du relevé (ISO), ou null.
export function cyclonedx({ rows, surveyed, generated, serial }) {
  const components = rows.map(componentOf);
  return { bomFormat: 'CycloneDX', specVersion: '1.5', serialNumber: `urn:uuid:${serial}`, version: 1,
    metadata: { timestamp: generated, tools: { components: [{ type: 'application', name: 'GFS « Dépendances »',
      description: 'Grist Factory Suite, fenêtre Dépendances' }] },
      component: { type: 'application', 'bom-ref': 'gfs', name: 'Grist Factory Suite (GFS)', licenses: [{ license: { id: 'GPL-3.0-only' } }] },
      properties: [{ name: 'gfs:survey-date', value: surveyed || 'unavailable' }, { name: 'gfs:survey-source', value: 'registry.npmjs.org' }] },
    components, dependencies: [{ ref: 'gfs', dependsOn: components.map(component => component['bom-ref']) }], vulnerabilities: vulnerabilitiesOf(rows) };
}
