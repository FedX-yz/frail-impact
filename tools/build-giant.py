#!/usr/bin/env python3
"""Cut the Red Giant's layered art (the REDGIANT zip: body, head, eye layers, upper arm,
lower arm, hand) into game-sized pieces and write the rig that puts them together.

    python3 tools/build-giant.py <folder with the REDGIANT_*.png files>

Writes public/enemies/giant/*.png and src/combat/giantRig.js.

Everything is laid out in "art units": the friend's reference animation (1158×686, the parts
drawn at 0.16 of their size). The placements below were fitted to that animation's first frame
(every piece's scale, angle, mirror and spot), so the resting pose matches it exactly. The
right arm is the same three pieces as the left, mirrored. The arms are two-bone chains:
shoulder → elbow → wrist, and each piece rides on its bone (BattleArena → GiantRig).
"""
import json, math, os, sys
from PIL import Image
import numpy as np, cv2

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'enemies', 'giant')
SC = 0.16          # art units per source pixel
EXPORT = 0.22      # exported pictures: a bit sharper than the art scale (big screens draw him up to ×1.25)
os.makedirs(OUT, exist_ok=True)

FILES = {'body': 'REDGIANT_BODY', 'head': 'REDGIANT_HEAD', 'upper': 'REDGIANT_UPPERARM',
         'lower': 'REDGIANT_LOWERARM', 'hand': 'REDGIANT_HAND', 'eyes1': 'RED GIANT_EYES1', 'eyes2': 'REDGIANT_EYES2'}
img = {k: Image.open(os.path.join(SRC, v + '.png')).convert('RGBA') for k, v in FILES.items()}
size = {k: im.size for k, im in img.items()}

# where each piece sits in the reference (PIL-style: scale, rotate CCW by ang with expand, top-left x, y)
PLACE = {
    'body':   ('body', 0, False, 118, 74),
    'head':   ('head', 0, False, 192, 26),
    'lupper': ('upper', 12, False, 24, 218),
    'llower': ('lower', -48, False, -12, 382),
    'lhand':  ('hand', -48, False, -28, 206),
    'rupper': ('upper', 28, True, 522, 150),
    'rlower': ('lower', 0, True, 788, 376),
    'rhand':  ('hand', 0, True, 974, 232),
}
def center(part):
    n, ang, fl, x, y = PLACE[part]
    W, H = size[n]; w, h = W * SC, H * SC; a = math.radians(ang)
    nw = abs(w * math.cos(a)) + abs(h * math.sin(a)); nh = abs(w * math.sin(a)) + abs(h * math.cos(a))
    return [x + nw / 2, y + nh / 2]

# the arms' joints at rest (art units): shoulder, elbow, wrist
JOINTS = {'l': {'S': [110, 300], 'E': [178, 620], 'W': [93, 442]},
          'r': {'S': [678, 240], 'E': [803, 480], 'W': [1011, 430]}}

def save(name, im, scale=EXPORT):
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
    return 'enemies/giant/' + name + '.png'   # (the whole path: the build turns it into a WebP and points the code at it)

files = {k: save(k, img[k]) for k in ('body', 'head', 'upper', 'lower', 'hand')}

# each eye's pupil, cut out on its own so it can look around (the eyeballs are on the head)
eyes = []
for layer, big in (('eyes1', True), ('eyes2', False)):
    A = (np.array(img[layer])[:, :, 3] > 20).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(A)
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if area < 500: continue
        pad = 6
        box = (max(0, x - pad), max(0, y - pad), min(A.shape[1], x + w + pad), min(A.shape[0], y + h + pad))
        crop = img[layer].crop(box)
        m = (lab[box[1]:box[3], box[0]:box[2]] == i)          # just this eye (not a neighbour's edge)
        arr = np.array(crop); arr[:, :, 3] = arr[:, :, 3] * m; crop = Image.fromarray(arr)
        eyes.append({'big': big, 'c': [(box[0] + box[2]) / 2 * SC, (box[1] + box[3]) / 2 * SC],
                     'w': (box[2] - box[0]) * SC, 'h': (box[3] - box[1]) * SC, 'crop': crop})
eyes.sort(key=lambda e: (not e['big'], e['c'][0]))          # the two big ones first, left to right
for i, e in enumerate(eyes):
    e['src'] = save(f'eye{i}', e.pop('crop'))
    e['look'] = 9 if e['big'] else 4                          # how far the pupil can move (art units)
    e['c'] = [round(v, 1) for v in e['c']]; e['w'] = round(e['w'], 1); e['h'] = round(e['h'], 1)

def piece(part):
    n, ang, fl, x, y = PLACE[part]
    W, H = size[n]
    return {'src': files[n], 'w': round(W * SC, 1), 'h': round(H * SC, 1), 'flip': fl,
            'c': [round(v, 1) for v in center(part)], 'rot': -ang}   # CSS degrees (clockwise)

# far away behind the city (the stages before his): the resting pose, dark and hazy, eyes lit
def far(width=900):
    k = width / 1158
    canvas = Image.new('RGBA', (width, round(716 * k)), (0, 0, 0, 0))
    for part in ['body', 'lupper', 'rupper', 'rlower', 'rhand', 'llower', 'lhand', 'head']:
        n, ang, fl, x, y = PLACE[part]
        im = img[n].transpose(Image.FLIP_LEFT_RIGHT) if fl else img[n]
        im = im.resize((round(im.width * SC * k), round(im.height * SC * k)), Image.LANCZOS).rotate(ang, expand=True, resample=Image.BICUBIC)
        canvas.alpha_composite(im, (round(x * k), round(y * k)))
    for layer in ('eyes1', 'eyes2'):
        n, ang, fl, x, y = PLACE['head']
        im = img[layer].resize((round(img[layer].width * SC * k), round(img[layer].height * SC * k)), Image.LANCZOS)
        canvas.alpha_composite(im, (round(x * k), round(y * k)))
    a = np.array(canvas).astype(np.float32)
    rgb, al = a[:, :, :3], a[:, :, 3:]
    green = ((rgb[:, :, 1] > 140) & (rgb[:, :, 1] > rgb[:, :, 0] + 25)).astype(np.float32)[:, :, None]
    dark = rgb * np.array([0.3, 0.25, 0.36]) + np.array([10, 5, 14])
    out = dark * (1 - green) + rgb * green
    glow = cv2.GaussianBlur(green[:, :, 0] * al[:, :, 0] / 255, (0, 0), 3 * width / 900)[:, :, None]
    out = np.clip(out + glow * np.array([120, 200, 40]) * 0.8, 0, 255)
    Image.fromarray(np.concatenate([out, al], 2).astype(np.uint8)).save(os.path.join(OUT, 'far.png'), optimize=True)
far()

hx, hy = PLACE['head'][3], PLACE['head'][4]
rig = {
    'size': [1158, 716],
    'body': piece('body'),
    'head': {**piece('head'), 'pivot': [383, 282]},             # the neck
    'eyes': [{**e, 'c': [round(e['c'][0] + hx, 1), round(e['c'][1] + hy, 1)]} for e in eyes],   # (art units)
    'arms': {s: {'S': JOINTS[s]['S'], 'E': JOINTS[s]['E'], 'W': JOINTS[s]['W'],
                 'upper': piece(s + 'upper'), 'lower': piece(s + 'lower'), 'hand': piece(s + 'hand')} for s in 'lr'},
    'order': ['body', 'lupper', 'rupper', 'rlower', 'rhand', 'llower', 'lhand', 'head'],
}
js = ("// Made by tools/build-giant.py from the Red Giant's layered art: don't edit by hand.\n"
      "// Art units: the reference animation's frame (1158×686, pieces at 0.16 of their size).\n"
      f"export const GIANT_RIG = {json.dumps(rig, separators=(',', ':'))};\n")
open(os.path.join(ROOT, 'src', 'combat', 'giantRig.js'), 'w').write(js)
print('pieces', files, 'eyes', len(eyes))
for e in rig['eyes']: print(' eye', e['big'], e['c'], e['w'], e['h'])
for s in 'lr':
    a = rig['arms'][s]; L1 = math.dist(a['S'], a['E']); L2 = math.dist(a['E'], a['W'])
    print(s, 'L1 %.0f L2 %.0f' % (L1, L2), 'hand centre', a['hand']['c'])
