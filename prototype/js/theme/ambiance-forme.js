// La FORME de chaque ambiance (décision du porteur, 03/11) : arrondis, traits, ombres, polices, fond, filet, avatar, bouton plein, dits par des jetons de
// forme. Ce sont des DONNÉES, comme les
// couleurs : GFS les pose sur <html> par le CSSOM (js/theme/theme-apply.js) et les envoie aux apps (contrats 5.2, point 10), qui les lisent ou non. Leurs
//   valeurs par
//   défaut sont celles de css/gfs.css : sans ambiance, rien ne s'écrit et rien ne change. Chaque valeur est écrite EN TERMES des jetons de couleur
//   (`var(--accent)`, `color-mix`) : une ambiance n'a donc qu'une forme, pour le clair comme pour le sombre. Une app qui ne lit pas un jeton garde sa forme et
//   prend les couleurs : rien ne casse.

const SERIF = "ui-serif, 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, 'Liberation Mono', monospace";
const mix = (color, percent, base = 'transparent') => `color-mix(in srgb, ${color} ${percent}%, ${base})`;

export const FORME = Object.freeze({
  // Pop : un fond lavande, des cartes blanches très arrondies qui flottent, un violet franc, un filet multicolore, des pastilles pleines, des avatars et un
  //   bouton en dégradé.
  pop: Object.freeze({
    '--radius-xs': '7px', '--radius-sm': '10px', '--radius-md': '14px', '--radius-lg': '18px', '--radius-pill': '999px', '--radius-btn': '999px',
      '--radius-input': '13px', '--radius-panel': '16px',
    '--gap': '8px', '--divider-w': '0px', '--ex-bg': 'var(--bg)', '--main-overflow': 'hidden',
    '--wash': `radial-gradient(420px 220px at 6% -4%, ${mix('var(--accent-2)', 24)}, transparent 72%), radial-gradient(460px 240px at 100% 0%, ${mix('var(--accent-solid)', 22)}, transparent 70%)`,
    '--shadow-panel': `0 1px 2px ${mix('var(--accent)', 10)}, 0 10px 24px -12px ${mix('var(--accent)', 45)}`,
    '--shadow-ctl': `0 1px 2px ${mix('var(--accent)', 14)}`,
    '--shadow-float': `0 24px 50px -14px ${mix('var(--accent)', 60)}, 0 2px 10px rgba(30, 20, 80, .22)`,
    '--stripe': 'linear-gradient(90deg, var(--accent-solid), var(--accent-2), var(--accent-3))', '--stripe-h': '3px',
    '--font-ui': "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    '--fw-head': '800', '--fs-head': '19px', '--ls-head': '-.01em',
    '--avatar-bg': 'linear-gradient(135deg, var(--accent-solid), var(--accent-end))', '--avatar-fg': 'var(--on-accent)', '--avatar-line': 'transparent',
    '--fill': 'linear-gradient(135deg, var(--accent-solid), var(--accent-end))',
      '--fill-hover': 'linear-gradient(135deg, var(--accent-solid-hover), var(--accent-end))', '--fill-line': 'transparent',
  }),
  // Papier : du papier crème, de l'encre, un bordeaux, des traits fins d'imprimerie, des titres à empattements, des coins presque droits, une ombre dure et
  //   légère sous les fenêtres.
  papier: Object.freeze({
    '--radius-xs': '1px', '--radius-sm': '2px', '--radius-md': '2px', '--radius-lg': '3px', '--radius-pill': '2px', '--radius-btn': '2px',
      '--radius-input': '2px',
    '--shadow-float': `5px 5px 0 ${mix('var(--text)', 16)}`,
    '--font-head': SERIF, '--fw-head': '700', '--fs-head': '19px', '--ls-head': '0', '--font-label': SERIF, '--ls-label': '.1em',
    '--avatar-bg': 'var(--text)', '--avatar-fg': 'var(--surface)', '--avatar-line': 'var(--text)',
  }),
  // Brut : du jaune, du noir, des traits épais, des ombres dures, des coins carrés, des titres en capitales lourdes, des étiquettes à chasse fixe.
  brut: Object.freeze({
    '--radius-xs': '0px', '--radius-sm': '0px', '--radius-md': '0px', '--radius-lg': '0px', '--radius-pill': '0px', '--radius-btn': '0px',
      '--radius-input': '0px',
    '--bw': '2px', '--divider-w': '2px', '--bar-w': '6px',
    '--shadow-ctl': '2px 2px 0 var(--hard)', '--shadow-float': '7px 7px 0 var(--hard)',
    '--font-head': "'Arial Black', 'Helvetica Neue', Arial, system-ui, sans-serif", '--fw-head': '900', '--fs-head': '17px', '--tt-head': 'uppercase',
      '--ls-head': '.02em',
    '--font-label': MONO, '--ls-label': '.02em',
    '--avatar-bg': 'var(--accent-solid)', '--avatar-fg': 'var(--on-accent)', '--avatar-line': 'var(--border-strong)',
  }),
  // Enseigne (04/11, à la place de Néon) : une enseigne lumineuse. Du noir chaud, des tubes roses qui brillent autour des cadres (la lueur vient de `--hard` :
  // l'accent en sombre, rien en clair, où l'enseigne est « de jour »), des titres en capitales très espacées, un filet rose, ambre et cyan, des pastilles et
  // des avatars évidés, un bouton en dégradé. La lueur du titre est une règle de css/explorer.css.
  enseigne: Object.freeze({
    '--radius-xs': '5px', '--radius-sm': '8px', '--radius-md': '10px', '--radius-lg': '14px', '--radius-pill': '999px', '--radius-btn': '10px',
      '--radius-input': '10px', '--radius-panel': '12px',
    '--bw': '1.5px', '--gap': '8px', '--divider-w': '0px', '--bar-w': '3px',
    '--ex-bg': 'var(--bg)', '--main-bg': mix('var(--surface)', 90),
    '--wash': `radial-gradient(520px 260px at 100% -8%, ${mix('var(--hard)', 16)}, transparent 72%), radial-gradient(560px 300px at 0% 112%, ${mix('var(--hard)', 22)}, transparent 72%)`,
    '--shadow-ctl': `0 0 0 1px ${mix('var(--accent)', 45)}, 0 0 10px -2px ${mix('var(--hard)', 55)}`,
    '--shadow-panel': `0 0 0 1.5px ${mix('var(--accent)', 55, 'var(--border)')}, 0 0 20px -6px ${mix('var(--hard)', 55)}`,
    '--shadow-float': `0 0 0 1.5px var(--accent), 0 0 34px -4px ${mix('var(--hard)', 60)}, 0 0 70px -10px ${mix('var(--accent-2)', 40)}, 0 18px 40px -12px rgba(0, 0, 0, .35)`,
    '--stripe': 'linear-gradient(90deg, var(--accent), var(--accent-3), var(--accent-2))', '--stripe-h': '2px',
    '--fw-head': '700', '--fs-head': '15px', '--tt-head': 'uppercase', '--ls-head': '.18em', '--ls-label': '.1em',
    '--avatar-bg': 'transparent', '--avatar-fg': 'var(--accent-ink)', '--avatar-line': 'var(--accent)',
    '--fill': 'linear-gradient(135deg, var(--accent-solid), var(--accent-end))',
      '--fill-hover': 'linear-gradient(135deg, var(--accent-solid-hover), var(--accent-end))', '--fill-line': 'transparent',
  }),
  // L'accessibilité renforcée (04/11) : la forme que prend la page quand la personne l'allume, quelle que soit l'ambiance (la couleur, elle, reste celle de
  // l'ambiance). Des traits de 2 px, une barre de 6 px pour la ligne choisie, aucun décor derrière le texte (pas de trame, de filet, de dégradé, d'ombre ni de
  // halo), un bouton plein uni, des titres sans capitales ni lettres espacées.
  renforcee: Object.freeze({
    '--radius-xs': '3px', '--radius-sm': '5px', '--radius-md': '6px', '--radius-lg': '8px', '--radius-pill': '6px', '--radius-btn': '5px',
      '--radius-input': '5px', '--radius-panel': '0px',
    '--bw': '2px', '--divider-w': '2px', '--divider': 'var(--border-strong)', '--bar-w': '6px', '--gap': '0px',
    '--ex-bg': 'var(--surface)', '--main-bg': 'var(--surface)', '--wash': 'none', '--wash-size': 'auto', '--stripe': 'none', '--stripe-h': '0px',
    '--shadow-ctl': 'none', '--shadow-panel': 'none', '--shadow-float': 'none',
    '--fw-head': '700', '--fs-head': '16px', '--tt-head': 'none', '--ls-head': 'normal', '--ls-label': 'normal',
    '--avatar-bg': 'var(--surface-sunken)', '--avatar-fg': 'var(--text)', '--avatar-line': 'var(--border-strong)',
    '--fill': 'var(--accent-solid)', '--fill-hover': 'var(--accent-solid-hover)', '--fill-line': 'var(--border-strong)',
  }),
});

// Tous les jetons de forme qu'une ambiance peut poser : de quoi les retirer d'un coup quand on change d'ambiance (ou qu'on revient à l'origine).
export const FORME_TOKENS = Object.freeze([...new Set(Object.values(FORME).flatMap(forme => Object.keys(forme)))].sort());
