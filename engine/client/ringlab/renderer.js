import { buildArcItems, fitToScreen, pointsOnArc, point, warnings, slideKeyframes, rowOf } from './model.js';
import { icon } from '../icons.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = name => document.createElementNS(NS, name);
export function manifestPaths(manifest, base, set, id) {
  if (set === 'line (current)') return [];
  const vars = manifest?.actions?.[id]?.variants?.filter(v => v.set === set) || [];
  return vars.sort((a, b) => (a.alt || 0) - (b.alt || 0)).map(v => new URL(v.sizes?.['62'] || v.file, base).href);
}
export async function loadManifest(base) {
  try { const r = await fetch(new URL('assets/ui-icons/manifest.json', base), { cache: 'no-store' }); return r.ok ? await r.json() : { sets: [] }; }
  catch { return { sets: [] }; }
}
export const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
export const sameCurve = (a, b, shiftA, shiftB) => a && b && Math.abs(a.rx - b.rx) < .01 && Math.abs(a.ry - b.ry) < .01
  && Math.abs((a.cx - shiftA[0]) - (b.cx - shiftB[0])) < .01 && Math.abs((a.cy - shiftA[1]) - (b.cy - shiftB[1])) < .01;
// A slide is real movement along the ellipse: keyframes every few px of curve, eased as a whole (Harry 2026-10-19:
// "the slide needs to be actual animated visual movement"). fill 'backwards' holds the start during the stagger delay.
export function slide(el, curve, s0, s1, shift0, shift1, timing, fade = 0, at = { x: 0, y: 0 }) {
  // transform + opacity only: the compositor plays it even while the main thread is busy with a heavy 3D frame
  // (left / top animations stall with it). `at` is where the element's own left / top put it.
  const frames = slideKeyframes(curve, s0, s1, { shift0, shift1 }).map(f => ({ offset: f.offset, transform: `translate(${f.x - at.x}px, ${f.y - at.y}px) translate(-50%, -50%)`, opacity: fade > 0 ? Math.min(1, f.offset * 3) : fade < 0 ? Math.max(0, 1 - f.offset * 1.4) : 1 }));
  return el.animate(frames, { ...timing, fill: fade < 0 ? 'forwards' : 'backwards' });
}
export function createRingRenderer(host, { manifestBase, onAction = () => {}, onDrag = () => {}, onCycle = () => {}, onWarnings = () => {} } = {}) {
  let drag = null, last = null, prev = null, trans = null;
  function draw({ settings, content, state = 'closed', nested = null, anchor, scale = 1, labelScale = 1, sector = false, pickIcons = false, manifest = { sets: [] }, compare = null, replay = false }) {
    if (drag) return host._warnings || [];
    const W = host.clientWidth, H = host.clientHeight;
    if (!W || !H || !anchor || !content) { host.replaceChildren(); return []; }
    const identity = JSON.stringify([settings, content, state, nested?.id, anchor.x|0, anchor.y|0, +scale.toFixed(4), sector, pickIcons, compare, replay]);
    if (identity === last) return host._warnings || [];
    last = identity; host.replaceChildren();
    // Size in the world: no screen fitting, the ring may run off the edge (the player moves the camera).
    const fitFor = (S, raw) => S.world?.on ? { nodes: raw, shift: [0, 0] } : fitToScreen(raw, W, H, S.edgeRule, 54);
    const display = (S, target, ghost = false) => {
      const raw = buildArcItems(S, content, ghost ? 'closed' : state, nested, scale, anchor);
      const fit = fitFor(S, raw);
      const nodes = fit.nodes, labels = [], tracks = [];
      if (sector && !ghost) { const shade = document.createElement('div'); shade.className = 'rl-sector'; shade.style.cssText = `left:${anchor.x}px;top:${anchor.y}px;width:${Math.max(0,W-anchor.x)}px;height:${Math.max(0,H-anchor.y)}px`; target.append(shade); }
      if (S.showGhost && state !== 'closed' && !ghost) {
        const old = fitFor(S, buildArcItems(S, content, 'closed', null, scale, anchor)).nodes;
        for (const n of old) { const g = document.createElement('div'); g.className='rl-ghost'; g.style.cssText=`left:${n.x}px;top:${n.y}px;width:${n.size}px;height:${n.size}px`; target.append(g); }
      }
      const motion = S.showMotion && state !== 'closed' && !ghost;
      // One curve: on a real open / close (or Replay), each button slides along the ellipse from where it was.
      const curveOn = !!S.curve?.on && !ghost && target === host.firstChild;
      let from = null;
      const contentKey = JSON.stringify([(content.primary || []).map(x => x.id), (content.secondary || []).map(x => x.id)]);
      const layoutOf = st => { const c = fitFor(S, buildArcItems(S, content, st, null, scale, anchor)); return { nodes: c.nodes, shift: c.shift, state: st }; };
      const now = performance.now();
      let elapsed = 0, animate = false;
      if (curveOn && !replay && prev?.curveOn && prev.contentKey === contentKey && prev.state !== state && ['closed', 'expanded'].includes(prev.state) && ['closed', 'expanded'].includes(state)) { from = prev; animate = true; }
      else if (curveOn && replay && state !== 'closed') { from = layoutOf('closed'); animate = true; }
      else if (curveOn && trans && trans.to === state && trans.contentKey === contentKey && now - trans.t0 < trans.longest) {
        // A redraw DURING a slide (the camera still gliding, a trackpad's momentum, a slider, a change from the table)
        // carries the slide on from where it is instead of snapping to the end: the same slide, laid out again at the
        // current anchor and settings, and seeked to the time already played (Harry 2026-10-20: "*sometimes* the
        // options-open animates and sometimes it doesn't").
        from = layoutOf(trans.from); animate = true; elapsed = now - trans.t0;
      }
      else if (curveOn && motion && state !== 'closed') from = layoutOf('closed');
      if (reducedMotion()) animate = false;
      const started = [];
      const fromById = new Map((from?.nodes || []).map(n => [n.item.id, n])), fromMenu = fromById.get('menu');
      const groupIndex = {}, C = S.curve || {};
      let longest = 0;
      // (tests) the main ellipse as drawn: with the edge rule's shift, like the buttons
      if (curveOn && nodes[0]?.curve) { const c = nodes.find(n => n.key !== 'conditions' && n.key !== 'faction' && n.key !== 'nested')?.curve; host._curve = c && { ...c, cx: c.cx + fit.shift[0], cy: c.cy + fit.shift[1], shift: fit.shift }; }
      for (const [i, n] of nodes.entries()) {
        const it = n.item, b = document.createElement('button'); b.type = 'button'; b.className = 'rl-button'; b.dataset.id = it.id; b.dataset.arc = n.key; b.title = it.label || it.title || it.id; b.setAttribute('aria-label', b.title);
        b.style.cssText = `left:${n.x}px;top:${n.y}px;width:${n.size}px;height:${n.size}px;--rl-hover:${S.hover || 1.1};--rl-press:${S.press || .94};--rl-dur:${n.arc.duration}ms;--rl-ease:${n.arc.easing};`;
        const paths = manifestPaths(manifest, manifestBase, S.iconSet, it.id);
        if (paths.length) { const img = document.createElement('img'); img.src = paths[(S.iconAlternates?.[it.id] || 0) % paths.length]; img.alt=''; b.append(img); b.classList.add('painted'); }
        else b.innerHTML = icon(it.icon || 'box', Math.round(n.size * .48));
        if (S.labelMode === 'hover' || S.labelMode === 'below') {
          const t = document.createElement('span'); t.className = 'rl-tip' + (S.labelMode === 'hover' || S.labelWhen === 'hovered' ? ' hovered' : ''); t.textContent = b.title;
          t.style.cssText = `font-size:${S.fontSize * labelScale}px;font-weight:${S.fontWeight};color:${S.labelColor};text-shadow:0 0 ${S.labelHalo}px #000`;
          b.append(t); if (S.labelMode === 'below' && S.labelWhen === 'always') labels.push({ x: n.x - 45 * labelScale, y: n.y + n.size/2 + 4, w: 90 * labelScale, h: (S.fontSize + 9) * labelScale });
        } else {
          const rr = Math.max(6, n.size/2 + S.labelOffset * labelScale) * (S.labelMode === 'under' ? .85 : 1.2);
          const svg = svgEl('svg'); svg.classList.add('rl-label-svg'); svg.setAttribute('width', W); svg.setAttribute('height', H);
          const path = svgEl('path'), id = `rl-path-${Math.random().toString(36).slice(2)}`; path.id=id; path.setAttribute('d', `M ${n.x-rr} ${n.y} A ${rr} ${rr} 0 0 1 ${n.x+rr} ${n.y}`); svg.append(path);
          const text = svgEl('text'), tp = svgEl('textPath'); tp.setAttribute('href', '#'+id); tp.setAttribute('startOffset','50%'); tp.textContent=b.title; text.append(tp);
          text.setAttribute('text-anchor','middle'); text.setAttribute('font-size',S.fontSize * labelScale); text.setAttribute('font-weight',S.fontWeight); text.setAttribute('fill',S.labelColor); text.setAttribute('stroke-width',S.labelHalo); svg.append(text); target.append(svg);
          labels.push({x:n.x-rr,y:n.y-rr,w:rr*2,h:rr});
        }
        if (curveOn && n.curve) {
          const old = fromById.get(it.id), gk = rowOf(n, state), gi = groupIndex[gk] = (groupIndex[gk] ?? -1) + 1;
          const timing = { duration: +C.duration || 0, delay: gi * (+C.stagger || 0), easing: C.easing || 'ease-in-out' };
          const src = old?.curve && sameCurve(old.curve, n.curve, from.shift, fit.shift) ? old : null;
          const enter = !src && n.key === 'secondary' && C.enter === 'from ☰' && fromMenu?.curve && sameCurve(fromMenu.curve, n.curve, from.shift, fit.shift) ? fromMenu : null;
          if (motion && (src || enter)) {
            const pts = slideKeyframes(n.curve, (src || enter).curve.s, n.curve.s, { shift0: from.shift, shift1: fit.shift }), path = svgEl('svg');
            path.classList.add('rl-label-svg', 'rl-curve-path'); path.setAttribute('width', W); path.setAttribute('height', H);
            const pl = svgEl('polyline'); pl.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' ')); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', '#ffe1a388'); pl.setAttribute('stroke-dasharray', '4 4'); path.append(pl); target.append(path);
          }
          if (animate && (src || enter)) { started.push(slide(b, n.curve, (src || enter).curve.s, n.curve.s, from.shift, fit.shift, timing, enter ? 1 : 0, n)); longest = Math.max(longest, timing.duration + timing.delay); }
          else if (animate && n.key !== 'closed') { started.push(b.animate([{ opacity: 0 }, { opacity: 1 }], { ...timing, fill: 'backwards' })); longest = Math.max(longest, timing.duration + timing.delay); }
        } else if (motion || (replay && state !== 'closed')) {
          const origin = n.arc.from === 'centre' ? anchor : n.arc.from === 'menu' ? nodes.find(x=>x.item.id==='menu') || anchor : fitFor(S, buildArcItems(S,content,'closed',null,scale,anchor)).nodes.find(x=>x.item.id===it.id) || anchor;
          if (motion) { const line = document.createElement('div'); line.className='rl-motion'; const dx=n.x-origin.x,dy=n.y-origin.y; line.style.cssText=`left:${origin.x}px;top:${origin.y}px;width:${Math.hypot(dx,dy)}px;transform:rotate(${Math.atan2(dy,dx)}rad)`; target.append(line); }
          if (replay) { b.animate([{left:origin.x+'px',top:origin.y+'px',opacity:0},{left:n.x+'px',top:n.y+'px',opacity:1}],{duration:n.arc.duration,delay:i*n.arc.stagger,easing:n.arc.easing,fill:'both'}); }
        }
        let suppressClick = false;
        b.addEventListener('click', ev => { ev.stopPropagation(); if (suppressClick) { suppressClick=false; return; } if (pickIcons) { onCycle(it.id); return; } onAction(it, n); });
        if (!ghost && (it.drag || ['pawn.damage','room.fog','edit.resize','edit.rotate','room.rotate','edit.lift','thing.tilt'].includes(it.id))) {
          b.addEventListener('pointerdown', ev => {
            if (pickIcons) return; ev.stopPropagation(); b.setPointerCapture(ev.pointerId);
            drag = { id: it.id, n, moved:false, start:{x:ev.clientX,y:ev.clientY}, value:0 };
            const samples = trackPoints(S.tracks, n, scale); const p0=samples[0], p1=samples.at(-1), rail=svgEl('svg'); rail.classList.add('rl-rail'); rail.setAttribute('width',W); rail.setAttribute('height',H);
            const path=svgEl('path'); path.setAttribute('d','M '+samples.map(p=>`${p.x} ${p.y}`).join(' L ')); rail.append(path); target.append(rail);
            if (S.tracks.ticks) for(let j=0;j<=10;j++){ const p=samples[j*2],tick=svgEl('circle');tick.setAttribute('cx',p.x);tick.setAttribute('cy',p.y);tick.setAttribute('r',j%5?2:3);rail.append(tick); }
            const read=document.createElement('output'); read.className='rl-track-read'; const rp=S.tracks.valuePosition==='button'?p0:S.tracks.valuePosition==='middle'?samples[10]:p1;read.style.cssText=`left:${rp.x}px;top:${rp.y+13}px`;read.textContent='0';target.append(read);
            tracks.push(...samples);
            onWarnings(warnings(nodes, samples, W, H, anchor, labels, 54));
            const move=e=>{const x=e.clientX,y=e.clientY; if(Math.hypot(x-drag.start.x,y-drag.start.y)>3)drag.moved=true; let best=0,dist=Infinity; samples.forEach((p,j)=>{const d=(p.x-x)**2+(p.y-y)**2;if(d<dist){dist=d;best=j;}}); const value=best/20; drag.value=value; read.textContent=String(onDrag(it,'preview',value,n) ?? Math.round(value*100));};
            b.onpointermove=move; b.onpointerup=e=>{b.onpointermove=null;b.onpointerup=null;suppressClick=drag.moved;if(drag.moved)onDrag(it,'commit',drag.value,n);drag=null;onWarnings(warnings(nodes, [], W,H,anchor,labels,54));};
          });
        }
        target.append(b);
      }
      if (animate) {
        const menuNow = nodes.find(x => x.item.id === 'menu');
        const ids = new Set(nodes.map(x => x.item.id));
        // Closing plays the opening backwards: what is no longer drawn runs back along the curve into ☰ and fades.
        for (const old of from.nodes) if (!ids.has(old.item.id) && old.curve && menuNow?.curve && sameCurve(old.curve, menuNow.curve, from.shift, fit.shift)) {
          const gi = groupIndex['leave:' + old.key] = (groupIndex['leave:' + old.key] ?? -1) + 1;
          const g = document.createElement('div'); g.className = 'rl-button rl-leaving'; g.style.cssText = `left:${old.x}px;top:${old.y}px;width:${old.size}px;height:${old.size}px;pointer-events:none`;
          g.innerHTML = icon(old.item.icon || 'box', Math.round(old.size * .48)); target.append(g);
          const timing = { duration: +C.duration || 0, delay: gi * (+C.stagger || 0), easing: C.easing || 'ease-in-out' };
          const a = slide(g, old.curve, old.curve.s, menuNow.curve.s, from.shift, fit.shift, timing, -1, old); a.onfinish = () => g.remove(); started.push(a);
          longest = Math.max(longest, timing.duration + timing.delay);
        }
        for (const el of target.querySelectorAll('.rl-label-svg:not(.rl-curve-path)')) started.push(el.animate([{ opacity: 0 }, { opacity: 0, offset: .9 }, { opacity: 1 }], { duration: longest + 80 }));
        if (elapsed) for (const a of started) a.currentTime = Math.min(elapsed, (a.effect.getComputedTiming().endTime || 0));
        else trans = { from: from.state, to: state, t0: now, longest, contentKey };
        host._anim = { from: from.state, to: state, start: trans.t0, duration: longest, carried: elapsed > 0 };
      }
      if (target === host.firstChild && !ghost) prevNext = { curveOn, contentKey, state, nodes, shift: fit.shift };
      const w = warnings(nodes, tracks, W,H,anchor,labels,54);
      return S.world?.on ? w.filter(x => x !== 'off screen') : w; // (world size: off screen is allowed, the player moves the camera)
    };
    let prevNext = null;
    const primary=document.createElement('div');primary.className='rl-plane';host.append(primary); let bad=display(settings,primary);
    prev = prevNext;
    if(compare){const side=document.createElement('div');side.className='rl-compare';side.innerHTML='<b>Preset B</b>';host.append(side);bad=[...new Set([...bad,...display(compare,side)])];}
    host._warnings=bad;return bad;
  }
  return { draw, clear:()=>{last=null;prev=null;trans=null;host.replaceChildren();}, invalidate:()=>{last=null;} };
}
function trackPoints(t,n,scale){const len=t.length*scale, base={x:n.x+t.x*scale,y:n.y+t.y*scale}; if(t.style==='arc'){const radius=Math.max(1,t.radius*scale),sweep=len/radius*180/Math.PI,a=t.angle*Math.PI/180;const c={x:base.x-radius*Math.sin(a),y:base.y+radius*Math.cos(a)};return Array.from({length:21},(_,i)=>point(c.x,c.y,radius,t.angle+sweep*i/20));}const a=t.angle*Math.PI/180;return Array.from({length:21},(_,i)=>({x:base.x+Math.sin(a)*len*i/20,y:base.y-Math.cos(a)*len*i/20}));}
