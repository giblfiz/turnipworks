// SPEED LEVERS (2026-11-06, the SPEED lane; docs/PERF.md; tools/perf-bench/lightuse.py measures them). Harry: "We are
// bound by the weakest PC that the party has." Each lever changes the picture only WHILE THE HAND MOVES (a pan, a turn,
// a zoom, a drag: interact.js "moving"); the picture at rest is exactly what it was. Each is a runtime switch, so the
// bench can measure A, B, A, B in one page: tw.levers = { name: false } puts one back as it was before.
export const LEVER_DEFAULTS = {
  dynres: true,      // a: fewer pixels while the camera moves, on a machine that needs it (interact.js stage 'pixels')
  shadowCache: false, // b: NOT BUILT (measured: ~15 ms of a 93 ms drag frame at High on the front web server, nothing in an orbit, and Auto picks Low there: docs/PERF.md "Not done")
  underMove: true,   // c: the underground under the closed ground is not redrawn every frame while the camera moves (world.js)
  early: true,       // d: the governor steps down before frames drop, not after (interact.js)
};
export const lever = (app, name) => { const v = app?.levers?.[name]; return v === undefined ? LEVER_DEFAULTS[name] : !!v; };
