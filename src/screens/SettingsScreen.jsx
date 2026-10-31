import { useEffect, useRef, useState } from 'react';
import { playClose, sfx, playPress } from '../utils/sfx';
import { getSettings, setSetting } from '../utils/settings';
import JobApplication from '../story/JobApplication';
import TermTitle from '../components/TermTitle';
import useIsMobile from '../hooks/useIsMobile';
import { runCommand } from '../utils/secrets';
import { CursorArt } from '../components/GameCursor';
import { CURSOR_SIZES } from '../utils/cursor';

const SAVE_KEY = 'rhg_v3';
const BASE = import.meta.env.BASE_URL;

export default function SettingsScreen({ navigate, devMode, toggleDev, profile, setProfile }) {
  const { mobile } = useIsMobile();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resign,       setResign]       = useState(false);
  const [scare,        setScare]        = useState(false);
  const [prefs,        setPrefs]        = useState(getSettings);
  const change = (key, value) => { setSetting(key, value); setPrefs(getSettings()); };
  // Hidden switch: tap the SETTINGS title 5 times to turn developer mode on/off
  const [taps, setTaps] = useState(0);
  const tapTitle = () => {
    if (held.current) { held.current = false; return; }   // that was the end of a long press
    const n = taps + 1;
    if (n >= 5) { toggleDev?.(); setTaps(0); } else setTaps(n);
  };
  // …and press and hold it for a command line
  const [prompt, setPrompt] = useState(false);
  const holdT = useRef(null), held = useRef(false);
  const titleDown = () => { held.current = false; clearTimeout(holdT.current); holdT.current = setTimeout(() => { held.current = true; setPrompt(true); }, 1000); };
  const titleUp = () => clearTimeout(holdT.current);

  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    window.__frailResetting = true; // stops App re-saving on unload
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  };

  const triggerScare = () => {
    try {
      const a = new Audio(`${BASE}sounds/hoxjumpscare.mp3`);
      a.volume = 0.85;
      a.currentTime = 1.15; 
      a.play().catch(() => {});
    } catch { /* audio blocked: the jumpscare still shows */ }
    
    setScare(true);
    setTimeout(() => setScare(false), 650); 
  };

  return (
    <div style={{ width:'100%', height:"100dvh", background:'var(--desk)', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'var(--font-ui)', color:'#eee', position:'relative' }}>

      <style>{`
        @keyframes phantomVisibleSnap {
          0% { 
            opacity: 0; 
            transform: scale(1.4) translateY(8%);
            filter: invert(100%) grayscale(100%) brightness(50%) contrast(130%);
          }
          15% { 
            opacity: 1; 
            transform: scale(1.1) translateY(0);
          }
          25%, 45%, 65% { opacity: 0.9; }
          35%, 55% { opacity: 1; }
          85% {
            opacity: 1;
            filter: invert(100%) grayscale(100%) brightness(250%) contrast(150%);
          }
          100% { 
            opacity: 0; 
            transform: scale(1.15);
            filter: invert(100%) grayscale(100%) brightness(400%) contrast(100%);
          }
        }

        @keyframes finalFlash {
          0%, 80% { opacity: 0; }
          90% { opacity: 0.5; } 
          100% { opacity: 0; }
        }
      `}</style>

      {/* JUMPSCARE OVERLAY */}
      {scare && (
        <div style={{ 
          position:'fixed', inset:0, zIndex:999, background:'black', 
          pointerEvents:'none', display:'flex', alignItems:'center', 
          justifyContent:'center', overflow: 'hidden' 
        }}>
          <img
            src={`${BASE}enemies/hoxboss.jpg`}
            alt="HOX"
            style={{ 
              width:'100%', height:'100%', objectFit:'fill', 
              animation: 'phantomVisibleSnap 0.6s ease-out forwards'
            }}
          />
          <div style={{
            position: 'absolute', inset: 0, background: 'white',
            mixBlendMode: 'screen',
            animation: 'finalFlash 0.6s ease-out forwards'
          }} />
        </div>
      )}

      {/* Top bar with Split Buttons */}
      <div style={{ 
        display:'flex', 
        alignItems:'center', 
        justifyContent: 'space-between', 
        padding: mobile ? '8px 8px' : '10px 16px', gap: 6,
        background:'var(--bar)', borderBottom:'2px solid #ff8c00', 
        flexShrink:0 
      }}>
        {/* FAKE BACK BUTTON (Top Left) */}
        <button 
          onClick={triggerScare} 
          style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.2)', color:'#ccc', fontSize:14, padding: mobile ? '6px 8px' : '7px 18px', borderRadius:8, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
        >
          [&nbsp;back&nbsp;]
        </button>

        <span onPointerDown={titleDown} onPointerUp={titleUp} onPointerLeave={titleUp} onPointerCancel={titleUp} onContextMenu={e => e.preventDefault()}
          style={{ WebkitTouchCallout: 'none', userSelect: 'none', touchAction: 'manipulation' }}>
          <TermTitle path="SETTINGS" onClick={tapTitle} small={mobile} />
        </span>

        {/* REAL BACK BUTTON (Top Right) */}
        <button 
          onPointerDown={playClose} onClick={() => navigate('main')} 
          style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.2)', color:'#ccc', fontSize:14, padding: mobile ? '6px 8px' : '7px 18px', borderRadius:8, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
        >
          [&nbsp;back&nbsp;]
        </button>
      </div>

      {prompt && <CommandLine onClose={() => setPrompt(false)} />}

      <div style={{ flex:1, overflowY:'auto', padding:24 }}>
        <div style={{ maxWidth:480, display:'flex', flexDirection:'column', gap:14 }}>
          
          {devMode && (
            <div style={{ background:'#1a1036', border:'1px solid #7c3aed', borderRadius:8, padding:'10px 14px', color:'#e9d5ff', fontSize:13 }}>
              🛠 <b>Developer mode is on.</b> Open the sandbox with the DEV button on the battle screen.
              <button onClick={toggleDev} style={{ marginLeft:8, background:'none', border:'1px solid #a78bfa', color:'#c4b5fd', borderRadius:6, padding:'3px 10px', fontSize:12, cursor:'pointer' }}>turn off</button>
            </div>
          )}

          {/* Sound & feel */}
          <div style={{ color:'#8a7a63', fontSize:11, letterSpacing:2, fontFamily:'var(--label)' }}>SOUND &amp; FEEL</div>
          <div style={{ background:'var(--panel)', border:'1px solid var(--line)', borderRadius:8, padding:16, display:'flex', flexDirection:'column', gap:14 }}>
            <label style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ width:110, fontWeight:700 }}>Volume</span>
              <input id="set-volume" type="range" min={0} max={1} step={0.05} value={prefs.volume}
                onChange={e => change('volume', Number(e.target.value))}
                onPointerUp={() => playPress()}
                style={{ flex:1, accentColor:'#ff8c00' }} />
              <span style={{ width:40, textAlign:'right', color:'#889', fontVariantNumeric:'tabular-nums' }}>{Math.round(prefs.volume * 100)}%</span>
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ width:110, fontWeight:700 }}>Music</span>
              <input id="set-music" type="range" min={0} max={1} step={0.05} value={prefs.music ?? 0.8}
                onChange={e => change('music', Number(e.target.value))}
                style={{ flex:1, accentColor:'#ff8c00' }} />
              <span style={{ width:40, textAlign:'right', color:'#889', fontVariantNumeric:'tabular-nums' }}>{Math.round((prefs.music ?? 0.8) * 100)}%</span>
            </label>
            <Toggle label="Combat sounds" sub="Hits, crits, kills, explosions" on={prefs.combatSfx}
              onChange={v => { change('combatSfx', v); if (v) setTimeout(() => sfx('crit'), 30); }} />
            <Toggle label="Screen shake" sub="When you get hit, crit or kill something big" on={prefs.shake} onChange={v => change('shake', v)} />
            <Toggle label="Screen filter" sub="Terminal scanlines and glow over the menus" on={prefs.crt} onChange={v => change('crt', v)} />
            <Toggle label="CCTV battle camera" sub="Watch fights through a security camera: scanlines, REC, timestamp" on={prefs.cctv} onChange={v => change('cctv', v)} />
          </div>

          {/* The battle cursor */}
          <div style={{ color:'#8a7a63', fontSize:11, letterSpacing:2, fontFamily:'var(--label)' }}>CURSOR</div>
          <div style={{ background:'var(--panel)', border:'1px solid var(--line)', borderRadius:8, padding:16, display:'flex', gap:16, flexWrap:'wrap' }}>
            <div style={{ flex:'1 1 240px', display:'flex', flexDirection:'column', gap:14 }}>
              <Choice label="Battle cursor" sub="Drawn by the game; it flashes when you're hit or healed. Mouse only." value={prefs.cursor}
                options={[['cyan', 'Cyan'], ['yellow', 'Yellow'], ['system', 'Normal']]} onChange={v => change('cursor', v)} />
              <Choice label="Size" value={prefs.cursorSize} disabled={prefs.cursor === 'system'}
                options={[['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']]} onChange={v => change('cursorSize', v)} />
              <div style={{ opacity: prefs.cursor === 'system' ? 0.4 : 1, pointerEvents: prefs.cursor === 'system' ? 'none' : undefined }}>
                <Toggle label="Skill + ult rings" sub="Your skill (cyan) and ult (pink) charging next to the cursor" on={prefs.cursorRings} onChange={v => change('cursorRings', v)} />
              </div>
            </div>
            {prefs.cursor !== 'system' && <CursorPreview prefs={prefs} />}
          </div>

          {/* You, the manager */}
          <div style={{ color:'#8a7a63', fontSize:11, letterSpacing:2, fontFamily:'var(--label)' }}>MANAGER</div>
          <div style={{ background:'var(--panel)', border:'1px solid var(--line)', borderRadius:8, padding:16, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
            <div style={{ flex:'1 1 200px' }}>
              <div style={{ fontWeight:700 }}>{profile?.name || 'Not hired yet'}</div>
              <div style={{ color:'#778', fontSize:13 }}>{profile?.signature ? 'Field Manager (probation), Frail Initiative' : 'No signed application on file'}</div>
            </div>
            {profile?.signature && <img src={profile.signature} alt="your signature" style={{ height:44, maxWidth:200, background:'#e7dcc2', borderRadius:4, padding:'4px 10px' }} />}
            {profile?.signature ? (
              <button onClick={() => { playPress(); setResign(true); }} style={{ background:'var(--desk)', border:'1px solid #ff8c00', color:'#ff8c00', padding:'8px 16px', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                Sign again
              </button>
            ) : <div style={{ color:'#889', fontSize:13 }}>Sign your job application in story mode: Tower → Briefing.</div>}
          </div>
          {resign && <JobApplication initialName={profile?.name ?? ''} onSigned={p => { setProfile?.(p); setResign(false); }} />}

          {/* Save Section */}
          <div style={{ color:'#8a7a63', fontSize:11, letterSpacing:2, fontFamily:'var(--label)' }}>SAVE DATA</div>
          <div style={{ background:'var(--panel)', border:'1px solid var(--line)', borderRadius:8, padding:16 }}>
            <div style={{ fontWeight:700, marginBottom:4 }}>Reset All Progress</div>
            <div style={{ color:'#778', fontSize:13, marginBottom:12 }}>Deletes everything. Cannot be undone.</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleReset} style={{
                background:confirmReset?'#cc0000':'var(--panel-deep)',
                border:`2px solid ${confirmReset?'#ff4444':'#cc3300'}`,
                color:confirmReset?'#fff':'#cc3300',
                padding:'8px 20px', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:700,
              }}>
                {confirmReset ? '⚠ CONFIRM RESET' : 'Reset Save'}
              </button>
              {confirmReset && (
                <button onClick={() => setConfirmReset(false)} style={{ background:'none', border:'1px solid #445', color:'#778', padding:'8px 16px', borderRadius:6, cursor:'pointer', fontSize:13 }}>
                  cancel
                </button>
              )}
            </div>
          </div>

          <div style={{ color:'#6f6150', fontSize:11, lineHeight:1.5 }}>
            Battle and map icons from <a href="https://game-icons.net" target="_blank" rel="noreferrer" style={{ color:'#c27a33' }}>game-icons.net</a> (Lorc, Delapouite and contributors), licensed{' '}
            <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer" style={{ color:'#c27a33' }}>CC BY 3.0</a>.
          </div>

        </div>
      </div>
    </div>
  );
}

// The command line behind the title. Almost nothing here is a command.
function CommandLine({ onClose }) {
  const [line, setLine] = useState('');
  const [out, setOut] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const cmd = line.trim();
    if (!cmd) return;
    setLine('');
    const r = await runCommand(cmd).catch(() => null);
    if (r) {
      setOut(r === 'on' ? '☸ THE WHEEL TURNS.' : '…the shadows sleep.');
      setTimeout(() => window.location.reload(), 1400);
    } else setOut(`'${cmd.slice(0, 32)}' is not recognized as an internal or external command, operable program or batch file.`);
  };
  return (
    <form onSubmit={submit} style={{ background:'#0a0603', borderBottom:'1px solid #ff8c00', padding:'8px 14px', fontFamily:'var(--font-ui)', color:'var(--amber)', fontSize:14, flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ color:'var(--amber-dim)', whiteSpace:'nowrap' }}>C:\FRAIL\&gt;</span>
        <input autoFocus value={line} onChange={e => setLine(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          spellCheck={false} autoComplete="off" autoCapitalize="off" aria-label="command"
          style={{ flex:1, minWidth:0, background:'transparent', border:'none', outline:'none', color:'var(--amber)', fontFamily:'inherit', fontSize:16, caretColor:'#ff8c00' }} />
        <button type="button" onClick={onClose} style={{ background:'none', border:'none', color:'var(--amber-dim)', cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>[x]</button>
      </div>
      {out && <div style={{ marginTop:6, color: out.startsWith("'") ? '#a8a29e' : '#fde047', fontSize:13, whiteSpace:'pre-wrap' }}>{out}</div>}
    </form>
  );
}

// A row of buttons, one lit
function Choice({ label, sub, value, options, onChange, disabled }) {
  return (
    <div style={{ opacity: disabled ? 0.4 : 1 }}>
      <div style={{ fontWeight:700 }}>{label}</div>
      {sub && <div style={{ color:'#778', fontSize:12 }}>{sub}</div>}
      <div style={{ display:'flex', gap:6, marginTop:6 }}>
        {options.map(([v, text]) => (
          <button key={v} disabled={disabled} onClick={() => { playPress(); onChange(v); }} aria-pressed={value === v}
            style={{ flex:1, minWidth:0, padding:'6px 4px', borderRadius:6, cursor: disabled ? 'default' : 'pointer', fontWeight:700, fontSize:13,
              background: value === v ? '#ff8c00' : 'var(--panel-deep)', color: value === v ? '#1a0f00' : '#ccb', border:`1px solid ${value === v ? '#ff8c00' : 'var(--line)'}` }}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

// The cursor as it looks in a fight: a hit and a heal play on a loop, the rings charge
function CursorPreview({ prefs }) {
  const [now, setNow] = useState(() => performance.now() / 1000);
  useEffect(() => { let raf; const f = () => { setNow(performance.now() / 1000); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, []);
  const t = now % 4;
  const flash = t < 1 ? { kind: 'hit', from: 0.8, to: 0.62, t0: 0, last: 0 } : t >= 2 && t < 3 ? { kind: 'heal', from: 0.62, to: 0.8, t0: 2, last: 2 } : null;
  const skill = { fill: Math.min(1, (now % 5) / 4), ready: now % 5 >= 4 }, ult = { fill: 0.35 + 0.1 * Math.sin(now * 0.7) };
  const size = CURSOR_SIZES[prefs.cursorSize] ?? CURSOR_SIZES.m;
  return (
    <div style={{ flex:'0 0 150px', height:150, position:'relative', background:'#0f1625', border:'1px solid var(--line)', borderRadius:8, overflow:'hidden' }}>
      <div style={{ position:'absolute', left: 75 - size * 0.8, top: 75 - size * 0.75 }}>
        <CursorArt theme={prefs.cursor} size={size} skill={prefs.cursorRings ? skill : null} ult={prefs.cursorRings ? ult : null} flash={flash} now={t} />
      </div>
    </div>
  );
}

function Toggle({ label, sub, on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ display:'flex', alignItems:'center', gap:12, background:'none', border:'none', padding:0, color:'inherit', textAlign:'left', cursor:'pointer', width:'100%' }}>
      <span style={{ flex:1 }}>
        <span style={{ display:'block', fontWeight:700 }}>{label}</span>
        <span style={{ display:'block', color:'#778', fontSize:12 }}>{sub}</span>
      </span>
      <span style={{ width:44, height:24, borderRadius:12, background: on ? '#ff8c00' : 'var(--line)', position:'relative', transition:'background 0.15s', flexShrink:0 }}>
        <span style={{ position:'absolute', top:3, left: on ? 23 : 3, width:18, height:18, borderRadius:9, background:'#fff', transition:'left 0.15s' }} />
      </span>
    </button>
  );
}
