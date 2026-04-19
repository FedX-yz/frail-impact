import { useState } from 'react';
import { playClose } from '../utils/sfx';

const SAVE_KEY = 'rhg_v3';
const BASE = import.meta.env.BASE_URL;

export default function SettingsScreen({ navigate }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [scare,        setScare]        = useState(false);

  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  };

  const triggerScare = () => {
    try {
      const a = new Audio(`${BASE}sounds/hoxjumpscare.mp3`);
      a.volume = 0.85;
      a.currentTime = 1.15; 
      a.play().catch(() => {});
    } catch {}
    
    setScare(true);
    setTimeout(() => setScare(false), 650); 
  };

  return (
    <div style={{ width:'100%', height:'100vh', background:'#1a2035', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:"'Segoe UI',sans-serif", color:'#eee', position:'relative' }}>

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
        background:'#141928', 
        borderBottom:'2px solid #ff8c00', 
        flexShrink:0 
      }}>
        {/* FAKE BACK BUTTON (Top Left) */}
        <button 
          onClick={triggerScare} 
          style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.2)', color:'#ccc', fontSize:14, padding:'7px 18px', borderRadius:8, cursor:'pointer' }}
        >
          ← back
        </button>

        <span style={{ color:'#ff8c00', fontWeight:700, fontSize:18, letterSpacing:2 }}>SETTINGS</span>

        {/* REAL BACK BUTTON (Top Right) */}
        <button 
          onClick={() => { playClose(); navigate('main'); }} 
          style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.2)', color:'#ccc', fontSize:14, padding:'7px 18px', borderRadius:8, cursor:'pointer' }}
        >
          ← back
        </button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:24 }}>
        <div style={{ maxWidth:480, display:'flex', flexDirection:'column', gap:14 }}>
          
          {/* Save Section */}
          <div style={{ color:'#556', fontSize:11, letterSpacing:2 }}>SAVE DATA</div>
          <div style={{ background:'#141928', border:'1px solid #2a2a3a', borderRadius:8, padding:16 }}>
            <div style={{ fontWeight:700, marginBottom:4 }}>Reset All Progress</div>
            <div style={{ color:'#778', fontSize:13, marginBottom:12 }}>Deletes everything. Cannot be undone.</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleReset} style={{
                background:confirmReset?'#cc0000':'#1a2035',
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