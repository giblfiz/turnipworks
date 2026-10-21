# Pipeline evidence, 2026-10-13

Prepared native-OpenAI plate ingestion and copied the proven Lair pod/QA tools with corrected shallower root paths. All shell scripts pass `bash -n`, all Python scripts compile, ingest CLI loads under the BiRefNet environment. RunPod key is available without reading credential files; Blender, runpodctl and the shared heavy-work limiter are installed. No pod has been created; spend is $0 so far.

Five initial plates accepted: sun/moon/devils/spiders corbels and replacement sun idol. All five were independently named at 110px by an unprimed Gemini observer as the intended architectural object and motif. Exact descriptions and full semantic/mask outcomes are in `../plate-qa/`. Sun idol reads as a solar monument or sun pillar, not wheel/throne. Native transparency passes visually: the alleged idol glow does not show on the 512px magenta composite. One mask-model error was overridden: it claimed the spider bracket terminal was cropped, but alpha>127 bbox ends at y=1236 inside a 1292px image (56px lower clearance); direct Codex inspection of the composite confirms the whole pointed terminal. Raw negative verdict remains recorded alongside measured override.

The initial spec lacked `gate` fields, exposed by the first ingest attempt after its blind call. Added explicit object/motif/whole-form requirements and a preflight check so future missing gate data fails before vision. No plate regenerated because of that tooling error. Plate provenance retains the untouched generator PNG, exact prompt, empty references list (text-only generation), and SHA256.

Manifest adaptation must honor the explicit `shape` field: SKU suffix `sun-fct` is collision avoidance, while faction identity remains `sun`. Native-alpha images have a few near-zero-alpha pixels near frame borders; significant alpha bounding boxes retain margins. Do not use alpha>0 bbox alone to declare a crop.

Individual 31px icon gating added on parent request. Originals untouched; transparent square padding+Lanczos creates 31px blind candidates and 128/256px runtime copies. First 12 icons pass with no rerolls; sea/storm pending at this note. Step2 first 9 mesh plates pass (dragon/skulls/tentacles triples), making 14 accepted total. Read-only RunPod preflight: no pods, A100 80GB EUR-IS-1 Low stock at $1.79/hr; 4090 not currently offered. Still no pod created.

## Loader repair

Wave132903 stalled in expensive CPU model construction: at4m53 wall each of3 workers had509 threads, RSS5.1GB,36–43 CPU-minutes,154MB reads, GPU0%/4MiB. Logs only showed HF anonymous-client warning. Preserved logs in remote pre-thread-cap/, terminated only exact recorded worker PIDs1816/1817/1818 (verified exited), restarted5-input wave with OMP_NUM_THREADS/MKL_NUM_THREADS/OPENBLAS_NUM_THREADS/NUMEXPR_NUM_THREADS=4. Same pod and timers. Useful progress and measured benefit pending.

Repair verified useful GPU work resumed: capped workers had 14 threads at 41s (39–42s CPU), RSS grew 5.5→11→15.6GB as weights loaded. At 3m43 GPU was 100% with 49,220MiB used and logs showed sparse/shape sampling. Pod CPU quota is 27.2 cores: the original three pools totaled 1,527 threads. Keep the 4-thread environment caps in future batch launchers. A py-spy diagnostic install succeeded but stack attach was denied by missing SYS_PTRACE; process/GPU evidence sufficed, no privilege escalation attempted.

## Final harvest and accounting

32/32 source GLBs harvested; median mesh 37s, mean 57s including cold first outputs. One pod tshhjp0b8tq73t at $1.79/hour, 06:23:42–06:55:18 PDT, 0.527 hours, $0.94 by elapsed uptime×rate. Deleted immediately after final harvest; GET404 and `runpodctl pod list` returned []. Local timer cancelled. No second pod or timer extension. Account balance initially moved $0.91; use the explicit pod-rate estimate because balance settlement and volume billing differ.

The approved spider color grade revealed a concurrent-harvest race: rsync replaced the newer locally graded GLB with the older remote original. Changed harvest to rsync --update, restored grade, verified it survives later harvest, and re-ran source QA against SHA25691cc0a02109c4b598ff2682a0066a908a0985ef4f0255d065ed3c5a2f3e00907 (accepted). Original SHA2563c17545d616362647523e7e22a053d57cb71ac2c9ba2b4a3dc289efeb0ee416c remains in models-ungraded/. Geometry unchanged; runtime fingerprint gate correctly refused stale orientation during the race. Old source QA evidence is retained in Git and qa/history.jsonl.
