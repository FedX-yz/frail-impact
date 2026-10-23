# Kokoro neural TTS for tools/make-voices.mjs:  python3 tools/kokoro_say.py <voice> <lang> <speed> <out.wav> <text>
# Setup (once):  pip install kokoro-onnx soundfile
#   and put kokoro-v1.0.int8.onnx + voices-v1.0.bin in tools/kokoro/ (or set KOKORO_DIR), from
#   https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0  (Apache-2.0)
import os, sys
import soundfile as sf
from kokoro_onnx import Kokoro
d = os.environ.get('KOKORO_DIR', os.path.join(os.path.dirname(__file__), 'kokoro'))
voice, lang, speed, out, text = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4], sys.argv[5]
k = Kokoro(os.path.join(d, 'kokoro-v1.0.int8.onnx'), os.path.join(d, 'voices-v1.0.bin'))
samples, sr = k.create(text, voice=voice, speed=speed, lang=lang)
sf.write(out, samples, sr)
