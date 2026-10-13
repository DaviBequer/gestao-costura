// Banco de dados local (IndexedDB). Muito mais espaço que o localStorage
// e não perde dados quando o espaço do localStorage enche por causa das fotos.

const DB_NAME = 'gestao-costura';
const DB_VERSION = 1;
export const STORES = { lotes: 'lotes', despesas: 'despesas', kv: 'kv' };

let dbPromise = null;

const open = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.lotes)) db.createObjectStore(STORES.lotes, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.despesas)) db.createObjectStore(STORES.despesas, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.kv)) db.createObjectStore(STORES.kv);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const tx = async (store, mode, fn) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => (result = r));
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transação abortada'));
  });
};

const reqP = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const getAll = (store) => tx(store, 'readonly', (s) => reqP(s.getAll()));
export const put = (store, value) => tx(store, 'readwrite', (s) => s.put(value));
export const del = (store, id) => tx(store, 'readwrite', (s) => s.delete(id));
export const kvGet = (key) => tx(STORES.kv, 'readonly', (s) => reqP(s.get(key)));
export const kvSet = (key, value) => tx(STORES.kv, 'readwrite', (s) => s.put(value, key));

/** Substitui todo o conteúdo de um store de uma vez (restauração de backup) */
export const replaceAll = (store, values) =>
  tx(store, 'readwrite', (s) => {
    s.clear();
    values.forEach((v) => s.put(v));
  });

export const clearAll = async () => {
  await Promise.all([replaceAll(STORES.lotes, []), replaceAll(STORES.despesas, []), tx(STORES.kv, 'readwrite', (s) => s.clear())]);
};

/** Pede ao navegador para não apagar os dados automaticamente (importante no iPhone) */
export const requestPersistence = async () => {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (e) {
    /* ignora */
  }
  return false;
};

export const storageEstimate = async () => {
  try {
    if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate();
  } catch (e) {
    /* ignora */
  }
  return null;
};
