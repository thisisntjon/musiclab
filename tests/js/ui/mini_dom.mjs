// A very small HTML tree for tests that need to ask a rendered screen what a person would read.
// It parses the app's own template output (tags, attributes, text) and answers simple selectors:
// tag, .class, #id, [attr] and [attr="value"], joined into compounds and comma lists. No layout.
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s.replace(/&(#\d+|[a-z]+);/gi, (m, e) => e[0] === "#" ? String.fromCharCode(Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m);

class Node {
  constructor(tag, attrs = {}, parent = null) { this.tag = tag; this.attrs = attrs; this.parentElement = parent; this.childNodes = []; }
  get tagName() { return this.tag.toUpperCase(); }
  get id() { return this.attrs.id || ""; }
  get children() { return this.childNodes.filter((n) => n instanceof Node); }
  get open() { return this.hasAttribute("open"); }
  get hidden() { return this.hasAttribute("hidden"); }
  get classList() { const list = (this.attrs.class || "").split(/\s+/).filter(Boolean); return { contains: (c) => list.includes(c) }; }
  get dataset() {
    const out = {};
    for (const [k, v] of Object.entries(this.attrs)) if (k.startsWith("data-")) out[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    return out;
  }
  get textContent() { return this.childNodes.map((n) => (typeof n === "string" ? n : n.textContent)).join(""); }
  set textContent(value) { this.childNodes = [String(value)]; }
  getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; }
  hasAttribute(name) { return name in this.attrs; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  matches(selectors) { return splitList(selectors).some((s) => matchComplex(this, s)); }
  closest(selectors) { for (let n = this; n; n = n.parentElement) if (n.tag !== "#root" && n.matches(selectors)) return n; return null; }
  contains(other) { for (let n = other; n; n = n.parentElement) if (n === this) return true; return false; }
  querySelectorAll(selectors) {
    const out = [];
    const walk = (n) => { for (const c of n.children) { if (c.matches(selectors)) out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  querySelector(selectors) { return this.querySelectorAll(selectors)[0] || null; }
  get firstElementChild() { return this.children[0] || null; }
  get innerHTML() { return this.childNodes.map(serialize).join(""); }
  set innerHTML(html) { this.childNodes = adopt(parseHtml(html), this); }
  insertAdjacentHTML(where, html) {
    const nodes = adopt(parseHtml(html), this);
    if (where === "afterbegin") this.childNodes.unshift(...nodes);
    else if (where === "beforeend") this.childNodes.push(...nodes);
    else throw new Error(`mini_dom does not support insertAdjacentHTML ${where}`);
  }
  focus() {}
}

function adopt(root, parent) {
  for (const n of root.childNodes) if (n instanceof Node) n.parentElement = parent;
  return root.childNodes;
}

const escapeText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function serialize(n) {
  if (typeof n === "string") return escapeText(n);
  const attrs = Object.entries(n.attrs).map(([k, v]) => ` ${k}="${String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`).join("");
  return VOID.has(n.tag) ? `<${n.tag}${attrs}>` : `<${n.tag}${attrs}>${n.childNodes.map(serialize).join("")}</${n.tag}>`;
}

function splitList(selectors) { return selectors.split(",").map((s) => s.trim()).filter(Boolean); }

/** Descendant combinators only ("details p.pf-sub"): the last compound is this node, the rest are ancestors. */
function matchComplex(node, selector) {
  const parts = selector.split(/\s+(?![^(]*\))/).filter(Boolean);
  if (!matchCompound(node, parts.at(-1))) return false;
  let at = node.parentElement;
  for (let i = parts.length - 2; i >= 0; i--) {
    while (at && (at.tag === "#root" || !matchCompound(at, parts[i]))) at = at.parentElement;
    if (!at) return false;
    at = at.parentElement;
  }
  return true;
}

function matchCompound(node, selector) {
  const not = selector.match(/^(.*?):not\(([^()]*)\)(.*)$/);
  if (not) return matchCompound(node, not[1] + not[3] || "*") && !matchCompound(node, not[2]);
  if (selector === "*") return true;
  const re = /([a-z][a-z0-9-]*)|\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/gy;
  let m, at = 0;
  while (at < selector.length) {
    re.lastIndex = at;
    m = re.exec(selector);
    if (!m) throw new Error(`mini_dom does not understand the selector: ${selector}`);
    at = re.lastIndex;
    if (m[1] && node.tag !== m[1]) return false;
    if (m[2] && !node.classList.contains(m[2])) return false;
    if (m[3] && node.id !== m[3]) return false;
    if (m[4] && (!node.hasAttribute(m[4]) || (m[5] !== undefined && node.getAttribute(m[4]) !== m[5]))) return false;
  }
  return true;
}

/** Parse an HTML fragment into a root node that answers querySelector/querySelectorAll. */
export function parseHtml(html) {
  const root = new Node("#root");
  let current = root;
  const tagRe = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
  let last = 0, m;
  while ((m = tagRe.exec(html))) {
    if (m.index > last) current.childNodes.push(decode(html.slice(last, m.index)));
    last = tagRe.lastIndex;
    if (m[0].startsWith("<!--")) continue;
    const tag = m[1].toLowerCase();
    if (m[0].startsWith("</")) {
      for (let n = current; n && n !== root; n = n.parentElement) if (n.tag === tag) { current = n.parentElement; break; }
      continue;
    }
    const attrs = {};
    for (const a of m[2].matchAll(/([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? "");
    const node = new Node(tag, attrs, current);
    current.childNodes.push(node);
    if (!VOID.has(tag) && !m[3]) current = node;
  }
  if (last < html.length) current.childNodes.push(decode(html.slice(last)));
  return root;
}
