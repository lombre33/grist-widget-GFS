// Les icônes de l'apparence d'un dossier (js/files/folder-looks.js) : le dossier de base et, dessiné dans son corps, un repère (au trait, comme les autres
// icônes : une icône, une fonction). Le symbole `fl-<repère>` est le dossier avec son repère ; il se dessine comme le dossier (`icon('fl-star', 'fld')`) et
// prend la même couleur et le même remplissage. La goutte (`droplet`) est celle de l'article « Apparence… » du menu d'un dossier : la palette est déjà celle du
// « Thème ».

const FOLDER = 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z';

// Une étoile à cinq branches centrée en (cx, cy), de rayon extérieur `outer` et intérieur `inner`.
const star = (cx, cy, outer, inner) => `${Array.from({ length: 10 }, (item, k) => {
  const angle = (-90 + 36 * k) * Math.PI / 180;
  const radius = k % 2 ? inner : outer;
  return `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`;
}).map((point, k) => `${k ? 'L' : 'M'}${point}`).join('')}Z`;

// Le repère de chaque icône, dans le corps du dossier (x 3 à 21, y 7 à 19).
const MARKS = {
  star: `<path d="${star(12, 13.2, 4, 1.7)}"/>`,
  flag: '<path d="M9.8 17.2V9.8M9.8 10.2h5.4l-1.3 2 1.3 2H9.8"/>',
  heart: '<path d="M12 16.9c-3.1-1.8-4.3-3.2-4.3-4.7a2.2 2.2 0 0 1 4.3-.8 2.2 2.2 0 0 1 4.3.8c0 1.5-1.2 2.9-4.3 4.7z"/>',
  house: '<path d="M8 13.1 12 9.6l4 3.5M9.3 12.2v4.9h5.4v-4.9"/>',
  case: '<rect x="8" y="11" width="8" height="6" rx="1.1"/><path d="M10.4 11V9.9h3.2V11M8 13.9h8"/>',
  calendar: '<rect x="8" y="10.2" width="8" height="6.8" rx="1.1"/><path d="M8 12.6h8M10.3 9.3v1.8M13.7 9.3v1.8"/>',
  image: '<rect x="8" y="10.2" width="8" height="6.8" rx="1.1"/><circle cx="10.6" cy="12.4" r=".9"/><path d="M8.4 16.6l2.7-2.5 1.8 1.5 1.3-1.1 1.8 1.6"/>',
  book: '<path d="M12 17.1V10.9M12 10.9c-1.3-.9-2.8-1-4-.8v6.1c1.2-.2 2.7-.1 4 .9 1.3-1 2.8-1.1 4-.9v-6.1c-1.2-.2-2.7-.1-4 .8z"/>',
  box: '<rect x="8" y="10.2" width="8" height="2.3" rx=".7"/><path d="M8.8 12.5V17h6.4v-4.5M11 14.5h2"/>',
  euro: '<circle cx="12" cy="13.5" r="3.7"/><path d="M13.7 12.1a2 2 0 1 0 0 2.9M10.2 13h2.6M10.2 14h2.6"/>',
  tag: '<path d="M8 10h4.1l4.4 4.4-3.7 3.7L8.4 13.7z"/><circle cx="10.2" cy="12.1" r=".7"/>',
  bulb: '<path d="M10.3 14.1a2.6 2.6 0 1 1 3.4 0c-.6.5-.8.9-.8 1.5h-1.8c0-.6-.2-1-.8-1.5z"/><path d="M10.9 17.2h2.2"/>',
};

export const LOOK_ICONS = Object.freeze({
  ...Object.fromEntries(Object.entries(MARKS).map(([id, body]) => [`fl-${id}`, `<path d="${FOLDER}"/>${body}`])),
  droplet: '<path d="M12 3.4c3 3.6 5.6 6.3 5.6 9.4a5.6 5.6 0 0 1-11.2 0c0-3.1 2.6-5.8 5.6-9.4z"/><path d="M9.2 13.6a2.9 2.9 0 0 0 2.2 2.6"/>',
});
