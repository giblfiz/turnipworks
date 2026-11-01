"""Shared by blind3.py and package3.py: which blind sheet a round-3 picture goes on, and that sheet's exact question."""
GROUP_OF = {'cond': 'cond', 'roof': 'roof', 'pawn': 'misc', 'object': 'misc', 'ground': 'misc'}
QUESTION = {
    'cond': "These are small status icons for a tabletop pawn, in the ring menu around a selected pawn of a browser 3D tabletop game. For each lettered icon: which D&D condition, or condition control (adding / removing a level, a custom condition), does it show?",
    'roof': "These are small unlabelled options in the contextual ring menu of a selected roof or building in a browser 3D tabletop game. For each lettered icon: which roof option does it offer (a roof material, a roof edge, a roof shape, or an action on a roof piece)?",
    'misc': "These are unlabelled buttons in the contextual ring menu around a selected piece (a pawn, a thing, a hill or a hole in the ground) in a browser 3D virtual tabletop. For each lettered icon: what action does it perform on the selected piece?"}
def batch_prompt(g):
    return (f"{QUESTION[g]} Each icon is shown at its real 31-pixel size on the menu's dark ground (#1c1f24); view it at that size. "
            "First read the letters under the icons. Then for each letter: describe the visible objects and marks, give your single best "
            "interpretation and confidence (low/medium/high), and one plausible alternative if ambiguous. Do not assume anything from file "
            "names. Be concise. End with one line per letter exactly in the form `X: <best interpretation> (<confidence>)`. "
            "(Batched blind sheet: up to eight icons of this kind side by side, shuffled, each the 67 px candidate.png.)")
