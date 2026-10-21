// three.js r170's compileAsync polls material.currentProgram. Deleting a selected object or rebuilding
// the world can dispose that material between polls, so the callback throws and the promise never settles.
// Capture the actual programs from this compile instead. A released program no longer needs warming.
// These are the same renderer properties/program interfaces used by our pinned r170 compileAsync.
export function compileStable(renderer, scene, camera) {
  const materials = renderer.compile(scene, camera);
  const pending = new Set([...materials].map(m => renderer.properties.get(m).currentProgram).filter(Boolean));
  return new Promise((resolve, reject) => {
    function ready() {
      try {
        const live = new Set(renderer.info.programs);
        for (const program of pending) if (!live.has(program) || program.isReady()) pending.delete(program);
        if (!pending.size) return resolve(scene);
        setTimeout(ready, 10);
      } catch (error) { reject(error); }
    }
    ready();
  });
}
