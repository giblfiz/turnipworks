#!/bin/sh
# the front sweep for run tem-01, in a tuner tree whose assets/m holds the run's runtime meshes (cd there first)
set -e
R=prep/orient-sweep-tem-01
python3 prep/ccm_prep.py tem-01 list
blender --background --python prep/orient_views.py -- $R/list.txt $R/views > $R/views.log 2>&1
python3 prep/orient_sheets.py $R/views $R/sheets 4 $(python3 prep/ccm_prep.py tem-01 skus) > $R/sheets.log 2>&1
~/.local/share/tw-birefnet-venv/bin/python prep/orient_ccm.py tem-01 > $R/orient.log 2>&1
