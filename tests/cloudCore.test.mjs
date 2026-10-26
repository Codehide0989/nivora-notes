// Unit tests for the sync merge logic. Plain Node, no dependencies:
//   npm run test:sync        (Node 22.6+; the file is TypeScript that Node can strip types from)
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as K from '../src/services/cloudCore.ts';

const h = (t) => crypto.createHash('sha256').update(t).digest('hex');
const mk = (kind, id, updatedAt, extra = {}) => ({ kind, id, updatedAt, data: { id, updatedAt, ...extra } });
const L = (...items) => new Map(items.map((i) => [K.keyOf(i.kind, i.id), i]));
const rem = (kind, id, updatedAt, extra = {}, deleted = false) => ({ kind, id, updatedAt, deleted, data: deleted ? null : { id, updatedAt, ...extra } });

// fresh device: everything remote is applied
let p = K.planPull(L(), {}, [rem('note', 'a', 5, { t: 1 }), rem('note', 'b', 6, { t: 2 })], h);
assert.equal(p.upserts.length, 2);
assert.equal(p.removals.length, 0);

// unchanged local + newer remote -> take remote
let n1 = mk('note', 'a', 5, { t: 1 });
p = K.planPull(L(n1), { 'note:a': K.hashItem(n1, h) }, [rem('note', 'a', 9, { t: 99 })], h);
assert.equal(p.upserts[0].data.t, 99);

// both changed, local newer -> keep local and push it
n1 = mk('note', 'a', 20, { t: 'local' });
p = K.planPull(L(n1), { 'note:a': 'old' }, [rem('note', 'a', 9, { t: 'remote' })], h);
assert.equal(p.upserts.length, 0);
assert.equal(p.kept, 1);
assert.equal(K.planPush(L(n1), { 'note:a': 'old' }, h, 100).changed.length, 1);

// both changed, remote newer -> remote wins
p = K.planPull(L(mk('note', 'a', 8, { t: 'local' })), { 'note:a': 'old' }, [rem('note', 'a', 9, { t: 'remote' })], h);
assert.equal(p.upserts[0].data.t, 'remote');

// remote deletion removes an unchanged local item, but a newer local edit survives
n1 = mk('note', 'a', 5);
p = K.planPull(L(n1), { 'note:a': K.hashItem(n1, h) }, [rem('note', 'a', 9, {}, true)], h);
assert.deepEqual(p.removals, [{ kind: 'note', id: 'a' }]);
n1 = mk('note', 'a', 50, { edited: true });
p = K.planPull(L(n1), { 'note:a': 'old' }, [rem('note', 'a', 9, {}, true)], h);
assert.equal(p.removals.length, 0);

// identical content: nothing to apply or push
n1 = mk('note', 'a', 5, { t: 1 });
p = K.planPull(L(n1), {}, [rem('note', 'a', 5, { t: 1 })], h);
assert.equal(p.upserts.length, 0);
assert.equal(p.hashes['note:a'], K.hashItem(n1, h));

// push plan: changed + tombstones
const x = mk('task', 'x', 1, { d: 1 });
const y = mk('task', 'y', 2, { d: 2 });
const pp = K.planPush(L(x, y), { 'task:x': K.hashItem(x, h), 'task:gone': 'zzz' }, h, 777);
assert.deepEqual(pp.changed.map((c) => c.item.id), ['y']);
assert.deepEqual(pp.tombstones, [{ kind: 'task', id: 'gone', updatedAt: 777 }]);

// helpers
assert.equal(K.canonical({ b: 1, a: [2, { d: 1, c: undefined }] }), '{"a":[2,{"d":1}],"b":1}');
assert.deepEqual(K.stripForSync('note', { id: 1, attachments: [{ uri: 'file://x' }], dirty: true, title: 't' }), { id: 1, title: 't' });
assert.deepEqual(K.stripForSync('reminder', { id: 1, notificationId: 'n', at: 5 }), { id: 1, at: 5 });
assert.deepEqual(K.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
console.log('cloudCore: all sync merge tests passed');
