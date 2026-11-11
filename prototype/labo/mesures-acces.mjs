// Les mesures de l'accessibilité renforcée, second temps (css/acces.css ; décision du porteur du 04/11, feu vert du 10/11), que se partagent le Firefox sans écran (test/acces-firefox.mjs : le texte, les cibles, la barre,
// le mouvement) et le vrai Grist sous Chromium (labo/run-acces.mjs : l'anneau de focus, que le Firefox sans écran ne peut pas montrer, faute de focus du système). Chaque fonction `sweep`, `focusStop`, `barOf`
// et `motionOf` s'exécute DANS la page (rien du module n'y est visible : elle se passe à `page.run` ou à `page.evaluate`) ; `ringFaults` juge ce que `focusStop` a vu.

export const MIN_TEXT = 14;
export const MIN_TARGET = 36;
export const RING_WIDTH = 3;
export const BAR_WIDTH = 6;

// Ce que la page montre sous les seuils : { texts, targets }, une ligne par élément (chemin et mesure), sans le dessin des vignettes d'ambiance (`.amb-mini` : un dessin, pas du texte à lire) ni les icônes.
export function sweep(minText, minTarget) {
  const path = element => {
    const parts = [];
    for (let node = element; node && node.nodeType === 1 && parts.length < 3; node = node.parentElement) {
      parts.unshift(node.tagName.toLowerCase() + (typeof node.className === 'string' && node.className.trim() ? `.${node.className.trim().split(/\s+/).join('.')}` : ''));
    }
    return parts.join(' > ');
  };
  const skipped = '.amb-mini, .sprite, .sr-only, svg, script, style';
  const shown = element => {
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement;
    if (!node.nodeValue.trim() || !element || element.closest(skipped) || !shown(element)) continue;
    const size = parseFloat(getComputedStyle(element).fontSize);
    if (size < minText - 0.01) texts.push(`${size} px, ${path(element)}`);
  }
  const targets = [];
  const commands = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=switch], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=option], [role=tab], .ls-row, .th, .tr-row';
  for (const element of document.querySelectorAll(commands)) {
    if (element.closest(skipped) || !shown(element)) continue;
    let box = element.getBoundingClientRect();
    if (element.matches('input[type=checkbox], input[type=radio]')) {
      // Une case se coche par son texte : le `label` qui l'entoure, ou celui qui la désigne (`for`), est sa cible quand il fait la taille voulue.
      const label = [...(element.labels || []), element.closest('label')].find(one => one && one.getBoundingClientRect().height >= minTarget - 0.01);
      if (label) box = label.getBoundingClientRect();
    }
    if (box.width < minTarget - 0.01 || box.height < minTarget - 0.01) targets.push(`${Math.round(box.width * 10) / 10} × ${Math.round(box.height * 10) / 10} px, ${path(element)}`);
  }
  const once = list => [...new Set(list)].map(line => `${line}${list.filter(other => other === line).length > 1 ? ` (× ${list.filter(other => other === line).length})` : ''}`);
  return { texts: once(texts), targets: once(targets) };
}

// L'élément qui a le clavier et son anneau : la largeur et le style du contour, ses deux couleurs (le contour, l'ombre), la décalage, et chaque zone qui défile ou rogne autour de lui et de combien elle coupe l'anneau.
// Une case ou une pastille cachée (`opacity: 0`, étendue sur sa ligne : `.amb`, `.th-acc`) porte l'anneau sur sa ligne.
export function focusStop() {
  const active = document.activeElement;
  if (!active || active === document.body) return null;
  const holder = getComputedStyle(active).opacity === '0' && active.closest('label') ? active.closest('label') : active;
  const style = getComputedStyle(holder);
  const colors = text => (text.match(/rgba?\([^)]*\)/g) || []);
  const luminance = color => {
    const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(value => { const channel = Number(value) / 255; return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + 0.05) / (low + 0.05); };
  const outline = style.outlineColor;
  const shadow = colors(style.boxShadow)[0] || null;
  const width = parseFloat(style.outlineWidth);
  const offset = parseFloat(style.outlineOffset);
  const reach = offset >= 0 ? offset + width : 0; // ce que l'anneau prend hors de la commande ; un anneau dedans (décalage négatif) ne sort de rien
  const box = holder.getBoundingClientRect();
  const clipped = [];
  for (let node = holder.parentElement; node && node !== document.documentElement; node = node.parentElement) {
    const over = getComputedStyle(node);
    if (!/auto|scroll|hidden|clip/.test(`${over.overflowX} ${over.overflowY}`)) continue;
    const zone = node.getBoundingClientRect();
    const cut = Math.max(zone.left - (box.left - reach), (box.right + reach) - zone.right, zone.top - (box.top - reach), (box.bottom + reach) - zone.bottom);
    if (cut > 0.5) clipped.push(`${node.tagName.toLowerCase()}${typeof node.className === 'string' && node.className.trim() ? `.${node.className.trim().split(/\s+/).join('.')}` : ''} de ${Math.round(cut * 10) / 10} px`);
  }
  const name = (typeof holder.className === 'string' && holder.className.trim() ? `${holder.tagName.toLowerCase()}.${holder.className.trim().split(/\s+/).join('.')}` : holder.tagName.toLowerCase());
  const label = (holder.getAttribute('aria-label') || holder.textContent || '').trim().slice(0, 24);
  return {
    name: `${name}${label ? ` « ${label} »` : ''}`, key: `${name}|${[...document.querySelectorAll(holder.tagName)].indexOf(holder)}`, outlineStyle: style.outlineStyle, width, offset, shadow, outline,
    spread: shadow ? Number((style.boxShadow.match(/(?:^|\s)(\d+)px(?:\s+inset)?$/) || [0, 0])[1]) : 0, inset: /inset/.test(style.boxShadow), between: shadow ? ratio(outline, shadow) : 0, clipped,
  };
}

// La barre de la ligne choisie (ou du volet) et la ligne qui ne l'est pas : largeur et couleur de la bordure de gauche, ombre, bordure de l'en-tête de la liste.
export function barOf() {
  const describe = element => {
    if (!element) return null;
    const style = getComputedStyle(element);
    return { width: parseFloat(style.borderLeftWidth), color: style.borderLeftColor, shadow: style.boxShadow, left: element.getBoundingClientRect().left };
  };
  const rows = [...document.querySelectorAll('.ls-row')];
  return {
    chosen: describe(document.querySelector('.ls-row[aria-selected="true"]')), plain: describe(rows.find(row => row.getAttribute('aria-selected') !== 'true')),
    head: describe(document.querySelector('.ls-head')), tree: describe(document.querySelector('.tr-row[aria-current="true"]')), treePlain: describe([...document.querySelectorAll('.tr-row')].find(row => row.getAttribute('aria-current') !== 'true')),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  };
}

// Le mouvement de la page : combien d'éléments ont une transition ou une animation qui dure.
export function motionOf() {
  const seconds = text => text.split(',').map(part => parseFloat(part) || 0);
  let moving = 0;
  const examples = [];
  for (const element of document.querySelectorAll('body *')) {
    const style = getComputedStyle(element);
    const lasting = Math.max(...seconds(style.transitionDuration), ...seconds(style.animationDuration)) > 0 && (style.transitionProperty !== 'none' || style.animationName !== 'none');
    if (lasting) { moving += 1; if (examples.length < 3) examples.push(`${element.tagName.toLowerCase()}.${String(element.getAttribute('class') || '').trim().split(/\s+/).join('.')}`); }
  }
  return { moving, examples, smooth: getComputedStyle(document.documentElement).scrollBehavior };
}

// L'anneau d'une commande qui a le clavier : 3 px pleins, deux couleurs à 3:1 l'une de l'autre (le contour, et l'ombre entre lui et la commande), jamais coupé. Rend la liste des écarts, en phrases.
export function ringFaults(stop) {
  const faults = [];
  if (stop.outlineStyle !== 'solid' || Math.abs(stop.width - RING_WIDTH) > 0.01) faults.push({ kind: `épais de ${RING_WIDTH} px`, text: `« ${stop.name} » a un contour ${stop.outlineStyle} de ${stop.width} px` });
  if (!stop.shadow || (stop.spread < 2 && !stop.inset) || stop.between < 3) {
    faults.push({ kind: 'à deux couleurs', text: `« ${stop.name} » n'a pas deux couleurs à 3:1 l'une de l'autre (contour ${stop.outline}, ombre ${stop.shadow} sur ${stop.spread} px, rapport ${stop.between.toFixed(1)})` });
  }
  for (const zone of stop.clipped) faults.push({ kind: 'coupé', text: `« ${stop.name} » : l'anneau est coupé par ${zone}` });
  return faults;
}

// La ligne choisie, le bouton enfoncé et la vignette choisie, dans le contraste forcé (un réglage du système, pas de GFS : la page est à l'origine, ou en accessibilité renforcée).
export function forcedLook() {
  const color = element => (element ? getComputedStyle(element).borderLeftColor : null);
  const width = element => (element ? parseFloat(getComputedStyle(element).borderLeftWidth) : null);
  const rows = [...document.querySelectorAll('.ls-row')];
  const chosen = document.querySelector('.ls-row[aria-selected="true"]');
  const plain = rows.find(row => row !== chosen);
  const tile = document.querySelector('.th[aria-selected="true"]');
  const tilePlain = [...document.querySelectorAll('.th')].find(other => other !== tile);
  const on = document.querySelector('.tb-group .tb.on');
  const off = document.querySelector('.tb-group .tb:not(.on)');
  return {
    forced: matchMedia('(forced-colors: active)').matches, row: chosen ? { width: width(chosen), color: color(chosen), plainWidth: width(plain), plainColor: color(plain), shadow: getComputedStyle(chosen).boxShadow } : null,
    tile: tile ? { width: width(tile), plainWidth: width(tilePlain) } : null,
    bar: on ? { on: parseFloat(getComputedStyle(on).borderTopWidth), off: off ? parseFloat(getComputedStyle(off).borderTopWidth) : 0 } : null,
  };
}

// La fenêtre « Thème » dans le contraste forcé : la vignette cochée a une bordure plus épaisse que les autres, et l'interrupteur dessine son état (la poignée change de côté, et de couleur avec l'état).
export function forcedTheme() {
  const checked = document.querySelector('.amb:has(input:checked)');
  const other = document.querySelector('.amb:not(:has(input:checked))');
  const handle = element => { const style = getComputedStyle(element, '::after'); return { left: parseFloat(style.left), background: style.backgroundColor }; };
  const sw = document.querySelector('.th-acc-sw');
  const swStyle = getComputedStyle(sw);
  return { checked: parseFloat(getComputedStyle(checked).borderLeftWidth), other: parseFloat(getComputedStyle(other).borderLeftWidth), handle: handle(sw), border: swStyle.borderLeftColor, background: swStyle.backgroundColor };
}
