"""The score for the stolen kill (src/combat/steal.js): a dread piece synthesised here, timed to
the cutscene's beats. Writes public/audio/music/redgiant_reveal.mp3. Swap that file for a real
track any time (same name), keeping the hits roughly where these are:
  0.0 everything stops (a low boom, a drone starts)    1.4 his eyes open (8 glassy pings)
  2.6 his hands open (strings swell)    3.3 they clap shut on it (a hit)
  4.45 4.85 5.22 5.56 his steps as he runs off (booms, going away)
  5.7-7.0 out of sight, eating (crunching, chewing)    7.7 black (it dies away)
usage: python3 tools/make-steal-score.py"""
import numpy as np, subprocess, wave, os
SR = 44100
D = 10.0
n = int(SR * D)
t = np.arange(n) / SR
rng = np.random.default_rng(7)
out = np.zeros(n)

def env(a, b, attack=0.02, release=0.3):
    e = np.zeros(n)
    i0, i1 = int(a * SR), int(b * SR)
    seg = np.arange(i1 - i0) / SR
    L = (i1 - i0) / SR
    e[i0:i1] = np.minimum(1, seg / max(attack, 1e-4)) * np.minimum(1, (L - seg) / max(release, 1e-4))
    return np.clip(e, 0, 1)

def lowpass(x, cutoff):   # one-pole, cutoff may be an array
    y = np.zeros_like(x); c = np.broadcast_to(cutoff, x.shape); acc = 0.0
    a = 1 - np.exp(-2 * np.pi * c / SR)
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc); y[i] = acc
    return y

def boom(at, f0=48, dur=2.5, amp=0.9):
    s = np.zeros(n); i0 = int(at * SR); k = np.arange(min(n - i0, int(dur * SR))) / SR
    f = f0 * (1 + 1.5 * np.exp(-k * 18))   # pitch drop
    ph = 2 * np.pi * np.cumsum(f) / SR
    s[i0:i0 + len(k)] = np.sin(ph) * np.exp(-k * 2.2) * amp
    return s

def noise_hit(at, dur, cutoff, amp):
    s = np.zeros(n); i0 = int(at * SR); m = min(n - i0, int(dur * SR)); k = np.arange(m) / SR
    s[i0:i0 + m] = rng.standard_normal(m) * np.exp(-k * (6 / dur)) * amp
    return lowpass(s, cutoff)

# the drone: low beating saws, a filter opening slowly as he rises
saw = lambda f: 2 * ((t * f) % 1) - 1
drone = (saw(41.2) + saw(43.0) * 0.8 + np.sin(2 * np.pi * 55 * t) * 0.6 + saw(61.7) * 0.35)
drone *= env(0.0, 7.9, attack=1.6, release=1.4)
cut = 90 + 520 * np.clip((t - 0.2) / 2.6, 0, 1) ** 1.5
cut = np.where(t > 4.4, cut * 0.7, cut)
drone = lowpass(drone, cut) * 0.14
out += drone
# the ground rumbling as he rises
rumble = lowpass(rng.standard_normal(n), 70) * 1.6 * env(0.3, 2.9, 0.9, 0.5)
out += rumble
# 0.0: everything stops
out += boom(0.0, 44, 3.0, 0.8)
# 1.4..: his eyes open, one by one: glassy, dissonant pings
for i, f in enumerate([1661, 1760, 1865, 1568, 1976, 1480, 2093, 1397]):
    a = 1.4 + i * 0.13
    e = np.zeros(n); i0 = int(a * SR); k = np.arange(n - i0) / SR
    e[i0:] = np.minimum(1, k / 0.04) * np.exp(-k * 1.4)
    out += (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.01 * t)) * e * 0.05
# 2.6: his hands open: strings swell; 3.3 the clap shuts them off
strings = sum(saw(f * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * t + j))) for j, f in enumerate([220, 233.1, 311.1, 329.6]))
rise = np.clip((t - 2.6) / 0.7, 0, 1)
out += lowpass(strings, 600 + 3000 * rise) * 0.05 * rise * env(2.6, 3.32, 0.3, 0.02)
# 3.3: the clap: a huge slap and a boom
out += boom(3.3, 50, 2.4, 1.7) + noise_hit(3.3, 0.25, 5000, 1.8) + noise_hit(3.3, 0.6, 900, 0.9)
# squeezing: a low tremolo
trem = lowpass(saw(55) + saw(58.3), 260) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t)) * 0.12 * env(3.35, 4.3, 0.1, 0.3)
out += trem
# his steps as he runs off, going away
for i, at in enumerate([4.45, 4.85, 5.22, 5.56]):
    g = 0.55 * (0.78 ** i)
    out += boom(at, 38, 1.8, g) + noise_hit(at, 0.3, 300, 0.4 * g)
# out of sight: eating. Wet crunches and chewing, a little muffled (far off)
eat = np.zeros(n)
at = 5.7
while at < 7.0:
    big = rng.random() < 0.3
    eat += noise_hit(at, 0.12 if not big else 0.22, 1800 if big else 1100, 0.55 if big else 0.32)
    if big: eat += boom(at, 90, 0.4, 0.25)
    at += rng.uniform(0.14, 0.32)
chew = lowpass(rng.standard_normal(n), 400) * (0.5 + 0.5 * np.sin(2 * np.pi * 3.2 * t)) ** 3 * env(5.7, 7.1, 0.2, 0.4) * 0.9
out += lowpass(eat + chew, 2200) * 0.9
# a low growl under the eating
out += lowpass(saw(46) + saw(46.7), 180) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.3 * t)) * 0.18 * env(5.6, 7.6, 0.5, 0.8)
# a long dark reverb over it all
ir_len = int(2.6 * SR); k = np.arange(ir_len) / SR
ir = rng.standard_normal(ir_len) * np.exp(-k * 2.4); ir[0] = 1
wet = np.convolve(out, ir * 0.08)[:n]
mix = out * 0.8 + wet * 0.5
mix *= np.clip((D - t) / 1.2, 0, 1)                    # (fade the very end)
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.2) / np.tanh(1.2)   # soft limit
mix = (mix / np.max(np.abs(mix)) * 0.92 * 32767).astype(np.int16)
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
wav = '/tmp/redgiant_reveal.wav'
with wave.open(wav, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(mix.tobytes())
dst = os.path.join(root, 'public/audio/music/redgiant_reveal.mp3')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '128k', dst], check=True)
print('wrote', dst)
