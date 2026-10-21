import sys, json, time
import mm, layout
from playwright.sync_api import sync_playwright
n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
rs, lots = layout.rooms(n); ext = layout.extent(rs)
mm.start_local()
try:
    with sync_playwright() as p:
        b, ctx, pg, errors, t = mm.open_game(p, campaign=f'TEST megamap {len(rs)} rooms (throwaway)')
        print('up in', round(t, 1), pg.evaluate(mm.GPU_JS), pg.evaluate('tw.roomgen.version'), pg.evaluate('String(tw.facesUsed)'))
        print('tw keys', pg.evaluate('Object.keys(tw).join(" ")'))
        print('world keys', pg.evaluate(f'Object.keys({mm.W}).join(" ")'))
        print('fx stats', pg.evaluate(f'JSON.stringify({mm.W}.fx.stats())'))
        pg.evaluate(mm.cam_js(ext['cx'], ext['cz'], 200))
        for r in rs:
            t0 = time.time()
            said = pg.evaluate("""([t,x,z,w,d,seed,y]) => { const said=[]; const t0=tw.toast; tw.toast=(m,bad)=>{said.push(String(m)); return t0(m,bad);}; let id=null, err=null; try { id = tw.spawnRoom(t,x,z,w,d,seed,undefined,y); } catch(e) { err=String(e&&e.stack||e); } tw.toast=t0; return {id, said, err}; }""", list(r[:7]))
            try: pg.wait_for_function(f"!!tw.entities()['{said['id']}'] && tw.sync.pendingCount() === 0", timeout=20000); ok = True
            except Exception: ok = False
            pg.wait_for_timeout(300)
            print(r[:7], 'ok' if ok else 'FAILED', round(time.time() - t0, 2), said['said'], said['err'], pg.evaluate("tw.toasts ? '' : ''"))
        print(mm.wait_settled(pg, 300))
        print(pg.evaluate(mm.COUNTS_JS))
        print('buildings', pg.evaluate("JSON.stringify(Object.values(tw.entities()).filter(e=>e.kind==='building').map(b=>[b.id,b.name]))"))
        print('stairs', pg.evaluate("Object.values(tw.entities()).filter(e=>e.place==='stair').length"))
        pg.screenshot(path=f'results/try-{n}.png')
        print(errors[:10])
        b.close()
finally: mm.stop()
