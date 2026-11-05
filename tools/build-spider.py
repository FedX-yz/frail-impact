#!/usr/bin/env python3
"""Cut DADDY HAIRY LEGS's layered art into game-sized pieces and write their metadata.

    python3 tools/build-spider.py <folder with the pieces, named as in PIECES below>

Writes public/enemies/spider/*.png and src/combat/spiderArt.js.

Art units: the friend's reference picture of the whole spider (2804×2149), where every piece is
drawn at 0.5 of its size. The body's layout (abdomen, the bulb under it, head, jaw) was fitted
to that picture; the legs are built from their pieces by the engine (spiderKin.js), joint to
joint, so each piece lists where its joints are (in the exported picture's pixels).
"""
import json, os, sys
from PIL import Image

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'enemies', 'spider')
ART = 0.5      # art units per source pixel
EX = 0.3       # exported picture: pixels per source pixel
os.makedirs(OUT, exist_ok=True)

# name: (source file, joints in source px)
#   femur: a = hip end, b = knee end      tibia: a = knee end, b = wrist end
#   hand:  a = wrist, b = toward the fingertips
#   knee:  a, b = along the knob           socket: a = its closed back, b = its opening
PIECES = {
    'abdomen': ('p12.png', {}),
    'bulb':    ('p13.png', {}),
    'head':    ('p10.png', {}),
    'jaw':     ('p9.png', {'hinge': (850 / 2, 40)}),
    'femurL':  ('p6.png', {'a': (1140, 750), 'b': (95, 105)}),
    'femurR':  ('p4.png', {'a': (280, 940), 'b': (1215, 190)}),
    'tibiaL':  ('p3.png', {'a': (590, 110), 'b': (100, 890)}),
    'tibiaR':  ('p5.png', {'a': (85, 70), 'b': (555, 880)}),
    'handA':   ('p1.png', {'a': (160, 100), 'b': (270, 500)}),
    'handB':   ('p2.png', {'a': (170, 70), 'b': (250, 500)}),
    'knee':    ('p11.png', {'a': (69, 32), 'b': (184, 234)}),
    'socketA': ('p7.png', {'a': (250, 40), 'b': (115, 300)}),
    'socketB': ('p8.png', {'a': (60, 90), 'b': (400, 270)}),
}
meta = {}
for name, (f, joints) in PIECES.items():
    im = Image.open(os.path.join(SRC, f)).convert('RGBA')
    W, H = im.size
    out = im.resize((max(1, round(W * EX)), max(1, round(H * EX))), Image.LANCZOS)
    out.save(os.path.join(OUT, name + '.png'), optimize=True)
    meta[name] = {'src': f'enemies/spider/{name}.png', 'w': out.width, 'h': out.height,
                  'art': [round(W * ART, 1), round(H * ART, 1)],   # its size in art units
                  **{k: [round(x * EX, 1), round(y * EX, 1)] for k, (x, y) in joints.items()}}

# the body, relative to the head's centre (the anchor), in art units: where each picture's centre goes
HEAD_C = (1490, 1322)
body = {
    'abdomen': [1388 - HEAD_C[0], 615 - HEAD_C[1]],
    'bulb': [1458 - HEAD_C[0], 1000 - HEAD_C[1]],
    'head': [0, 0],
    'jaw': [1492 - HEAD_C[0], 1709 - HEAD_C[1]],
}
js = ("// Made by tools/build-spider.py from DADDY HAIRY LEGS's layered art: don't edit by hand.\n"
      "// Pieces: exported picture size (w, h, px), size in art units (art), joints (in px of the\n"
      "// exported picture). body: where each body picture's centre goes, from the head's centre.\n"
      f"export const SPIDER_ART = {json.dumps({'ex': EX / ART, 'pieces': meta, 'body': body}, separators=(',', ':'))};\n")
open(os.path.join(ROOT, 'src', 'combat', 'spiderArt.js'), 'w').write(js)
print({k: (v['w'], v['h']) for k, v in meta.items()})
