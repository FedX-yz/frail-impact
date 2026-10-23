import { useState } from 'react';
import { playClose, sfx, playPress } from '../utils/sfx';
import { getSettings, setSetting } from '../utils/settings';
import JobApplication from '../story/JobApplication';
import TermTitle from '../components/TermTitle';

const SAVE_KEY = 'rhg_v3';
const BASE = import.meta.env.BASE_URL;

export default function SettingsScreen({ navigate, devMode, toggleDev, profile, setProfile }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resign,       setResign]       = useState(false);
  const [scare,        setScare]        = useState(false);
  const [prefs,        setPrefs]        = useState(getSettings);
  const change = (key, value) => { setSetting(key, value); setPrefs(getSettings()); };
  // Hidden switch: tap the SETTINGS title 5 times to turn developer mode on/off
  const [taps, setTaps] = useState(0);
  const tapTitle = () => {
    const n = taps + 1;
    if (n >= 5) { toggleDev?.(); setTaps(0); } else setTaps(n);
  };

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
        padding:'10px 16px', 
        background:'var(--bar)', borderBottom:'2px solid #ff8c00', 
        flexShrink:0 
      }}>
        {/* FAKE BACK BUTTON (Top Left) */}
        <button 
          onClick={triggerScare} 
          style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.2)', color:'#ccc', fontSize:14, padding:'7px 18px', borderRadius:8, cursor:'pointer' }}
        >
          [&nbsp;back&nbsp;]
        </button>

        <TermTitle path="SETTINGS" onClick={tapTitle} />

        {/* REAL BACK BUTTON (Top Right) */}
        <button 
          onPointerDown={playClose} onClick={() => navigate('main')} 
          style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.2)', color:'#ccc', fontSize:14, padding:'7px 18px', borderRadius:8, cursor:'pointer' }}
        >
          [&nbsp;back&nbsp;]
        </button>
      </div>

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
            <Toggle label="Combat sounds" sub="Hits, crits, kills, explosions" on={prefs.combatSfx}
              onChange={v => { change('combatSfx', v); if (v) setTimeout(() => sfx('crit'), 30); }} />
            <Toggle label="Screen shake" sub="When you get hit, crit or kill something big" on={prefs.shake} onChange={v => change('shake', v)} />
            <Toggle label="Screen filter" sub="Terminal scanlines and glow over the menus" on={prefs.crt} onChange={v => change('crt', v)} />
            <Toggle label="CCTV battle camera" sub="Watch fights through a security camera: scanlines, REC, timestamp" on={prefs.cctv} onChange={v => change('cctv', v)} />
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

        </div>
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
