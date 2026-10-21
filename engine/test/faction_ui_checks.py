"""Real faction ring/shelf gestures, called by browser_factions after its building checks.

2026-10-20: the ring is Ring Lab's world-sized oval: Faction ▸ opens as the ring grown outward, one button per faction
(`#ring .rbtn[data-nest][data-faction]`, "As the building's / room's" first as data-faction="inherit"), not the old
two-row panel. The ring may run under the top bar, so ring() puts its centre low enough to click.
"""
# the ring's centre (tw.ringAnchor()) at (½ width, fy × height), by moving the camera's focus
FRAME = """async (fy) => { const g = tw.main.grab, sleep = (ms) => new Promise(r => setTimeout(r, ms)); await sleep(150);
  for (let i = 0; i < 8; i++) { const an = tw.ringAnchor(); if (!an) break; const ex = an.x - innerWidth / 2, ey = an.y - innerHeight * fy; if (Math.hypot(ex, ey) < 4) break;
    const p0 = tw.screenOf(g.focus.x, g.focus.z), p1 = tw.screenOf(g.focus.x + 1, g.focus.z), p2 = tw.screenOf(g.focus.x, g.focus.z + 1);
    const a11 = p1.x - p0.x, a12 = p2.x - p0.x, a21 = p1.y - p0.y, a22 = p2.y - p0.y, det = a11 * a22 - a12 * a21; if (!det) break;
    g.focus.x += (a22 * ex - a12 * ey) / det; g.focus.z += (-a21 * ex + a11 * ey) / det; g.update(); await sleep(150); }
  return tw.ringAnchor(); }"""
CHOICES = '#ring .rbtn[data-nest][data-faction]:not([data-faction="inherit"])'
INHERIT = '#ring .rbtn[data-nest][data-faction="inherit"]'

async def run(pg, check, snap):
    async def idle():
        await pg.wait_for_function('tw.sync.pendingCount() === 0')

    async def ring(entity):
        await pg.keyboard.press('Escape')
        await pg.evaluate('''id => {
          tw.modes.cancel(); tw.library.hideFactions(); tw.build.close(); tw.select(id);
          const e=tw.ent(id), r=e.recipe || e.gen;
          const g=tw.main.grab;
          if(r?.w) { g.focus.set((r.x+r.w/2)*5,0,(r.z+r.d/2)*5); g.dist=Math.max(90,Math.max(r.w,r.d)*8); }
          else { g.focus.set(e.x,0,e.z); g.dist=70; }
          g.pitch=58;g.yaw=0;g.update();tw.main.rule='free';
        }''', entity)
        await pg.wait_for_timeout(700)  # the ring deliberately swallows accidental double-clicks
        await pg.evaluate(FRAME, 0.62)
        menu = pg.locator('#ring .rbtn[data-menu]')
        await menu.wait_for(state='visible')
        if await menu.get_attribute('aria-expanded') != 'true':
            await menu.click(); await pg.wait_for_timeout(800)  # (the slide)
        await pg.locator('#ring .rbtn[data-cmd="faction.set"]').click()
        await pg.locator(CHOICES).first.wait_for(state='visible'); await pg.wait_for_timeout(300)

    async def pick(faction):
        await pg.locator('#ring .rbtn[data-nest][data-faction="'+faction+'"]').click()
        await idle()

    async def shelf():
        await pg.keyboard.press('Escape')
        await pg.evaluate('tw.modes.cancel();tw.build.close();tw.clearSelection()')
        await pg.locator('#launchers [data-l="build"]').click()
        await pg.locator('#buildMenu [data-factions]').click()
        await pg.locator('#factionShelf').wait_for(state='visible')

    async def offer_fixture(room_type, x, count, name):
        await pg.keyboard.press('Escape')
        await pg.evaluate("tw.modes.cancel();tw.build.close();tw.library.hideFactions();tw.clearSelection();tw.condButtons.hide('faction')")
        room = await pg.evaluate('''([type,x]) => {
          const g=tw.main.grab;g.focus.set((x+3)*5,0,360);g.dist=100;g.pitch=58;g.yaw=0;g.update();tw.main.rule='free';
          return tw.spawnRoom(type,x,68,6,8,531);
        }''', [room_type,x])
        await idle()
        await pg.locator('.faction-offer').wait_for(state='visible')
        await pg.wait_for_timeout(1500)  # let the room's spawn arrive behind the contextual row
        offer = pg.locator('.faction-offer')
        rows = await offer.locator('.faction-row').evaluate_all('(rows)=>rows.map(r=>({n:r.children.length,y:r.getBoundingClientRect().top}))')
        check(len(rows)==2 and rows[0]['y']<rows[1]['y'] and sum(r['n'] for r in rows)==count, f'{count}-faction drag offer has exactly two physical rows', rows)
        check(await offer.locator('.faction-choice').evaluate_all('(bs)=>bs.every(b=>!b.textContent.trim()&&b.title&&b.getAttribute("aria-label"))') and not (await offer.inner_text()).strip(), f'{count}-faction drag offer has icons only')
        check(await offer.evaluate('(e)=>{const b=e.getBoundingClientRect();return b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight}'), f'{count}-faction drag offer stays inside screen')
        check(await offer.evaluate('(e)=>e.getBoundingClientRect().top > document.querySelector("#crumbs").getBoundingClientRect().bottom'), f'{count}-faction offer clears area breadcrumb')
        await snap(pg,name)
        await pg.locator('.faction-offer [data-faction="moon"]').click();await idle()
        check(await pg.evaluate('id=>tw.ent(id).recipe.flavor==="moon"',room), f'{count}-faction drag offer changes newly created room')
        await pg.evaluate('([type,x])=>tw.spawnRoom(type,x,80,6,8,532)',[room_type,x]);await idle();await pg.wait_for_timeout(200)
        check(await pg.locator('.faction-offer').count()==0, f'{count}-faction drag offer does not nag on second same-type room')

    rid = await pg.evaluate('rid')
    await ring(rid)
    nf = await pg.evaluate("new Set(Object.keys(tw.lib.objects).filter(c => c.startsWith('flavor-')).flatMap(c => tw.lib.objects[c].skus || []).filter(k => k.url).map(k => k.shape || k.sku?.split('--')[1]).filter(Boolean)).size")  # (core/faction-catalog.js: every faction some flavor slot has a piece of)
    fl = await pg.evaluate("({ f: tw.ringFlyout(), st: tw.ringState(), w: tw.ringWarnings() })")
    check(fl['f'] and fl['f']['group'] == 'faction' and fl['st'] == 'nested' and await pg.locator(CHOICES).count() == nf and await pg.locator(INHERIT).count() == 1 and not any('3–6' in w or 'overlap' in w for w in fl['w']), 'room ☰ opens the Faction picker: the ring grown outward, one button per faction (and inheritance), nothing overlapping or in the 3–6 sector', {'factions': nf, 'buttons': await pg.locator(CHOICES).count(), 'ring': fl})
    # Real delivered emblem files, before the four/thirteen synthetic discovery fixtures.
    installed = await pg.evaluate('''() => {
      const rows=Array.isArray(tw.lib.factions)?tw.lib.factions:Object.values(tw.lib.factions||{});
      return rows.filter(f=>f.available && f.emblem?.includes('assets/emblems/')).length;
    }''')
    if installed:
        await pg.wait_for_function('''() => [...document.querySelectorAll('#ring .rbtn[data-nest][data-faction] img.pic')].every(i=>i.complete && i.naturalWidth>0)''')
        delivered = await pg.locator('#ring .rbtn[data-nest][data-faction] img.pic').evaluate_all("es=>es.filter(i=>i.src.includes('/assets/emblems/')).length")
        check(delivered == installed, 'every installed faction emblem loads in the real picker', {'installed':installed,'loaded':delivered})
        await snap(pg, 'picker-delivered-emblems')
    check(await pg.locator(INHERIT).get_attribute('data-tip') == "As the building's", 'room picker offers building inheritance')
    await pick('moon')
    check(await pg.evaluate('tw.ent(rid).recipe.flavor === "moon"'), 'room picker Moon button logs faction change')
    await ring(rid)
    check(await pg.locator('#ring [data-faction="moon"]').get_attribute('aria-pressed') == 'true', 'explicit room faction is visibly selected')
    await pg.locator(INHERIT).click(); await idle()
    await ring(rid)
    dashed = await pg.evaluate("[...document.querySelectorAll('#ring .rbtn[data-nest].inherited')].map(b => [b.dataset.faction, getComputedStyle(b).borderTopStyle])")
    check(await pg.locator(INHERIT).get_attribute('aria-pressed') == 'true' and len(dashed) == 1 and dashed[0][1] == 'dashed', 'inherit state has pressed inheritance button and dashed emblem', dashed)
    await snap(pg, 'ring-room-inherit')

    bid = await pg.evaluate('Object.values(tw.entities()).find(e=>e.kind==="building" && e.gen?.code==="TEM")?.id')
    if bid:
        await ring(bid)
        check(await pg.locator(INHERIT).count() == 0 and await pg.locator(CHOICES).count() > 0, 'building ring offers explicit factions without parent inheritance')
        await pick('devils')
        check(await pg.evaluate('id=>tw.ent(id).flavor==="devils"', bid), 'building ☰ Devil button logs faction change')
    else:
        check(False, 'temple building fixture exists for ring coverage')

    banner = await pg.evaluate('Object.values(tw.entities()).find(e=>e.room===rid && e.cat==="flavor-banner").id')
    await ring(banner)
    check(await pg.locator(INHERIT).get_attribute('data-tip') == "As the room's", 'banner ☰ offers room inheritance')
    before = await pg.evaluate('id=>JSON.stringify([tw.ent(id).x,tw.ent(id).z,tw.ent(id).rot,tw.ent(id).s])', banner)
    await pick('spiders')
    check(await pg.evaluate('id=>tw.ent(id).sku.endsWith("--spiders")', banner), 'single-banner ring swaps to spiders')
    check(before == await pg.evaluate('id=>JSON.stringify([tw.ent(id).x,tw.ent(id).z,tw.ent(id).rot,tw.ent(id).s])', banner), 'banner ring preserves position, turn and scale')
    await ring(banner); await pg.locator(INHERIT).click(); await idle()

    await shelf()
    check(await pg.locator('#factionShelf .faction-shelf-row').count() >= 4, 'Build Factions button opens faction rows')
    await pg.wait_for_function('document.querySelectorAll("#factionShelf [data-preview].live").length >= 20', timeout=60000)
    await pg.wait_for_timeout(600)
    check(await pg.evaluate('tw.previewsDrawn >= 20 && document.querySelector("#factionShelf").parentElement === document.querySelector("#pv").parentElement'), 'shelf draws loaded model previews in the canvas stacking context')
    check(await pg.locator('#factionShelf .faction-flat').evaluate_all('(es)=>es.length>=12 && es.every(e=>e.complete && e.naturalWidth>0)'), 'shelf flat marks show face-on pictures')
    await snap(pg, 'shelf')
    before_ids = await pg.evaluate('Object.keys(tw.entities())')
    await pg.locator('#factionShelf [data-faction="spiders"] button[aria-label="Spider banner"]').click()
    check(await pg.evaluate('!!tw.mode'), 'shelf banner click enters placement')
    # Ground just outside the original nave: an actual canvas press places the selected library SKU.
    point = await pg.evaluate('''() => {
      const r=tw.ent(rid).recipe, x=(r.x+r.w/2)*5,z=(r.z+r.d+3)*5;
      const g=tw.main.grab;g.focus.set(x,0,z);g.dist=70;g.pitch=70;g.update();
      return tw.screenOf(x,z,tw.main,0);
    }''')
    await pg.wait_for_timeout(300)
    await pg.mouse.click(point['x'], point['y']); await idle()
    check(await pg.evaluate('old=>Object.values(tw.entities()).some(e=>!old.includes(e.id)&&e.cat==="flavor-banner"&&e.sku.endsWith("--spiders"))', before_ids), 'shelf Spider banner placed by canvas click')
    await pg.keyboard.press('Escape')

    # Exercise newly delivered factions through the real relay, before cosmetic discovery fixtures.
    delivered_ids = await pg.evaluate("() => { const fs=Array.isArray(tw.lib.factions)?tw.lib.factions:Object.values(tw.lib.factions||{}); return fs.filter(f=>f.available && !['sun','moon','devils','spiders'].includes(f.id)).map(f=>f.id); }")
    original_flavor = await pg.evaluate("tw.ent(rid).recipe.flavor || 'inherit'")
    for faction in delivered_ids:
        await pg.evaluate('(f)=>tw.setFaction(rid,f)', faction); await idle()
        result = await pg.evaluate("""f => {
          const ps=Object.values(tw.entities()).filter(e=>e.room===rid && e.cat?.startsWith('flavor-') && !e.factionMissing);
          return {chosen:tw.ent(rid).recipe.flavor, count:ps.length, mismatches:ps.filter(e=>tw.lib.objects[e.cat]?.skus.find(k=>k.sku===e.sku)?.shape!==(e.flavor||f)).map(e=>({id:e.id,sku:e.sku,override:e.flavor}))};
        }""", faction)
        check(result['chosen']==faction and result['count']>0 and not result['mismatches'], 'delivered faction accepted by relay and applied: '+faction, result)
    if delivered_ids:
        await pg.evaluate('(f)=>tw.setFaction(rid,f)', original_flavor); await idle()

    # Cosmetic fixtures only: clone real sigils so fake factions have valid images; never submit them.
    # Restore exact data references in finally, including when an assertion/gesture fails.
    await pg.evaluate('''() => {
      window.factionUIBackup={objects:tw.lib.objects,factions:tw.lib.factions};
      const ids=['sun','moon','spiders','devils'];
      const objects={...tw.lib.objects};
      for(const [cat,o] of Object.entries(objects)) if(cat.startsWith('flavor-'))
        objects[cat]={...o,skus:o.skus.filter(k=>ids.includes(k.shape))};
      tw.lib.objects=objects;
      tw.lib.factions=Array.isArray(tw.lib.factions) ? Object.fromEntries(tw.lib.factions.filter(f=>ids.includes(f.id)).map(f=>[f.id,f])) : {...tw.lib.factions};
    }''')
    try:
        await pg.evaluate("tw.offerFaction(rid)")  # may already have been seen; ring is the durable route
        await ring(rid); await snap(pg, 'picker-4')
        check(await pg.locator(CHOICES).count() == 4, 'four-faction picker fixture uses four emblems')
        await offer_fixture('temple-shrine', 64, 4, 'offer-4')
        await pg.evaluate('''() => {
          const cat=tw.lib.objects['flavor-sigil'], src=cat.skus[0];
          for(let i=0;i<9;i++) {
            const id='test-emblem-'+i;
            cat.skus.push({...src,shape:id,sku:'flavor-sigil--'+id});
            tw.lib.factions[id]={label:'Test emblem '+i,group:i<5?'neutral':'sinister'};
          }
        }''')
        await ring(rid)
        check(await pg.locator(CHOICES).count() == 13, 'nine data-only factions appear without picker code changes')
        lay = await pg.evaluate("""(() => { const els = [...document.querySelectorAll('#ring .rbtn[data-nest][data-faction]')], bs = els.map(b => b.getBoundingClientRect()), ns = tw.ringNodes(), main = ns.find(n => !['nested', 'conditions', 'faction'].includes(n.key) && n.curve)?.curve, nest = ns.filter(n => ['nested', 'conditions', 'faction'].includes(n.key)).map(n => n.curve);
          const pairs = []; bs.forEach((a, i) => bs.forEach((b, j) => { if (j > i && Math.hypot(a.left + a.width / 2 - b.left - b.width / 2, a.top + a.height / 2 - b.top - b.height / 2) < (a.width + b.width) / 2 - 2) pairs.push([els[i].dataset.faction, els[j].dataset.faction, [a.left, a.top, a.width].map(Math.round), [b.left, b.top, b.width].map(Math.round)]); }));
          return { n: bs.length, overlap: pairs.length > 0, pairs, nodes: ns.filter(n => ['nested', 'conditions', 'faction'].includes(n.key)).map(n => [n.id, Math.round(n.x), Math.round(n.y), Math.round(n.size), n.curve && Math.round(n.curve.rx)]), grown: !!main && nest.length === bs.length && nest.every(k => k && k.rx > main.rx && k.ry > main.ry), warn: tw.ringWarnings() }; })()""")
        check(lay['n'] == 14 and lay['grown'] and not lay['overlap'] and not any('3–6' in w for w in lay['warn']), 'thirteen factions (and inheritance) stay one grown ring: no two buttons overlap, none in the 3–6 sector', lay)
        check(await pg.locator(CHOICES).evaluate_all('(bs)=>bs.every(b=>!b.textContent.trim()&&b.title&&b.getAttribute("aria-label"))'), 'thirteen-faction picker remains icons only')
        await snap(pg, 'picker-13')
        await offer_fixture('cathedral', 78, 13, 'offer-13')
        await shelf()
        fake = pg.locator('#factionShelf [data-faction="test-emblem-0"]')
        await fake.scroll_into_view_if_needed()
        check(await fake.count() == 1 and await fake.locator('.faction-gap').count() >= 7, 'data-only faction shelf shows missing-slot gaps')
        check(await fake.locator('button').count() == 1, 'partial faction shelf exposes only its real sigil')
        await snap(pg, 'shelf-missing-slots')
    finally:
        await pg.evaluate('''() => {
          tw.library.hideFactions();tw.condButtons.hide('faction');
          tw.lib.objects=factionUIBackup.objects;tw.lib.factions=factionUIBackup.factions;
          delete window.factionUIBackup;tw.modes.cancel();tw.clearSelection();
        }''')
        await pg.keyboard.press('Escape')
