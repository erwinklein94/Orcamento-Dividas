// DOM-free model for the life-area pages (saúde, hábitos, lazer, pets, carreira).
const LifeStore = (() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const MAX_DELETED = 500;
  function empty(names) {
    return {version:1, collections:Object.fromEntries(names.map(n => [n, []])), deleted:[]};
  }
  function validPayload(p) {
    return !!(p && p.version === 1 && p.collections && typeof p.collections === 'object' &&
      Object.values(p.collections).every(items => Array.isArray(items) &&
        items.every(x => x && typeof x.id === 'string' && Number.isFinite(x.u))) &&
      Array.isArray(p.deleted) && p.deleted.every(id => typeof id === 'string'));
  }
  // Older rows may miss collections added to a page later.
  function normalize(p, names) {
    const result = clone(p);
    for (const n of names) result.collections[n] ||= [];
    return result;
  }
  function upsert(p, name, item) {
    const items = p.collections[name] ||= [];
    const saved = {...clone(item), u:Date.now()};
    const i = items.findIndex(x => x.id === saved.id);
    if (i < 0) items.push(saved); else items[i] = saved;
    return saved;
  }
  function remove(p, name, id) {
    const items = p.collections[name] || [];
    const i = items.findIndex(x => x.id === id);
    if (i < 0) return false;
    items.splice(i, 1);
    p.deleted = [...p.deleted.filter(x => x !== id), id].slice(-MAX_DELETED);
    return true;
  }
  // Conflict resolution between two devices: newest edit of each record wins and deletions stick.
  function merge(remote, local) {
    const result = clone(remote);
    const deleted = new Set([...remote.deleted, ...local.deleted]);
    for (const [name, items] of Object.entries(local.collections)) {
      const target = result.collections[name] ||= [];
      for (const item of items) {
        const i = target.findIndex(x => x.id === item.id);
        if (i < 0) target.push(clone(item));
        else if (item.u > target[i].u) target[i] = clone(item);
      }
    }
    for (const name of Object.keys(result.collections))
      result.collections[name] = result.collections[name].filter(x => !deleted.has(x.id));
    result.deleted = [...deleted].slice(-MAX_DELETED);
    return result;
  }
  return {clone, empty, validPayload, normalize, upsert, remove, merge};
})();
if (typeof module !== 'undefined') module.exports = LifeStore;
