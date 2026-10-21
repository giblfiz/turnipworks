// ======================= castle / crypt / mansion (2026-10-05) =======================
// v1 has no grammar for the new room types (they are v2 rooms, js/solver2.js): the classic engine lays the recipe's
// anchors, furniture, lights and dressing by their default rules, so it still runs
PROGRAMS.generic = (ctx) => {
  for (const id of ctx.slot('anchor').slice(0, 2)) ctx.auto(id, { layer: 'anchor' });
  ctx.fill('furnish', scaleN(ctx, 80, 1, 5), { layer: 'furnish' });
  ctx.fill('store', scaleN(ctx, 120, 0, 3), { layer: 'store' });
  ctx.fill('light', scaleN(ctx, 150, 1, 4), { layer: 'light' });
  ctx.fill('dress', scaleN(ctx, 60, 1, 6));
};
