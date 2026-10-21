"""Headless check: load the viewer, pose closed/open/mid, screenshot, and measure hinge geometry in-page.
usage: browser-venv/bin/python test/check.py URL OUTDIR [--phone]"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

url, out = sys.argv[1], Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
phone = "--phone" in sys.argv
MEASURE = """() => {
  const T = window.__oc; const res = {};
    for (const [id, st] of Object.entries(T.stations)) {
    if (st.asset.mode !== 'hinge') continue;
    st.holder.updateMatrixWorld(true);
    const box = o => { const b = new (st.holder.position.constructor === undefined ? null : Object)(); return null; };
    const bb = o => { let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9]; o.updateMatrixWorld(true);
      o.traverse(n => { if (!n.isMesh) return; const p = n.geometry.attributes.position; const v = n.position.clone();
        for (let i=0;i<p.count;i+=3){ v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld); const a=[v.x,v.y,v.z];
          for(let k=0;k<3;k++){ mn[k]=Math.min(mn[k],a[k]); mx[k]=Math.max(mx[k],a[k]); } } }); return {mn:mn.map(x=>+x.toFixed(3)), mx:mx.map(x=>+x.toFixed(3))}; };
    // lid/leaf vertices that sit inside the static part's box, excluding a small band at the hinge
    const sb = bb(st.static[0]);
    const pv = st.pivot.getWorldPosition(st.pivot.position.clone());
    let inside = 0, total = 0;
    st.moving.traverse(n => { if (!n.isMesh) return; const p = n.geometry.attributes.position; const v = n.position.clone();
      for (let i=0;i<p.count;i+=3){ v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld); total++;
        if (v.distanceTo(pv) < 0.25) continue;
        const m = 0.02;
        if (v.x>sb.mn[0]+m && v.x<sb.mx[0]-m && v.y>sb.mn[1]+m && v.y<sb.mx[1]-m && v.z>sb.mn[2]+m && v.z<sb.mx[2]-m) inside++; } });
    res[id] = { value: st.value, static: sb, moving: bb(st.moving), pivot: [pv.x,pv.y,pv.z].map(x=>+x.toFixed(3)), inside, total };
  }
  return res;
}"""
with sync_playwright() as p:
    for attempt in range(2):
        try:
            b = p.chromium.launch(args=["--no-sandbox"])
            vp = {"width": 390, "height": 844} if phone else {"width": 1400, "height": 900}
            pg = b.new_page(viewport=vp)
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.goto(url, wait_until="networkidle")
            pg.wait_for_function("window.__oc && (window.__oc.ready || window.__oc.errors.length)", timeout=60000)
            report = {"errors": errs + pg.evaluate("window.__oc.errors"), "ready": pg.evaluate("window.__oc.ready")}
            sw = pg.evaluate("document.documentElement.scrollWidth > innerWidth")
            report["horizontal_scroll"] = sw
            for name, v in (("closed", 0), ("mid", 0.5), ("open", 1)):
                pg.evaluate(f"void window.__oc.pose({v})")
                time.sleep(0.6)
                pg.locator("#view").screenshot(path=str(out / f"{'phone-' if phone else ''}{name}.png"))
                if not phone:
                    report[name] = pg.evaluate(MEASURE)
            if not phone:
                # zoomed per-station open shots for vision triage
                pg.evaluate("void window.__oc.pose(1)")
                for sid in ("chest-parts-raw", "chest-multi-trellis", "chest-cut", "chest-swap", "door-demo"):
                    for v, nm in ((1, "open"), (0, "closed"), (0.5, "mid")):
                        pg.evaluate(f"void window.__oc.pose({v})")
                        pg.evaluate(f"void window.__oc.focus('{sid}', 0.6, 0.75)")
                        time.sleep(0.5)
                        pg.locator("#view").screenshot(path=str(out / f"{sid}-{nm}.png"))
                pg.evaluate("void window.__oc.pose(1)")
                for sid in ("chest-parts-raw", "chest-multi-trellis"):
                    pg.evaluate(f"void window.__oc.focus('{sid}', 2.6, 0.5)")  # from behind: the hinge
                    time.sleep(0.5)
                    pg.locator("#view").screenshot(path=str(out / f"{sid}-hinge-back.png"))
                # raw/patched toggle on station 1
                pg.locator('.card[data-id="chest-parts-raw"] .var[data-i="1"]').click()
                time.sleep(0.4)
                report["variant_after_click"] = pg.evaluate("[window.__oc.stations['chest-parts-raw'].active, window.__oc.stations['chest-parts-raw'].rigs.map(r=>r.root.visible)]")
                pg.evaluate("void window.__oc.pose(1)")
                pg.evaluate("void window.__oc.focus('chest-parts-raw', 0.6, 0.75)")
                time.sleep(0.5)
                pg.locator("#view").screenshot(path=str(out / "chest-parts-patched-open.png"))
                pg.locator('.card[data-id="chest-parts-raw"] .var[data-i="0"]').click()
                pg.evaluate("void window.__oc.focus('chest-cut', 2.6, 0.5)")
                time.sleep(0.5)
                pg.locator("#view").screenshot(path=str(out / "chest-cut-hinge-back.png"))
                pg.evaluate("void window.__oc.focus(null)")
                # interaction: click a toggle and confirm the state text changes over time
                pg.evaluate("void window.__oc.pose(0)")
                pg.locator('.card[data-id="chest-parts-raw"] .toggle').click()
                time.sleep(1.5)
                report["toggle_state_after_click"] = pg.locator('.card[data-id="chest-parts-raw"] .state').inner_text()
                report["toggle_value_after_click"] = pg.evaluate("window.__oc.stations['chest-parts-raw'].value")
                pg.locator('#all-cycle').click()
                time.sleep(12)
                report["cycle_values"] = pg.evaluate("Object.fromEntries(Object.entries(window.__oc.stations).map(([k,s])=>[k,+(s.value||0).toFixed(2)]))")
            b.close()
            break
        except Exception as e:  # software GL can crash: retry once
            print("attempt", attempt, "failed:", e)
            try: b.close()
            except Exception: pass
            if attempt == 1: raise
(out / f"report{'-phone' if phone else ''}.json").write_text(json.dumps(report, indent=1))
print(json.dumps(report, indent=1)[:4000])
