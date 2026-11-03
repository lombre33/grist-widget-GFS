// La FORME de chaque ambiance (décision du porteur, 03/11) : arrondis, traits, ombres, polices, fond, filet, avatar, bouton plein, dits par des jetons de forme. Ce sont des DONNÉES, comme les
// couleurs : GFS les pose sur <html> par le CSSOM (js/theme-apply.js) et les envoie aux apps (contrats 5.2, point 10), qui les lisent ou non. Leurs valeurs par défaut sont celles de css/gfs.css :
// sans ambiance, rien ne s'écrit et rien ne change. Chaque valeur est écrite EN TERMES des jetons de couleur (`var(--accent)`, `color-mix`) : une ambiance n'a donc qu'une forme, pour le clair
// comme pour le sombre. Une app qui ne lit pas un jeton garde sa forme et prend les couleurs : rien ne casse.

const SERIF = "ui-serif, 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, 'Liberation Mono', monospace";
const mix = (color, percent, base = 'transparent') => `color-mix(in srgb, ${color} ${percent}%, ${base})`;

export const FORME = Object.freeze({
  // Pop : un fond lavande, des cartes blanches très arrondies qui flottent, un violet franc, un filet multicolore, des pastilles pleines, des avatars et un bouton en dégradé.
  pop: Object.freeze({
    '--radius-xs': '7px', '--radius-sm': '10px', '--radius-md': '14px', '--radius-lg': '18px', '--radius-pill': '999px', '--radius-btn': '999px', '--radius-input': '13px', '--radius-panel': '16px',
    '--gap': '8px', '--divider-w': '0px', '--ex-bg': 'var(--bg)', '--main-overflow': 'hidden',
    '--wash': `radial-gradient(420px 220px at 6% -4%, ${mix('var(--accent-2)', 24)}, transparent 72%), radial-gradient(460px 240px at 100% 0%, ${mix('var(--accent-solid)', 22)}, transparent 70%)`,
    '--shadow-panel': `0 1px 2px ${mix('var(--accent)', 10)}, 0 10px 24px -12px ${mix('var(--accent)', 45)}`,
    '--shadow-ctl': `0 1px 2px ${mix('var(--accent)', 14)}`,
    '--shadow-float': `0 24px 50px -14px ${mix('var(--accent)', 60)}, 0 2px 10px rgba(30, 20, 80, .22)`,
    '--stripe': 'linear-gradient(90deg, var(--accent-solid), var(--accent-2), var(--accent-3))', '--stripe-h': '3px',
    '--font-ui': "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    '--fw-head': '800', '--fs-head': '19px', '--ls-head': '-.01em',
    '--avatar-bg': 'linear-gradient(135deg, var(--accent-solid), var(--accent-end))', '--avatar-fg': 'var(--on-accent)', '--avatar-line': 'transparent',
    '--fill': 'linear-gradient(135deg, var(--accent-solid), var(--accent-end))', '--fill-hover': 'linear-gradient(135deg, var(--accent-solid-hover), var(--accent-end))', '--fill-line': 'transparent',
  }),
  // Papier : du papier crème, de l'encre, un bordeaux, des traits fins d'imprimerie, des titres à empattements, des coins presque droits, une ombre dure et légère sous les fenêtres.
  papier: Object.freeze({
    '--radius-xs': '1px', '--radius-sm': '2px', '--radius-md': '2px', '--radius-lg': '3px', '--radius-pill': '2px', '--radius-btn': '2px', '--radius-input': '2px',
    '--shadow-float': `5px 5px 0 ${mix('var(--text)', 16)}`,
    '--font-head': SERIF, '--fw-head': '700', '--fs-head': '19px', '--ls-head': '0', '--font-label': SERIF, '--ls-label': '.1em',
    '--avatar-bg': 'var(--text)', '--avatar-fg': 'var(--surface)', '--avatar-line': 'var(--text)',
  }),
  // Brut : du jaune, du noir, des traits épais, des ombres dures, des coins carrés, des titres en capitales lourdes, des étiquettes à chasse fixe.
  brut: Object.freeze({
    '--radius-xs': '0px', '--radius-sm': '0px', '--radius-md': '0px', '--radius-lg': '0px', '--radius-pill': '0px', '--radius-btn': '0px', '--radius-input': '0px',
    '--bw': '2px', '--divider-w': '2px', '--bar-w': '6px',
    '--shadow-ctl': '2px 2px 0 var(--hard)', '--shadow-float': '7px 7px 0 var(--hard)',
    '--font-head': "'Arial Black', 'Helvetica Neue', Arial, system-ui, sans-serif", '--fw-head': '900', '--fs-head': '17px', '--tt-head': 'uppercase', '--ls-head': '.02em',
    '--font-label': MONO, '--ls-label': '.02em',
    '--avatar-bg': 'var(--accent-solid)', '--avatar-fg': 'var(--on-accent)', '--avatar-line': 'var(--border-strong)',
  }),
  // Néon : un fond nuit où la liste se pose sur une trame de points, des traits qui brillent, un filet lumineux, des titres à chasse fixe.
  neon: Object.freeze({
    '--radius-xs': '3px', '--radius-sm': '5px', '--radius-md': '7px', '--radius-lg': '9px', '--radius-pill': '4px', '--radius-btn': '5px', '--radius-input': '5px',
    '--divider': mix('var(--accent)', 38, 'var(--border)'), '--ex-bg': 'var(--bg)', '--main-bg': 'transparent',
    '--wash': `radial-gradient(circle at 1px 1px, ${mix('var(--accent)', 22)} 1px, transparent 0)`, '--wash-size': '15px 15px',
    '--shadow-ctl': `0 0 0 1px ${mix('var(--accent)', 26)}, 0 0 12px -3px ${mix('var(--accent)', 45)}`,
    '--shadow-float': `0 0 0 1px ${mix('var(--accent)', 60)}, 0 22px 50px -14px ${mix('var(--accent)', 55)}, 0 0 34px -6px ${mix('var(--accent-2)', 40)}`,
    '--stripe': 'linear-gradient(90deg, var(--accent), var(--accent-2))', '--stripe-h': '2px',
    '--font-head': MONO, '--fw-head': '700', '--fs-head': '14px', '--tt-head': 'uppercase', '--ls-head': '.09em', '--font-label': MONO, '--ls-label': '.06em',
    '--avatar-bg': 'transparent', '--avatar-fg': 'var(--accent-ink)', '--avatar-line': 'var(--accent)',
  }),
});

// Tous les jetons de forme qu'une ambiance peut poser : de quoi les retirer d'un coup quand on change d'ambiance (ou qu'on revient à l'origine).
export const FORME_TOKENS = Object.freeze([...new Set(Object.values(FORME).flatMap(forme => Object.keys(forme)))].sort());
