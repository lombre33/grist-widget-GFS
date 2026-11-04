// Les couleurs de type de chaque ambiance (décision du porteur, 04/11 : « adapter les icônes des types de fichier aussi au thème », et une icône colorée pour le PDF). Quatre familles, chacune en quatre jetons :
// l'icône (`--t-doc`), le texte de sa pastille (`-ink`), le fond doux de la pastille (`-soft`) et son trait (`-line`), en clair et en sombre. Les familles gardent leur teinte d'une ambiance à l'autre (document : bleu,
// grille : vert, présentation : orange, PDF : rouge carmin) : un type se reconnaît partout ; l'ambiance en règle la clarté, la vivacité et la nuance.
// Des DONNÉES, comme ORIGIN (js/ambiance.js) : GFS les pose avec l'ambiance (js/theme-apply.js), sur la page et sur chaque vignette de la fenêtre « Thème » ; elles ne vont pas aux apps, car les couleurs par type
// ne vivent que dans l'explorateur (cahier 6.5 ; contrats 5.2, point 10). La couleur libre de la personne ne les change pas : elle ne change que l'accent. L'ambiance d'origine dit ce que css/gfs.css dit.
// Le contraste (texte 4,5:1, icône 3:1, avec toute couleur libre) et l'accord avec css/gfs.css sont mesurés par test/ambiance.test.mjs ; les teintes et l'écart entre les types, par test/ambiance-types.test.mjs.

export const TYPES = Object.freeze(['doc', 'grid', 'slides', 'pdf']);
const PARTS = Object.freeze(['', '-ink', '-soft', '-line']);

// Tous les jetons de type : de quoi les retirer d'un coup quand on change d'ambiance (js/theme-apply.js).
export const TYPE_TOKENS = Object.freeze(TYPES.flatMap(type => PARTS.map(part => `--t-${type}${part}`)));

// [icône, texte, fond doux, trait] de chaque type, par ambiance et par mode (les clés `clair` et `sombre` sont celles du message aux apps).
const COLORS = Object.freeze({
  // L'origine : les trois couleurs d'avant (css/gfs.css, le bleu d'accent, un vert et un orange), et le rouge carmin du PDF dans le même esprit.
  defaut: {
    clair: {
      doc: ['#2f6fed', '#2558c4', '#e8f0fe', '#c7dbfd'],
      grid: ['#2e7d32', '#1f6a24', '#e7f4e8', '#bfe0c2'],
      slides: ['#c7600a', '#9a4a05', '#fff0e0', '#f6cc9d'],
      pdf: ['#d32c4d', '#af1a3c', '#ffebeb', '#f9cacb'],
    },
    sombre: {
      doc: ['#5b91f5', '#74a3f7', '#24324b', '#35507d'],
      grid: ['#6cc57a', '#8fd694', '#16301a', '#2c5a31'],
      slides: ['#f0933e', '#ffb06b', '#3a2412', '#6b4420'],
      pdf: ['#f37984', '#ff989f', '#422426', '#733e42'],
    },
  },
  // Pop : des bonbons, vifs et un peu lumineux, loin du violet de l'ambiance ; le rouge du PDF y vire au rose framboise.
  pop: {
    clair: {
      doc: ['#007ed1', '#0066ac', '#e7f1fc', '#c2dbf3'],
      grid: ['#009466', '#007852', '#e8f3ed', '#c4dfd1'],
      slides: ['#d95c00', '#b04900', '#fcede6', '#f3cfbe'],
      pdf: ['#dc3174', '#b8215e', '#ffeaef', '#f9c9d4'],
    },
    sombre: {
      doc: ['#2da6fa', '#69bcff', '#173044', '#255479'],
      grid: ['#3fd59b', '#6eeab4', '#163527', '#205d43'],
      slides: ['#ffa566', '#ffc6a1', '#3d281a', '#6c452b'],
      pdf: ['#ff789d', '#ffa2b7', '#43232a', '#753b4a'],
    },
  },
  // Papier : des encres, sourdes et chaudes ; le rouge du PDF est un vermillon d'imprimeur, plus clair et plus orangé que le bordeaux de l'ambiance.
  papier: {
    clair: {
      doc: ['#1d5b92', '#0b4574', '#e7eef5', '#c9daeb'],
      grid: ['#2f7346', '#1e5b34', '#e7efe9', '#cbddcf'],
      slides: ['#9e7112', '#825b00', '#f1ece4', '#e3d6c1'],
      pdf: ['#b63c2e', '#952a1f', '#f8e9e6', '#f3cec7'],
    },
    sombre: {
      doc: ['#7fafe2', '#99c5f4', '#242f3b', '#3d5268'],
      grid: ['#7fc492', '#9bd9ab', '#223226', '#3a5842'],
      slides: ['#d9ba70', '#edd18f', '#342d1c', '#5b4e2f'],
      pdf: ['#f68861', '#ffa789', '#40261d', '#714130'],
    },
  },
  // Brut : des primaires franches, à plat.
  brut: {
    clair: {
      doc: ['#1d4ce9', '#1136c0', '#e9f0ff', '#c5d8ff'],
      grid: ['#00893d', '#006e2f', '#e9f3ea', '#c5e0c9'],
      slides: ['#cc6300', '#a95100', '#faede6', '#efd0be'],
      pdf: ['#d40033', '#ac0027', '#ffebea', '#fdc9c7'],
    },
    sombre: {
      doc: ['#679cff', '#8bb4ff', '#212e45', '#384f7b'],
      grid: ['#45e77a', '#75fc99', '#14361d', '#1c5f30'],
      slides: ['#ffa658', '#ffc79a', '#3d2917', '#6c4625'],
      pdf: ['#ff7074', '#ff9a99', '#452222', '#793a3b'],
    },
  },
  // Enseigne (à la place de Néon, 04/11) : des tubes allumés ; en sombre ils brillent, en clair (l'enseigne de jour) ils s'approfondissent pour rester lisibles.
  enseigne: {
    clair: {
      doc: ['#005dca', '#0048a1', '#e8f1fe', '#c4d9f9'],
      grid: ['#007f38', '#00652b', '#e9f3eb', '#c6dfca'],
      slides: ['#b56100', '#944e00', '#f8eee6', '#ebd2c0'],
      pdf: ['#c60475', '#a0005d', '#ffeaf1', '#f9c8d9'],
    },
    sombre: {
      doc: ['#6dadff', '#96c4ff', '#202f42', '#365175'],
      grid: ['#81ef76', '#98fa8e', '#1c351a', '#2e5c2a'],
      slides: ['#ffb169', '#ffd1a9', '#3c2919', '#694829'],
      pdf: ['#ff74ac', '#ff9fc2', '#43222e', '#753950'],
    },
  },
});

// Les jetons de type d'une ambiance dans un mode ({ '--t-doc': '#2f6fed', … }), ou `{}` pour une ambiance ou un mode inconnu : les feuilles de style disent alors l'aspect d'origine. Un objet neuf à chaque appel.
export function typeTokens(id, mode) {
  const set = Object.hasOwn(COLORS, id) && Object.hasOwn(COLORS[id], mode) ? COLORS[id][mode] : null;
  const out = {};
  if (!set) return out;
  for (const type of TYPES) PARTS.forEach((part, i) => { out[`--t-${type}${part}`] = set[type][i]; });
  return out;
}
