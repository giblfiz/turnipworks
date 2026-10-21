#!/usr/bin/env python3
"""Markdown tables from results/*.jsonl (the latest line per size wins).  python3 report.py > results/tables.md"""
import json, os
def rows(f): return [json.loads(l) for l in open(f)] if os.path.exists(f) else []
B = {}; 
for b in rows('results/build.jsonl'): B[b['counts']['room']] = b
M = {}
for m in rows('results/measure.jsonl'): M[m['rooms']] = m
sizes = sorted(M)
def f(v, d=1): return '—' if v is None else (f'{v:.{d}f}' if isinstance(v, float) else str(v))
def cell(v):
    if not isinstance(v, dict) or v.get('mean_ms') is None: return '—'
    return f"{v['mean_ms']:.0f}" + ('' if v.get('quiet') else '*') if v['mean_ms'] >= 10 else f"{v['mean_ms']:.1f}" + ('' if v.get('quiet') else '*')
print('### Build\n\n| rooms | buildings | objects | how | build s | s per room, first tenth | last tenth | relay CPU s | on disk MB |\n|--:|--:|--:|--|--:|--:|--:|--:|--:|')
for n in sorted(B):
    b = B[n]; c = (M.get(n) or {}).get('counts') or b['counts']
    print(f"| {n} | {c.get('building', b['buildings_planned'])} | {c.get('object', '—')} | {'GET API, no browser' if b.get('via') else 'GM tab'} | {b['build_s']} | {b['per_room_s_first_tenth']} | {b['per_room_s_last_tenth']} | {b['relay']['cpu_s']} | {b['relay']['disk_bytes_added'] / 1e6:.1f} |")
print('\n### Load (cold browser joining the finished map) and memory\n\n| rooms | objects | entities | game ready s | first frames s | everything streamed s | JS heap MB | GPU memory (our GPU process) MB | meshes | geometries | materials | textures (est. MB) | state JSON MB |\n|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|')
for n in sizes:
    m = M[n]; s = m.get('scene_default') or {}; c = m.get('counts') or {}
    if m.get('load_failed'): print(f"| {n} | load failed: {m['load_failed'][:80]} |"); continue
    print(f"| {n} | {c.get('object')} | {c.get('all')} | {f(m.get('ready_s'))} | {f(m.get('first_frames_s'))} | {f(m.get('all_streamed_s'))}{'' if m.get('settled') else ' (never settled)'} | {m.get('heap_mb')} | {m.get('gpu_mem_mb', '—')} | {s.get('meshes')} | {s.get('geometries')} | {s.get('materials')} | {s.get('textures')} ({s.get('texture_mb_est')}) | {m.get('state_json_mb')} |")
V = ['default', 'quarter', 'whole', 'roofs', 'roofs_whole', 'upper_cut', 'cellar', 'pan', 'hover', 'drag', 'labels_off', 'fog_off', 'fog_off_whole', 'shadows_off', 'fires_off', 'post_off']
print('\n### Frame time, ms per frame (mean; * = no GPU-quiet run was caught, read as an upper bound)\n\n| view | ' + ' | '.join(str(n) for n in sizes) + ' |\n|--|' + '--:|' * len(sizes))
for v in V: print(f'| {v} | ' + ' | '.join(cell((M[n].get('views') or {}).get(v)) for n in sizes) + ' |')
for label, key in (('p95 gap between frames, ms', 'p95_ms'), ('worst gap, ms', 'max_ms'), ('main-thread ms inside the frame callbacks', 'js_ms'), ('draw calls', 'draw_calls'), ('triangles (millions)', 'triangles')):
    print(f'\n### {label}\n\n| view | ' + ' | '.join(str(n) for n in sizes) + ' |\n|--|' + '--:|' * len(sizes))
    for v in V:
        def g(n):
            x = ((M[n].get('views') or {}).get(v) or {}).get(key)
            return '—' if x is None else (f'{x / 1e6:.1f}' if key == 'triangles' else f'{x:.0f}')
        print(f'| {v} | ' + ' | '.join(g(n) for n in sizes) + ' |')
print('\n### Scene at the default view\n\n| rooms | scene nodes | meshes | visible meshes | repeat draws (same mesh + material) | unique pairs | real lights | lit things | fire lights | volume fires | particle systems | shadow casters | programs | fog rooms |\n|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|')
for n in sizes:
    m = M[n]; s = m.get('scene_default') or {}; x = ((m.get('views') or {}).get('default') or {}).get('fx') or {}
    print(f"| {n} | {s.get('nodes')} | {s.get('meshes')} | {s.get('visible_meshes')} | {s.get('repeat_draws')} | {s.get('unique_mesh_material_pairs')} | {sum((s.get('lights') or {}).values())} | {x.get('lit')} | {x.get('fire_lights')} | {x.get('volume_fires')} | {x.get('particle_systems')} | {x.get('shadow_casters')} | {x.get('programs')} | {x.get('atmos_rooms')} |")
print('\n### Relay\n\n| rooms | boot s (all campaigns in the folder) | memory MB | idle CPU % | journal MB | snapshot MB | late joiner: game ready s | all entities s | everything streamed s | relay CPU s for the join | pawn move, ack ms |\n|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|')
for n in sizes:
    m = M[n]; r = m.get('relay') or {}
    print(f"| {n} | {m.get('relay_boot_s')} | {r.get('rss_mb')} | {r.get('cpu_pct_idle_one_client')} | {r.get('journal_mb')} | {r.get('snapshot_mb')} | {r.get('late_join_ready_s')} | {r.get('late_join_all_entities_s')} | {r.get('late_join_all_streamed_s')} | {r.get('late_join_relay_cpu_s')} | {r.get('token_move_ack_ms')} |")
