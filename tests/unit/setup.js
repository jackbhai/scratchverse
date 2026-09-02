// jsdom shims the app expects: canvas 2d, ResizeObserver, WAAPI, pointer capture, IDB.
import { vi } from 'vitest';

const noop = () => {};
if (typeof window !== 'undefined') {
  window.Element.prototype.animate =
    window.Element.prototype.animate ||
    function animate() {
      const a = { cancel: noop, finish: noop, play: noop, pause: noop, onfinish: null, finished: Promise.resolve() };
      setTimeout(() => a.onfinish?.(), 0);
      return a;
    };
  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    return new Proxy(
      {
        canvas: this,
        createPattern: () => ({ setTransform: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
        createLinearGradient: () => ({ addColorStop: noop }),
        getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: noop,
        measureText: () => ({ width: 10 }),
        setTransform: noop,
      },
      { get: (t, k) => (k in t ? t[k] : noop), set: () => true }
    );
  };
  window.HTMLElement.prototype.setPointerCapture = noop;
  window.HTMLElement.prototype.releasePointerCapture = noop;
  window.matchMedia =
    window.matchMedia ||
    (() => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }));
  window.ResizeObserver =
    window.ResizeObserver ||
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  window.DOMMatrix =
    window.DOMMatrix ||
    class {
      constructor(a) {
        this.a = a;
      }
    };
  // IndexedDB is absent in jsdom: the app must fall back without exploding
  Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || noop;
window.HTMLMediaElement.prototype.play = window.HTMLMediaElement.prototype.play || (() => Promise.resolve());
window.scrollTo = window.scrollTo || noop;
window.vitestNoop = noop;
if (!window.crypto?.randomUUID) {
  Object.defineProperty(window.crypto || globalThis.crypto || {}, 'randomUUID', {
    value: () => Math.random().toString(16).slice(2),
    configurable: true,
  });
}
vi.mock('dexie', () => {
  class FakeDexie {
    constructor() {
      this.tables = {};
    }
    version() {
      return { stores: () => this };
    }
    get() {
      return Promise.resolve(undefined);
    }
  }
  const stub = new Proxy(new FakeDexie(), {
    get: (t, k) => {
      if (k in t) return t[k];
      return {
        get: () => Promise.resolve(undefined),
        put: () => Promise.resolve(),
        add: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        clear: () => Promise.resolve(),
        toArray: () => Promise.resolve([]),
        count: () => Promise.resolve(0),
        orderBy: () => ({ last: () => Promise.resolve(undefined), limit: () => ({ toArray: () => Promise.resolve([]) }) }),
      };
    },
  });
  return { default: FakeDexie, Dexie: FakeDexie, fake: stub };
});
