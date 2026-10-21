// node test_terrain.mjs : numeric checks of the bank maths (no browser)
import { buildField } from './viewer/terrain.js';
const dom = { x0: -90, z0: -90, n: 360, cs: 0.5 };
const plateau = { terraces: [{ rect: [-15, -15, 15, 15], h: 10 }] };
let fails = 0; const ok = (name, cond, got) => { console.log(cond ? 'ok  ' : 'FAIL', name, got ?? ''); if (!cond) fails++; };
let t = Date.now();
let F = buildField(plateau, { angle: 30, soft: 0, round: 0, rough: 0, cliffs: 'scene', seed: 1 }, dom);
console.log('build ms', Date.now() - t);
ok('top is 10', Math.abs(F.heightAt(0, 0) - 10) < 1e-3, F.heightAt(0, 0));
ok('far lawn is 0', F.heightAt(60, 60) === 0);
ok('mid bank east is 5 at run/2', Math.abs(F.heightAt(15 + 8.66, 0) - 5) < 0.2, F.heightAt(15 + 8.66, 0));
ok('slope is 30 deg', Math.abs(F.slopeDeg(23, 0) - 30) < 1, F.slopeDeg(23, 0));
ok('foot at 17.3 ft', F.heightAt(15 + 17.0, 0) > 0 && F.heightAt(15 + 17.8, 0) === 0, [F.heightAt(32, 0), F.heightAt(32.8, 0)]);
const d = 8.66 / Math.SQRT2;
ok('corner is round (diagonal same as straight)', Math.abs(F.heightAt(15 + d, 15 + d) - 5) < 0.25, F.heightAt(15 + d, 15 + d));
for (const a of [15, 45, 60]) { F = buildField(plateau, { angle: a, soft: 0, round: 0, rough: 0, cliffs: 'scene', seed: 1 }, dom); ok(`angle ${a}`, Math.abs(F.slopeDeg(15 + 5 / Math.tan(a * Math.PI / 180), 0, 0.5) - a) < 1.5, F.slopeDeg(15 + 5 / Math.tan(a * Math.PI / 180), 0, 0.5)); }
t = Date.now();
F = buildField({ terraces: [{ rect: [-40, -30, 30, 30], h: 5 }, { rect: [-25, -20, 15, 15], h: 10 }, { rect: [-10, -10, 0, 0], h: 15 }], cliffs: [[-40, -60, 40, -28]] }, { angle: 30, soft: 1.5, round: 3, rough: 0.5, cliffs: 'scene', seed: 1 }, dom);
console.log('3-level build ms', Date.now() - t);
ok('summit flat', F.relief(-5, -5, 2.5) < 0.15, F.relief(-5, -5, 2.5));
ok('summit height', Math.abs(F.heightAt(-5, -5) - 15) < 0.1, F.heightAt(-5, -5));
ok('no NaN', !F.h.some(Number.isNaN));
let steep = 0; for (let z = -40; z < -24; z += 0.25) steep = Math.max(steep, F.slopeDeg(-5, z, 0.5));
ok('cliff steeper than bank', steep > 55, steep);
F = buildField({ terraces: [{ rect: [-45, -25, 45, 25], h: -10 }], ramps: [{ a: [-72, 0, 0], b: [-40, 0, -10], w: 8 }] }, { angle: 30, soft: 1, round: 3, rough: 0.3, cliffs: 'scene', seed: 1 }, dom);
ok('hollow floor -10', Math.abs(F.heightAt(0, 0) + 10) < 0.1, F.heightAt(0, 0));
ok('rim 0', Math.abs(F.heightAt(0, 40)) < 0.05, F.heightAt(0, 40));
ok('ramp mid -5', Math.abs(F.heightAt(-56, 0) + 5) < 0.4, F.heightAt(-56, 0));
process.exit(fails ? 1 : 0);
