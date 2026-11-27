// La doublure de DOM des essais qui lisent le texte et les attributs d'une fenêtre ou d'une ligne en code pur (explorer-view-info, opened-files, share-window-row) : un nœud qui garde sa balise, ses
// attributs, ses enfants et ses écouteurs. L'aspect à l'écran, lui, se mesure dans le labo, à la vraie souris, et sous Firefox. `installFakeDocument()` pose `document` ; à appeler avant d'importer le module lu.
class FakeNode {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.dataset = {}; this.style = { setProperty() {} }; this.className = ''; this.children = []; this.listeners = {}; this.title = undefined; }
  setAttribute(name, value) { this.attrs[name] = value; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  append(...nodes) { for (const node of nodes) this.children.push(node); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  cloneNode() { return this; }
  // Les classes d'un nœud, lues et écrites dans `className` (`add`, `remove`, `toggle`, `contains`).
  get classList() {
    const node = this;
    const list = () => node.className.split(/\s+/).filter(Boolean);
    const set = names => { node.className = [...new Set(names)].join(' '); };
    return { contains: name => list().includes(name), add: (...names) => set([...list(), ...names]), remove: (...names) => set(list().filter(each => !names.includes(each))),
      toggle(name, force) { const on = force === undefined ? !list().includes(name) : Boolean(force); set(on ? [...list(), name] : list().filter(each => each !== name)); return on; } };
  }
  get elements() { return this.children.filter(node => typeof node !== 'string'); }
  // `h` ajoute du texte comme chaîne ; `children` de `infoBar` est lu comme des éléments : la doublure sépare les deux.
  get childrenElements() { return this.elements; }
  get textContent() { return this.children.map(node => (typeof node === 'string' ? node : node.textContent)).join(''); }
  set textContent(value) { this.children = value === '' || value == null ? [] : [String(value)]; }
}

export function installFakeDocument() {
  globalThis.document = { createElement: tag => new FakeNode(tag), createElementNS: (ns, tag) => new FakeNode(tag) };
}
