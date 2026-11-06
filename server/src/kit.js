// Browser code the server hands to pages: the Web Component kit (`/kit.js`) agents build
// test benches with, and the bridge (`/bridge.js`) that keeps a page's control values in the
// store, so a slider keeps its value when the agent rewrites the page.

export const KIT_JS = String.raw`
const css = (s) => { const sheet = new CSSStyleSheet(); sheet.replaceSync(s); return sheet; };
const base = css(':host{font:15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--da-fg,#1f2328)}' +
  '@media (prefers-color-scheme:dark){:host{color:var(--da-fg,#e6edf3)}}' +
  'label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--da-muted,#59636e)}' +
  'input,select{font:inherit;color:inherit;padding:8px 10px;border-radius:10px;border:1px solid var(--da-border,#d1d9e0);background:transparent}' +
  'input[type=range]{padding:0;border:0;accent-color:var(--da-accent,#0969da)}');

class KitElement extends HTMLElement {
  static observedAttributes = ["label", "value", "checked", "min", "max", "step", "heading", "variant", "placeholder", "disabled"];
  constructor() { super(); this.attachShadow({ mode: "open" }).adoptedStyleSheets = [base, css(this.constructor.styles ?? "")]; }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { if (this.isConnected) this.render(); }
  emit(type) { this.dispatchEvent(new Event(type, { bubbles: true, composed: true })); }
  attr(name, fallback = "") { return this.getAttribute(name) ?? fallback; }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

customElements.define("da-card", class extends KitElement {
  static styles = ':host{display:block;margin:16px;padding:16px;border-radius:16px;border:1px solid var(--da-border,#d1d9e0);background:var(--da-surface,transparent)}' +
    'h2{margin:0 0 12px;font-size:17px}::slotted(*){display:block;margin-top:12px}';
  render() { this.shadowRoot.innerHTML = (this.hasAttribute("heading") ? "<h2>" + esc(this.attr("heading")) + "</h2>" : "") + "<slot></slot>"; }
});

customElements.define("da-row", class extends KitElement {
  static styles = ':host{display:flex;gap:12px;align-items:center;flex-wrap:wrap}';
  render() { this.shadowRoot.innerHTML = "<slot></slot>"; }
});

customElements.define("da-button", class extends KitElement {
  static styles = 'button{font:inherit;font-weight:600;border:0;border-radius:10px;padding:10px 16px;background:var(--da-accent,#0969da);color:#fff}' +
    ':host([variant=secondary]) button{background:transparent;color:inherit;border:1px solid var(--da-border,#d1d9e0)}button:active{opacity:.7}';
  render() { this.shadowRoot.innerHTML = "<button part=button " + (this.hasAttribute("disabled") ? "disabled" : "") + "><slot></slot></button>"; }
});

customElements.define("da-slider", class extends KitElement {
  get value() { return Number(this.shadowRoot.querySelector("input")?.value ?? this.attr("value", "0")); }
  set value(v) { this.setAttribute("value", String(v)); }
  render() {
    const v = this.attr("value", this.attr("min", "0"));
    this.shadowRoot.innerHTML = "<label>" + esc(this.attr("label")) + " <output>" + esc(v) + "</output><input type=range min='" + esc(this.attr("min", "0")) +
      "' max='" + esc(this.attr("max", "100")) + "' step='" + esc(this.attr("step", "1")) + "' value='" + esc(v) + "'></label>";
    const input = this.shadowRoot.querySelector("input");
    input.addEventListener("input", () => { this.shadowRoot.querySelector("output").textContent = input.value; this.emit("input"); });
    input.addEventListener("change", () => { this.setAttribute("value", input.value); this.emit("change"); });
  }
});

customElements.define("da-switch", class extends KitElement {
  static styles = 'label{flex-direction:row;align-items:center;justify-content:space-between;color:inherit;font-size:15px}' +
    'button{width:51px;height:31px;border-radius:16px;border:0;background:var(--da-border,#d1d9e0);position:relative;transition:background .2s}' +
    'button::after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;transition:transform .2s}' +
    'button[aria-checked=true]{background:var(--da-accent,#0969da)}button[aria-checked=true]::after{transform:translateX(20px)}';
  get value() { return this.hasAttribute("checked"); }
  set value(v) { this.toggleAttribute("checked", Boolean(v) && v !== "false"); }
  render() {
    this.shadowRoot.innerHTML = "<label>" + esc(this.attr("label")) + "<button role=switch aria-checked=" + this.value + "></button></label>";
    this.shadowRoot.querySelector("button").addEventListener("click", () => { this.value = !this.value; this.emit("input"); this.emit("change"); });
  }
});

customElements.define("da-input", class extends KitElement {
  get value() { return this.shadowRoot.querySelector("input")?.value ?? this.attr("value"); }
  set value(v) { this.setAttribute("value", String(v)); }
  render() {
    this.shadowRoot.innerHTML = "<label>" + esc(this.attr("label")) + "<input placeholder='" + esc(this.attr("placeholder")) + "' value='" + esc(this.attr("value")) + "'></label>";
    const input = this.shadowRoot.querySelector("input");
    input.addEventListener("input", () => this.emit("input"));
    input.addEventListener("change", () => { this.setAttribute("value", input.value); this.emit("change"); });
  }
});
`;

export const BRIDGE_JS = String.raw`
(() => {
  const config = window.__DESIGNAGENT__;
  if (!config) return;
  const state = Object.assign({}, config.state);
  const named = () => document.querySelectorAll("[name]");
  const read = (el) => el.type === "checkbox" ? el.checked : el.type === "range" || el.type === "number" ? Number(el.value) : el.value;
  const write = (el, v) => { if (el.type === "checkbox") el.checked = Boolean(v); else el.value = v; };
  const restore = () => {
    for (const el of named()) {
      const key = el.getAttribute("name");
      if (key in state && "value" in el) write(el, state[key]);
    }
  };
  let timer = 0;
  const pending = {};
  const flush = () => {
    const body = JSON.stringify({ values: Object.assign({}, pending) });
    for (const k of Object.keys(pending)) delete pending[k];
    fetch(config.stateUrl, { method: "PUT", headers: { "content-type": "application/json" }, body, credentials: "same-origin" }).catch(() => {});
    if (window.nsh && window.nsh.postMessage) window.nsh.postMessage(JSON.stringify({ type: "state", values: state }));
  };
  const onChange = (event) => {
    const el = event.composedPath().find((n) => n instanceof Element && n.hasAttribute("name"));
    if (!el || !("value" in el)) return;
    const key = el.getAttribute("name");
    state[key] = read(el);
    pending[key] = state[key];
    clearTimeout(timer);
    timer = setTimeout(flush, 250);
  };
  document.addEventListener("input", onChange, true);
  document.addEventListener("change", onChange, true);
  // Kit elements take their value once they are defined, so wait for the ones on the page.
  const start = () => {
    const tags = ["da-slider", "da-switch", "da-input"].filter((t) => document.querySelector(t));
    Promise.all(tags.map((t) => customElements.whenDefined(t))).then(restore);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.addEventListener("load", restore);
})();
`;

/** Wraps an HTML fragment (an artboard option, one side of a verify group) as a page. */
export function framePage(title, body) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; min-height: 100%; font: 16px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  img.full { display: block; width: 100%; height: auto; }
</style>
<script type="module" src="/kit.js"></script>
</head>
<body>
${body}
</body>
</html>
`;
}

/** Adds the kit and the persistence bridge to a page the agent wrote. */
export function injectBridge(html, { stateUrl, state }) {
  const config = JSON.stringify({ stateUrl, state }).replace(/</g, "\\u003c");
  const tags = `<script>window.__DESIGNAGENT__=${config};</script><script src="/bridge.js" defer></script>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tags}</head>`);
  return `${tags}${html}`;
}
