// Construire du DOM sans jamais interpréter du texte comme du HTML : les noms de fichiers viennent du document, donc d'une personne. `h` est celui du kit
// (kit/js/dom.js), le même pour GFS et pour les apps : GFS ne le recopie plus (audit du code du 09/11 ; choix du porteur, 11/11 : « reprendre les copies
// exactes du kit »). Les enfants sont des nœuds ou du texte (ajouté comme texte) ; aucun `innerHTML`. h('button', { class: 'btn', dataset: { id: 3 }, on: {
// click: fn }, vars: { '--d': 2 }, 'aria-pressed': false }, enfants…)
export { h } from '../kit/js/dom.js';

export const clear = el => { el.replaceChildren(); return el; };
