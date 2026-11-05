// What stands on a thing goes with it (Harry 2026-11-02), in core, so the relay and every seat agree (an AI seat's object.delete
// goes straight here). browser_marqueefold.py has the real input.
import { applyArea, inverseOf, goesWith, restingOn, checkCommand } from '../core/commands.js';
import { newArea } from '../core/state.js';
let bad = 0, n = 0; const ok = (c, name) => { n++; if (!c) { bad++; console.log('FAIL', name); } };
const obj = (id, parent, extra = {}) => ({ id, name: id, cat: 'crate', x: 10, z: 10, dims: [1, 1, 1], ...(parent && { parent }), ...extra });
let A = newArea('t', 'T');
for (const [id, p, x] of [['obj_desk0000001'], ['obj_tray0000001', 'obj_desk0000001'], ['obj_cup00000001', 'obj_tray0000001'], ['obj_lock0000001', 'obj_desk0000001', { locked: true }], ['obj_onlk0000001', 'obj_lock0000001'], ['obj_near0000001']]) A = applyArea(A, 'object.place', obj(id, p, x));
A = { ...A, entities: { ...A.entities, obj_lock0000001: { ...A.entities.obj_lock0000001, locked: true } } };
ok(restingOn(A.entities, 'obj_desk0000001').length === 2, 'restingOn: the two on the desk');
const w = goesWith(A.entities, 'obj_desk0000001');
ok(w.gone.sort().join() === 'obj_cup00000001,obj_tray0000001' && w.kept.map(e => e.id).join() === 'obj_lock0000001', 'goesWith: what goes, and the locked thing stays (and what stands on it)');
const D = applyArea(A, 'object.delete', { id: 'obj_desk0000001' }), inv = inverseOf(A, 'object.delete', { id: 'obj_desk0000001' });
ok(!D.entities.obj_desk0000001 && !D.entities.obj_tray0000001 && !D.entities.obj_cup00000001, 'delete takes the desk and all that stands on it, however deep');
ok(D.entities.obj_lock0000001 && !D.entities.obj_lock0000001.parent, 'a locked thing stays, standing on nothing');
ok(D.entities.obj_onlk0000001?.parent === 'obj_lock0000001', 'what stands on a locked thing stays on it');
ok(D.entities.obj_near0000001, 'a thing beside the desk is left alone');
const B = applyArea(D, inv.type, inv.args);
ok(JSON.stringify(Object.keys(B.entities).sort()) === JSON.stringify(Object.keys(A.entities).sort()) && Object.keys(A.entities).every(k => JSON.stringify(B.entities[k]) === JSON.stringify(A.entities[k])), 'one undo restores everything exactly');
const C = applyArea(A, 'batch', { ops: [{ type: 'object.delete', args: { id: 'obj_desk0000001' } }, { type: 'object.delete', args: { id: 'obj_near0000001' } }] }), iv2 = inverseOf(A, 'batch', { ops: [{ type: 'object.delete', args: { id: 'obj_desk0000001' } }, { type: 'object.delete', args: { id: 'obj_near0000001' } }] });
ok(!C.entities.obj_cup00000001 && !C.entities.obj_near0000001 && Object.keys(A.entities).every(k => JSON.stringify(applyArea(C, iv2.type, iv2.args).entities[k]) === JSON.stringify(A.entities[k])), 'in a batch too, one undo');
console.log(`riders: ${n - bad}/${n} checks passed`); process.exit(bad ? 1 : 0);
