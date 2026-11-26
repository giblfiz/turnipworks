Bench output of the SPEED lane (2026-11-06/07). `*.txt` is what lightuse.py printed; `*.compare.txt` is
`tools/perf-bench/compare.py` of each run. The raw per-frame JSON (9 MB) is kept off the repo at
`/mnt/usb/turnip-works/lanes-2026-11-06/perf/results/`.
- baseline-*: main as it was (0543729f), Auto. The front web server = HD 4600; local = the build box RTX 3060 at load 25 to 45.
- levers-the front web server: the first A/B. CONFOUNDED (client code edited mid-run; see LAB_NOTES); kept for the dynres-alone finding.
- final-the front web server: the clean A/B: off, underMove, early, dynearly (dynres + early), on.
- shadow-the front web server-high: the fire's shadow on/off at High (the shadow-cache ceiling).
