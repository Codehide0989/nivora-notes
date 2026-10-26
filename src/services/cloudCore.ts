/**
 * Pure sync logic (no React Native imports) so it can be unit-tested in plain Node.
 *
 * Model: every note / task / category / reminder / vault entry is a "record" identified by `kind:id`.
 * `hashes` remembers the hash of each record the last time it was in sync with the server.
 *   - local record whose hash differs from `hashes`  -> changed locally -> push
 *   - key in `hashes` that no longer exists locally   -> deleted locally -> push a tombstone
 * Conflicts (both sides changed) are resolved last-write-wins on `updatedAt`.
 */
export type Kind = 'note' | 'task' | 'category' | 'reminder' | 'vault';

export interface Item {
  kind: Kind;
  id: string;
  updatedAt: number;
  /** Already stripped of device-only fields (see stripForSync). */
  data: Record<string, unknown>;
}

export interface RemoteRecord {
  kind: Kind;
  id: string;
  deleted: boolean;
  updatedAt: number;
  data: Record<string, unknown> | null;
}

export const keyOf = (kind: Kind, id: string) => `${kind}:${id}`;

export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(',')}}`;
}

/** Remove fields that only make sense on one device (local file paths, notification ids, dirty flag). */
export function stripForSync(kind: Kind, data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  delete out.dirty;
  if (kind === 'note') delete out.attachments;
  if (kind === 'reminder') delete out.notificationId;
  return out;
}

export function timestampOf(data: Record<string, unknown>): number {
  const u = data.updatedAt;
  if (typeof u === 'number') return u;
  const c = data.createdAt;
  return typeof c === 'number' ? c : 0;
}

export type HashFn = (text: string) => string;
export const hashItem = (item: Item, hash: HashFn) => hash(canonical(item.data));

export interface PullPlan {
  upserts: Item[];
  removals: { kind: Kind; id: string }[];
  /** New value for hashes[key]; null means delete the entry. */
  hashes: Record<string, string | null>;
  kept: number;
}

export function planPull(local: Map<string, Item>, hashes: Record<string, string>, remote: RemoteRecord[], hash: HashFn): PullPlan {
  const plan: PullPlan = { upserts: [], removals: [], hashes: {}, kept: 0 };
  // Later records for the same key win (server sends them in revision order).
  const latest = new Map<string, RemoteRecord>();
  for (const r of remote) latest.set(keyOf(r.kind, r.id), r);

  for (const [key, r] of latest) {
    const L = local.get(key);
    const last = hashes[key];
    const localChanged = L ? last === undefined || hashItem(L, hash) !== last : false;

    if (r.deleted || !r.data) {
      if (!L) {
        plan.hashes[key] = null;
      } else if (localChanged && L.updatedAt > r.updatedAt) {
        plan.kept += 1; // our edit is newer than the deletion: keep it, it will be pushed
      } else {
        plan.removals.push({ kind: r.kind, id: r.id });
        plan.hashes[key] = null;
      }
      continue;
    }

    const item: Item = { kind: r.kind, id: r.id, updatedAt: r.updatedAt, data: r.data };
    if (L && hashItem(L, hash) === hashItem(item, hash)) {
      plan.hashes[key] = hashItem(item, hash); // already identical: just remember it, nothing to apply or push
      continue;
    }
    if (L && localChanged && L.updatedAt >= r.updatedAt) {
      plan.kept += 1; // both changed, local is newer (or equal): local wins and will be pushed
      continue;
    }
    plan.upserts.push(item);
    plan.hashes[key] = hashItem(item, hash);
  }
  return plan;
}

export interface PushPlan {
  changed: { item: Item; hash: string }[];
  tombstones: { kind: Kind; id: string; updatedAt: number }[];
}

export function planPush(local: Map<string, Item>, hashes: Record<string, string>, hash: HashFn, now: number): PushPlan {
  const changed: PushPlan['changed'] = [];
  for (const [key, item] of local) {
    const h = hashItem(item, hash);
    if (hashes[key] !== h) changed.push({ item, hash: h });
  }
  const tombstones: PushPlan['tombstones'] = [];
  for (const key of Object.keys(hashes)) {
    if (local.has(key)) continue;
    const i = key.indexOf(':');
    tombstones.push({ kind: key.slice(0, i) as Kind, id: key.slice(i + 1), updatedAt: now });
  }
  return { changed, tombstones };
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
