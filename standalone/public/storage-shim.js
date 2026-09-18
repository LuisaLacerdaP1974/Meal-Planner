// Este ficheiro faz "window.storage" funcionar com o localStorage do browser,
// usando a mesma forma de chamar (get/set/delete) que a versão em Claude.ai usava.
// Assim o código da app (app.jsx) não precisou de ser reescrito nesta parte.
window.storage = {
  async get(key) {
    const value = window.localStorage.getItem(key);
    if (value === null) throw new Error("not found: " + key);
    return { key, value };
  },
  async set(key, value) {
    window.localStorage.setItem(key, value);
    return { key, value };
  },
  async delete(key) {
    window.localStorage.removeItem(key);
    return { key, deleted: true };
  },
  async list(prefix) {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!prefix || k.startsWith(prefix)) keys.push(k);
    }
    return { keys };
  },
};
