#!/usr/bin/env python3
"""set/assets.json: one plate prompt per figure of the roster, in the figure set's own words (experiments/2026-10-06-
figures/set/assets.json: the same Geometry / Finish / Pose / NO BASE / Presentation text, so these stand beside the 518
as one set), the set's plain human body plate as the reference for build and paint, and the culture's people and period.
The rows carry what measure.py / set_qa.py read (kind, height_ft, shaft, base_ft, gate) and what the game's list wants
(name, group, cls, race, gender, tags, srd, setting, kin, role).
    python3 specs.py       -> set/assets.json"""
import json, re, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from common import *

# who the people are, per culture: features and colouring, said plainly (the body plate gives build and paint, not people)
PEOPLE = {
    'JPN': 'Japanese: East Asian features, warm light skin, straight black hair',
    'CHN': 'Chinese of the Qing capital: East Asian features, warm light-tan skin, straight black hair',
    'IND': 'Rajasthani: South Asian features, warm medium-brown skin, black hair',
    'NRS': 'Scandinavian: northern European features, fair ruddy skin',
    'MDE': 'of Mamluk Cairo and Damascus: Egyptian and Syrian Arab features, olive to light-brown skin, dark hair',
    'RUS': "East Slavic: eastern European features, fair skin",
    'MES': 'Nahua (Mexica): Indigenous Mesoamerican features, warm copper-brown skin, straight black hair',
}
PEOPLE_OF = {  # one figure whose people differ from the city's
    'cul-mde-mamluk-cavalier': 'a Mamluk, born on the Kipchak steppe and brought to Cairo as a boy: Turkic Central Asian features, light olive skin, dark hair',
}
ROBE = {'cul-chn-daoist-priest', 'cul-chn-mandarin', 'cul-chn-silk-merchant', 'cul-ind-jyotishi', 'cul-mde-alchemist', 'cul-mde-spice-merchant',
        'cul-jpn-sake-merchant'}

P = json.loads((FIGS / 'set/assets.json').read_text())
SAMPLE = next(a for a in P['assets'] if a['id'] == 'hero-fighter-human-f')['prompt']
STYLE = SAMPLE[SAMPLE.index('Geometry:'):SAMPLE.index('Pose:')].strip()
POSE = SAMPLE[SAMPLE.index('Pose:'):SAMPLE.index('Presentation for')].strip()
PRESENT = SAMPLE[SAMPLE.index('Presentation for'):SAMPLE.index('Specific design:')].strip()
MUST_NOT = next(a for a in P['assets'] if a['id'] == 'hero-fighter-human-f')['gate']['must_not']

BODY = ("The supplied image is the BODY REFERENCE for the people of this set: a plainly clothed figure. The new figure must have the "
        "SAME build and proportions (the same stout heroic-miniature body, head, hand and foot sizes), the same painting style, chunkiness, "
        "lighting, camera angle and flat blue background. It is a DIFFERENT person of a different people: the face, skin, hair and features "
        "are as described below, and it is dressed and equipped as described below instead of the reference's plain clothes.")
GRID_BODY = (next(a for a in P['assets'] if a['id'] == 'hero-fighter-elf-f')['prompt'].split('\n\n')[1]   # the house set's own body-plate paragraph
             + " Here the figure wears the period dress of a real place and time, described below, instead of fantasy adventuring gear.")
RESPECT = ("This person belongs to {period}. Dress, hair and gear belong to that time and place and are painted plainly and respectfully, "
           "the way a careful historical miniature is painted: an ordinary, dignified face with natural features, no caricature, no exaggerated "
           "or comic features, no costume-party version of the culture. No writing, letters, script, numbers or symbols anywhere on the figure "
           "or on anything it holds.")
ROBE_POSE = ("Feet shoulder-width apart, planted FLAT on the same level; the hem of the robe or skirt stops just above the ankles so both "
             "feet show under it.")


def build():
    out = []
    for r in roster():
        grid = r.get('race', 'human') != 'human'   # the grid's fantasy races (grid.py): the house set's own race words and body plate
        robe = r['id'] in ROBE or (r['gender'] == 'f' and r['role'] not in ('fighter', 'rogue')) or (grid and r['role'] == 'caster' and r['setting'] != 'JPN')
        people = r['people'] if grid else (PEOPLE_OF.get(r['id']) or PEOPLE[r['setting']])
        who = 'a woman' if r['gender'] == 'f' else 'a man'
        pose = POSE if not robe else re.sub(r'Feet shoulder-width apart with a clear gap between the legs, planted FLAT on the same level\.', ROBE_POSE, POSE)
        spec_head = (f"Specific design: {people}; this figure is {r['height_ft']} ft tall. Everything is sized to this body. It is dressed in the period dress below. " if grid else
                     f"Specific design: {who.capitalize()} of average build, {people}; this figure is {r['height_ft']} ft tall. Everything is sized to this body. ")
        prompt = (f"Create a new single asset in the Turnip Works house style (heroic hand-painted): a painted tabletop miniature FIGURE of "
                  f"{r['short'].lower()}, {who}, from {r['period']}.\n\n{GRID_BODY if grid else BODY}\n\n{RESPECT.format(period=r['period'])}\n\n{STYLE}\n\n{pose}\n\n{PRESENT}\n\n"
                  f"{spec_head}{r['design']}")
        group = 'townsfolk' if r['role'] == 'npc' else 'hero'
        out.append({
            'id': r['id'], 'object': r['id'], 'family': 'figures', 'group': group, 'source': 'generate', 'lane': '3d', 'generation': 'figure',
            'kind': 'robe' if robe else 'hum', 'subject': f"{r['short'].lower()}, {r['kin']}", 'height_ft': {'body': r['height_ft'], 'figure_top': r['height_ft'], 'overall': r['height_ft']},
            'shaft': r['shaft'], 'base_ft': 5, 'body': f"body-{r.get('race', 'human')}-{r['gender']}", 'name': r['name'], 'race': r.get('race', 'human'), 'gender': r['gender'], 'cls': r['cls'],
            'tags': r['tags'], 'srd': r['srd'], 'setting': r['setting'], 'kin': r['kin'], 'role': r['role'], 'tile': r.get('tile') or r['short'], 'lean': r.get('lean') or None, 'boss': group == 'hero',
            'refs': [str(FIGS / 'set/inputs' / f"body-{r.get('race', 'human')}-{r['gender']}.jpg")], 'gate_refs': [],
            'gate': {'desc': f"{who}: {r['short'].lower()} of {r['period']}", 'must': ['the whole figure head to toe, both feet visible'] + r['holds'] + ['fully painted in colour'], 'must_not': MUST_NOT},
            'prompt': prompt})
    SET.mkdir(exist_ok=True)
    (SET / 'assets.json').write_text(json.dumps({'assets': out}, indent=1, ensure_ascii=False) + '\n')
    print(len(out), 'specs;', sum(a['kind'] == 'robe' for a in out), 'robed')


if __name__ == '__main__':
    build()
