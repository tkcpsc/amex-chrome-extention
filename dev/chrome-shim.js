// DEV ONLY: a fake `chrome` API so the real extension code can run in a normal
// browser tab against mock pages. Storage is backed by localStorage so the
// mock Amex pages and the dashboard share data. Never loaded by the extension.
(() => {
  const KEY = 'amex-dev-storage';
  const read = () => JSON.parse(localStorage.getItem(KEY) || '{}');
  const write = (o) => localStorage.setItem(KEY, JSON.stringify(o));
  const changeListeners = [];
  const msgListeners = [];

  const local = {
    async get(keys) {
      const all = read();
      if (keys == null) return all;
      const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      return Object.fromEntries(list.filter((k) => k in all).map((k) => [k, all[k]]));
    },
    async set(obj) {
      const all = read();
      const changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: all[k], newValue: v };
        all[k] = v;
      }
      write(all);
      changeListeners.forEach((fn) => fn(changes, 'local'));
    },
    async clear() {
      write({});
      changeListeners.forEach((fn) => fn({}, 'local'));
    },
  };

  window.addEventListener('storage', (e) => {
    if (e.key === KEY) changeListeners.forEach((fn) => fn({ external: {} }, 'local'));
  });

  window.chrome = {
    storage: { local, onChanged: { addListener: (fn) => changeListeners.push(fn) } },
    runtime: {
      id: 'dev',
      onMessage: { addListener: (fn) => msgListeners.push(fn) },
      getURL: (p) => `/extension/${p}`,
    },
    tabs: {
      create: ({ url }) => window.open(url),
      query: async () => [{ id: 1 }],
      // Popup preview: behave like a non-Amex tab (no content script).
      sendMessage: async () => { throw new Error('No content script in dev preview'); },
    },
  };

  // Test helper: send a message the way the popup would.
  window.__send = (msg) =>
    new Promise((resolve) => {
      for (const fn of msgListeners) if (fn(msg, { id: 'dev' }, resolve) === true) return;
      resolve(undefined);
    });
})();
