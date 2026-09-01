/* jsdom + canvas shim so the real React app can mount under Node */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window;
global.window = w; global.document = w.document; global.navigator = w.navigator;
global.HTMLElement = w.HTMLElement; global.Element = w.Element; global.Node = w.Node;
global.Image = w.Image; global.Event = w.Event; global.MouseEvent = w.MouseEvent;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
/* ResizeObserver that actually fires, so the paint/foil path really runs in jsdom */
global.ResizeObserver = class {
  constructor(cb) { this.cb = cb; }
  observe(el) { this.el = el; try { this.cb([{ target: el, contentRect: { width: 300, height: 400 } }], this); } catch {} }
  unobserve() {} disconnect() {}
};
const noop = () => {};
w.HTMLCanvasElement.prototype.getContext = function () {
  return new Proxy({
    canvas: this,
    createPattern: () => ({ setTransform: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
    getImageData: (x, y, ww, hh) => ({ data: new Uint8ClampedArray(ww * hh * 4) }),
    measureText: () => ({ width: 10 }),
    setTransform: noop,
  }, { get: (t, k) => (k in t ? t[k] : noop), set: () => true });
};
w.HTMLElement.prototype.setPointerCapture = noop;
w.HTMLElement.prototype.releasePointerCapture = noop;
global.self = w;
require('./run.cjs').run().then((ok) => process.exit(ok ? 0 : 1));
