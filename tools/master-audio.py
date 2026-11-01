#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# Masters the story's music, ambience and sound effects to the game's mix levels.
#
#   python3 tools/master-audio.py <folder with the raw downloads>
#
# Needs ffmpeg and Python with numpy. Writes public/audio/story/*.mp3,
# public/audio/story/amb/*.mp3 and public/sounds/<effect>.mp3.
#
# THE MIX (loudness as heard at default settings, EBU R128 / LUFS):
#   dialogue (voiced lines)  -17 LUFS          the anchor everything else sits around
#   story music              -24 LUFS          7 dB under dialogue; loud passages tamed
#   ambience (wind, crowd…)  -32…-34 LUFS      a bed under the music
#   sound effects            -16…-27 LUFS      by kind (loudest moment, 400 ms): impacts on
#                                              top, foley in the middle, background engines low
#   every file: true peak ≤ -1.5 dBTP, so nothing clips (the master has a safety limiter too)
# Music and ambience play through the music volume (×0.8) and their own gain (music ×0.8,
# ambience ×0.9 — VNPlayer), so their files are mastered that much louder. Effects play at
# unity (VNPlayer → playCue), so their files are mastered at their target.
# ─────────────────────────────────────────────────────────────────────────────
import json, math, os, re, subprocess, sys, tempfile
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SR = 44100
MUSIC_PLAY = 20 * math.log10(0.8 * 0.8)     # music gain × music volume
AMB_PLAY = 20 * math.log10(0.9 * 0.8)       # ambience gain × music volume

# name: (source file, loudness heard in game)
MUSIC = {
    'intro':     ('ytmp3_gg_1793539697985/18.mp3', -23.5),       # the opening crawl (no dialogue: a touch louder)
    'drive':     ('ytmp3_gg_1793539697985/2.mp3', -24),
    'hospital':  ('ytmp3_gg_1793539697985/9.mp3', -24),
    'birthday':  ('ytmp3_gg_1793539697985/22.mp3', -24),
    'test':      ('ytmp3_gg_1793539697985/16.mp3', -24),
    'cake':      ('ytmp3_gg_1793539697985/14.mp3', -24),
    'credits':   ('ytmp3_gg_1793539697985/11.mp3', -23),          # credits: nothing to read over
    'zdistrict': ('ytmp3_gg_1793539697985/neutral3.mp3', -24),
    'squad':     ('ytmp3_gg_1793539697985/7.mp3', -24),
}
# name: (source, start s, length s, loudness heard in game)
AMBIENCE = {
    'wind':  ('💨 Winter Storm Ambience with Icy Howling Wind Sounds for Sleeping, Relaxing and Studying Background.mp3', 5, 90, -33),
    'night': ('536724__shinyobjects__nighttime-ambiance.mp3', 600, 100, -34),
    'crowd': ('344952__ivolipa__murmur_on_ferry_3.wav', 3, 95, -32),
}
# name: (source, start s, end s or None, fade in s, fade out s, high-pass Hz, target)
#   target: loudest 400 ms in LUFS — or ('peak', dBTP) for sounds shorter than 400 ms
SFX = {
    'door_slam':     ('724123__saha213131__door-slam.wav', 0, None, 0.005, 0.6, 40, -16),            # impact
    'party_horn':    ('811914__kvv_audio__horncele_party-horn-01_kvv-audio_free.wav', 0, 1.3, 0.01, 0.25, 120, -18),
    'gasp':          ('353924__dr_skitz__gasp.wav', 0, None, 0.01, 0.2, 90, -20),                      # a voice: under the dialogue
    'candle_blow':   ('382667__bbrocer__man-blowing-candle-out.wav', 6.8, 8.5, 0.05, 0.4, 90, -21),
    'door_creak':    ('455324__rambler52__heavy-door-creaking_05.wav', 0, None, 0.02, 0.4, 50, -21),
    'paper_crumple': ('197179__razrox__paper-crumpled-001.wav', 0, None, 0.02, 0.4, 120, -22),
    'pack_tear':     ('529217__nox_sound__foley_paper_tearing.wav', 4.0, 5.0, 0.02, 0.2, 120, -22),
    'car_arrive':    ('Truck Engine Brake Sound Effect - Free Download & No Copyright - Sound Effects - No Copyright & Free Download (128k).mp3', 0, 4.0, 0.08, 1.6, 35, -23),
    'page_turn':     ('475679__thomas_weakley__paper-noises-waving-and-whipping-down.aiff', 3.0, 4.0, 0.02, 0.3, 150, -23),
    'paper_take':    ('445214__acheaa__paper-sounds.mp3', 0.2, 1.2, 0.02, 0.3, 150, -23),
    'card_flip':     ('817579__silverdubloons__slidecard04.wav', 0, None, 0.0, 0.05, 200, ('peak', -13)),
    'footsteps':     ('209478__sinatra314__footsteps_up_stairs_1.wav', 0, 3.4, 0.05, 0.8, 50, -26.5),
    'car_drive':     ('Large Truck Passing On Highway - Sound Effect for editing - Sound Library (128k).mp3', 3.0, 11.0, 2.0, 2.5, 35, -26),   # a pass-by in the distance
    'bus_idle':      ('Truck Engine Sound Effect - Sound effx (128k).mp3', 0, None, 0.4, 1.4, 35, -27),             # background
}

TP_CEIL = -1.5   # dBTP


def decode(path, ch, start=0, dur=None):
    args = ['ffmpeg', '-v', 'error', '-ss', str(start)] + (['-t', str(dur)] if dur else []) + ['-i', path, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-']
    raw = subprocess.run(args, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, ch).copy()


def run_filter(y, af):
    """y (n, ch) float32 → ffmpeg filter graph → (n', ch)."""
    ch = y.shape[1]
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-i', '-', '-af', af, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'],
                       input=y.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).reshape(-1, ch).copy()


def measure(y):
    """EBU R128 of y: integrated, loudness range, loudest momentary / short-term, true peak."""
    ch = y.shape[1]
    p = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-i', '-', '-af', 'ebur128=framelog=info:peak=true', '-f', 'null', '-'],
                       input=y.astype(np.float32).tobytes(), capture_output=True, text=False)
    err = p.stderr.decode('utf-8', 'replace')
    M = [float(x) for x in re.findall(r'M:\s*(-?[\d.]+)', err)]
    S = [float(x) for x in re.findall(r'S:\s*(-?[\d.]+)', err)]
    summ = err[err.rfind('Summary:'):]
    num = lambda pat: (lambda m: float(m.group(1)) if m and m.group(1) != '-inf' else None)(re.search(pat, summ))
    return dict(I=num(r'I:\s*(-?[\d.]+|-inf) LUFS'), LRA=num(r'LRA:\s*([\d.]+) LU'), TP=num(r'Peak:\s*(-?[\d.]+|-inf) dBFS'),
                M=max(M) if M else None, S=max(S) if S else None)


def db(x): return 10 ** (x / 20)


def limit(y):
    """Brick-wall the true peak to TP_CEIL (4× oversampled look, transparent at these levels)."""
    return run_filter(y, f'aresample={SR*4},alimiter=limit={db(TP_CEIL - 0.3):.4f}:attack=3:release=60:level=0:latency=1,aresample={SR}')


def fades(y, fin, fout):
    n = len(y); a = np.ones(n, dtype=np.float32)
    if fin > 0: k = max(1, int(fin * SR)); a[:k] = np.linspace(0, 1, k) ** 2
    if fout > 0: k = max(1, int(fout * SR)); a[-k:] *= np.linspace(1, 0, k) ** 2
    return y * a[:, None]


def trim_silence(y, floor_db=-50):
    env = np.abs(y).max(axis=1)
    on = np.nonzero(env > db(floor_db))[0]
    return y[on[0]:on[-1] + 1] if len(on) else y


def loop_seam(y, xf=3.0):
    """Make the file loop seamlessly: drop the first xf s and crossfade the last xf s into them,
    so the end flows straight back into the start (the first play fades in anyway)."""
    X = int(xf * SR)
    if len(y) < 4 * X: return y
    head, out = y[:X].copy(), y[X:].copy()
    w = np.linspace(0, 1, X, dtype=np.float32)[:, None]
    out[-X:] = out[-X:] * np.sqrt(1 - w) + head * np.sqrt(w)
    return out


def stage(y, lufs):
    return y * db(lufs - measure(y)['I'])


# compressors (rms detection, thresholds for material staged at -20 / -30 LUFS)
TAME_MUSIC = f"acompressor=threshold={db(-17):.4f}:ratio=2.5:attack=20:release=300:knee=6:makeup=1:detection=rms"
TAME_AMB = f"acompressor=threshold={db(-28):.4f}:ratio=4:attack=5:release=250:knee=4:makeup=1:detection=rms"


def to_level(y, target, key='I', caps=None):
    """Gain so the measure `key` lands on target — but with caps=(s, m), never so loud that the
    loudest 3 s / 400 ms go more than s / m LU over the target — then the true-peak limit."""
    for _ in range(2):
        m = measure(y)
        if m[key] is None: break
        g = target - m[key]
        if caps:
            g = min(g, target + caps[0] - m['S'], target + caps[1] - m['M'])
        y = limit(y * db(g))
    return y


def encode(y, out, kbps, target=None, key='I', caps=None):
    """Encode to MP3. With a target, the encoded file is measured and the level corrected: MP3
    loses a little treble, which the loudness meter weighs heavily (~0.5 dB). ≤128k files ship
    as they are (the build doesn't re-encode them)."""
    os.makedirs(os.path.dirname(out), exist_ok=True)
    ch = y.shape[1]
    for attempt in range(3):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-i', '-', '-codec:a', 'libmp3lame', '-b:a', kbps, out],
                       input=y.astype(np.float32).tobytes(), check=True)
        if target is None: return
        m = measure(decode(out, ch))
        if m[key] is None: return
        g = target - m[key]
        if caps: g = min(g, target + caps[0] - m['S'], target + caps[1] - m['M'])
        if abs(g) < 0.15: return
        y = limit(y * db(g))


def main(src):
    report = []
    for name, (f, heard) in MUSIC.items():
        y = trim_silence(decode(os.path.join(src, f), 2))
        y = run_filter(y, 'highpass=f=25:poles=2')
        target = heard - MUSIC_PLAY
        y = stage(y, -20)                                        # same level in, so the thresholds mean the same on every track
        if measure(y)['LRA'] > 9:                                # big quiet/loud swings: ride the level over ~15 s
            lev = stage(run_filter(y, 'dynaudnorm=f=500:g=31:p=0.5:m=4:s=0'), -20)
            if measure(lev)['LRA'] < measure(y)['LRA'] - 1.5: y = lev
        y = stage(run_filter(y, TAME_MUSIC), -20)               # loud moments (> 3 LU over the track) eased down
        y = loop_seam(y)
        y = to_level(y, target, caps=(3, 5.5))                   # …and the loudest 3 s / 400 ms can't stick out
        out = os.path.join(ROOT, 'public/audio/story', name + '.mp3')
        encode(y, out, '128k', target, caps=(3, 5.5))
        report.append(('music', name, heard, measure(decode(out, 2)), MUSIC_PLAY))
    for name, (f, start, length, heard) in AMBIENCE.items():
        y = decode(os.path.join(src, f), 1, start, length + 6)
        y = run_filter(y, 'highpass=f=45:poles=2')
        X = int(5 * SR); L = int(length * SR)
        o = y[:L].copy(); w = np.linspace(0, 1, X, dtype=np.float32)[:, None]
        o[:X] = y[:X] * np.sqrt(w) + y[L:L + X] * np.sqrt(1 - w)   # seamless loop
        o = stage(run_filter(stage(o, -30), TAME_AMB), -30)     # no sudden spikes (a bark, a laugh) out of the bed
        o = to_level(o, heard - AMB_PLAY, caps=(2, 4))
        out = os.path.join(ROOT, 'public/audio/story/amb', name + '.mp3')
        encode(o, out, '96k', heard - AMB_PLAY, caps=(2, 4))
        report.append(('ambience', name, heard, measure(decode(out, 1)), AMB_PLAY))
    for name, (f, a, b, fin, fout, hp, target) in SFX.items():
        y = decode(os.path.join(src, f), 1, a, (b - a) if b else None)
        y = run_filter(y, f'highpass=f={hp}:poles=2')
        y = fades(y, fin, fout)
        out = os.path.join(ROOT, 'public/sounds', name + '.mp3')
        if isinstance(target, tuple):   # too short for a 400 ms loudness reading: set the peak
            y = y * db(target[1] - (measure(y)['TP'] or 0)); y = limit(y)
            encode(y, out, '96k')
        else:
            y = to_level(y, target, 'M')
            encode(y, out, '96k', target, 'M')
        report.append(('sfx', name, target, measure(decode(out, 1)), 0))
    print(f"{'kind':<9}{'name':<14}{'target':>8}{'  heard: I':>12}{'LRA':>6}{'max M':>8}{'max S':>8}{'TP':>7}")
    for kind, name, t, m, play in report:
        h = lambda v: '—' if v is None else f'{v + play:.1f}'
        print(f"{kind:<9}{name:<14}{str(t):>8}{h(m['I']):>12}{'—' if m['LRA'] is None else m['LRA']:>6}{h(m['M']):>8}{h(m['S']):>8}{'—' if m['TP'] is None else round(m['TP'], 1):>7}")


if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__ or 'usage: master-audio.py <raw sound folder>')
    main(sys.argv[1])
