// L'empilement des couches : le dernier menu ou la dernière fenêtre ouverts passent au-dessus (charte). La base de chaque couche est un jeton
// `--z-*` ; le rang est recompté d'après les couches encore dans la page, donc il ne grandit jamais sans fin. `style.zIndex` est du CSSOM,
// que la politique `style-src 'self'` laisse passer (elle ne refuse que l'attribut `style` écrit dans le HTML).

export const Layers = {
  raise(el, token = '--z-menu') {
    const others = [...document.querySelectorAll(`[data-layer="${token}"]`)].filter(node => node !== el);
    const rank = others.reduce((max, node) => Math.max(max, Number(node.dataset.layerRank) || 0), 0) + 1;
    el.dataset.layer = token;
    el.dataset.layerRank = String(rank);
    el.style.zIndex = `calc(var(${token}) + ${rank})`;
    return el;
  },
};
