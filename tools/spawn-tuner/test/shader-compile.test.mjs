import assert from 'node:assert/strict';
import { compileStable } from '../js/fx/compile.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 25));
function fixture() {
  const material = {}, properties = new Map();
  let ready = false, polls = 0;
  const program = { isReady() { polls++; return ready; } };
  properties.set(material, { currentProgram: program });
  const scene = {};
  const renderer = { compile: () => new Set([material]), properties: { get: m => properties.get(m) || {} }, info: { programs: [program] } };
  return { renderer, scene, material, properties, program, release: () => { properties.delete(material); renderer.info.programs.length = 0; }, finish: () => { ready = true; }, polls: () => polls };
}

// A normal warmup waits for completion, then returns the same scene.
{
  const f = fixture(); let finished = false;
  const pending = compileStable(f.renderer, f.scene, {}).then(result => { finished = true; return result; });
  await tick(); assert.equal(finished, false); f.finish(); assert.equal(await pending, f.scene);
}
// Exact reported race: an object is deleted while its shaders are still compiling.
{
  const f = fixture(), pending = compileStable(f.renderer, f.scene, {});
  f.release(); assert.equal(await pending, f.scene); assert.equal(f.polls(), 1, 'a released WebGL program is never polled');
}
// Rebuilding a material must not make an earlier warmup wait for an unrelated replacement program.
{
  const f = fixture(), pending = compileStable(f.renderer, f.scene, {});
  const replacement = { isReady() { throw new Error('wrong program'); } };
  f.properties.set(f.material, { currentProgram: replacement }); f.renderer.info.programs.push(replacement);
  f.finish(); assert.equal(await pending, f.scene);
}
// Two cap requests can overlap without either promise losing its own program.
{
  const f = fixture(), a = compileStable(f.renderer, f.scene, {}), b = compileStable(f.renderer, f.scene, {});
  f.release(); assert.deepEqual(await Promise.all([a, b]), [f.scene, f.scene]);
}
// Surface errors as a rejection instead of an uncaught timer callback and a permanently pending request.
{
  const f = fixture(); f.program.isReady = () => { throw new Error('context failed'); };
  await assert.rejects(compileStable(f.renderer, f.scene, {}), /context failed/);
}
console.log('shader compile: 7/7 passed');
