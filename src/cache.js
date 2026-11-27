// Cache em memória com TTL. Para produção, troque por Redis mantendo a mesma interface.
export class TTLCache {
  constructor(ttlSeconds = 300, maxItems = 500) {
    this.ttl = ttlSeconds * 1000;
    this.max = maxItems;
    this.store = new Map();
  }
  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.exp < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }
  set(key, value) {
    if (this.store.size >= this.max) {
      this.store.delete(this.store.keys().next().value); // descarta o mais antigo
    }
    this.store.set(key, { value, exp: Date.now() + this.ttl });
  }
}
