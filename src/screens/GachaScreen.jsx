import { useState, useEffect, useRef } from 'react';
import { CHARACTERS } from '../data/characters';
import { BANNERS } from '../data/banners';
import { playClose } from '../utils/sfx';

const BASE = import.meta.env.BASE_URL;

const RARITY_COLOR = { 6:'#ff4444', 5:'#f0c040', 4:'#a855f7', 3:'#60a5fa' };
const RARITY_GLOW  = { 6:'rgba(255,50,50,0.7)', 5:'rgba(240,192,64,0.6)', 4:'rgba(168,85,247,0.6)', 3:'rgba(96,165,250,0.5)' };
const SUMMON_VID   = {
  6: `${BASE}animations/6star.mp4`,
  5: `${BASE}animations/5star.mp4`,
  4: `${BASE}animations/4star.mp4`,
  3: `${BASE}animations/3star.mp4`,
};

const rc = r => RARITY_COLOR[r] || '#fff';
const rg = r => RARITY_GLOW[r]  || 'transparent';
const isHighRarity = card => card && card.rarity >= 5;

const formatCoins = v => v >= 1000 ? `${Math.floor(v / 1000)}k` : String(v);

const GemImg = ({ size = 22 }) => (
  <img
    src={`${BASE}ui/ui_frailite.png`}
    alt="gem"
    style={{ width: size, height: size, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0, verticalAlign: 'middle' }}
  />
);

// ── Pull logic ────────────────────────────────────────────────────
function doPulls(count, pity4, pity5, banner) {
  let p4 = pity4, p5 = pity5;
  const results = [];

  for (let i = 0; i < count; i++) {
    p4++; p5++;
    const rand = Math.random() * 100;
    let rarity;
    if (p5 >= 90 || (p5 >= 75 && rand < 0.6 + (p5 - 75) * 6)) {
      rarity = Math.random() < 0.1 ? 6 : 5; p5 = 0;
    } else if (p4 >= 10 || rand < 5.1) {
      rarity = 4; p4 = 0;
    } else {
      rarity = 3;
    }

    let pool = CHARACTERS.filter(c => c.rarity === rarity);

    if (
      banner.featuredIds.length > 0 &&
      rarity === banner.boostedRarity &&
      Math.random() < banner.boostedChance
    ) {
      const featuredOfRarity = CHARACTERS.filter(c =>
        banner.featuredIds.includes(c.id) && c.rarity === rarity
      );
      if (featuredOfRarity.length > 0) pool = featuredOfRarity;
    }

    const fallback = CHARACTERS.filter(c => c.rarity === 3);
    const src = pool.length > 0 ? pool : fallback;
    const pulled = src[Math.floor(Math.random() * src.length)];
    results.push({
      ...pulled,
      instanceId: `${pulled.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    });
  }
  return { results, newPity4: p4, newPity5: p5 };
}

// ── Countdown hook ─────────────────────────────────────────────
// Set BANNER_END_DATE to your actual banner end date/time
const BANNER_END_DATE = new Date('2025-06-01T00:00:00Z');

function useCountdown(endDate) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = endDate - Date.now();
      if (diff <= 0) { setTimeLeft('Ended'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        d > 0
          ? `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`
          : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);
  return timeLeft;
}

// ─────────────────────────────────────────────────────────────────
export default function GachaScreen({
  navigate, currency, setCurrency,
  collection, setCollection,
  pity4, setPity4, pity5, setPity5,
  cardInventory = {},
  setCoins,
}) {
  const [phase,           setPhase]           = useState('idle');
  const [batch,           setBatch]           = useState([]);
  const [queueIdx,        setQueueIdx]        = useState(0);
  const [highestRar,      setHighestRar]      = useState(3);
  const [showArt,         setShowArt]         = useState(null);
  const [selectedResult,  setSelectedResult]  = useState(null);
  const [summaryBatch,    setSummaryBatch]    = useState([]);
  const [activeBannerId,  setActiveBannerId]  = useState(BANNERS[0].id);
  const [showBannerSelect,setShowBannerSelect]= useState(false);
  const [s5CoinsEarned,   setS5CoinsEarned]   = useState(0);

  // ── Custom banner UI state ──────────────────────────────────
  const [hovBtn1, setHovBtn1] = useState(false);
  const [hovBtn2, setHovBtn2] = useState(false);

  const timeLeft = useCountdown(BANNER_END_DATE);

  const activeBanner = BANNERS.find(b => b.id === activeBannerId) || BANNERS[0];

  const summonRef = useRef(null);
  const revealRef = useRef(null);
  const audioRef  = useRef(null);
  const batchRef  = useRef([]);

  useEffect(() => { batchRef.current = batch; }, [batch]);

  const currentCard = batch[queueIdx] ?? null;

  const stopAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };
  const playAudio = src => {
    if (!src || !audioRef.current) return;
    audioRef.current.src = src;
    audioRef.current.load();
    audioRef.current.play().catch(() => {});
  };
  const playVideo = (ref, src) => {
    if (!ref.current || !src) return;
    ref.current.src = src;
    ref.current.load();
    ref.current.play().catch(() => {});
  };

  const enterCard = (idx, cards) => {
    const b    = cards || batchRef.current;
    const card = b[idx];
    setQueueIdx(idx);
    if (isHighRarity(card) && card.resultVideo) {
      setPhase('card-video');
    } else {
      setPhase('reveal-queue');
    }
  };

  useEffect(() => {
    if (phase !== 'summon') return;
    playVideo(summonRef, SUMMON_VID[highestRar] || SUMMON_VID[3]);
  }, [phase, highestRar]);

  useEffect(() => {
    if (phase !== 'card-video') return;
    const card = batchRef.current[queueIdx];
    if (card?.resultVideo) playVideo(revealRef, card.resultVideo);
  }, [phase, queueIdx]);

  useEffect(() => {
    if (phase !== 'reveal-queue') return;
    const card = batchRef.current[queueIdx];
    stopAudio();
    if (card?.voiceLine) playAudio(card.voiceLine);
  }, [phase, queueIdx]);

  const startPulls = cnt => {
    if (phase !== 'idle' || currency < cnt) return;
    setCurrency(c => c - cnt);
    const { results, newPity4, newPity5 } = doPulls(cnt, pity4, pity5, activeBanner);
    setPity4(newPity4);
    setPity5(newPity5);

    const S5_COIN_VALUES = { 6: 5000, 5: 2500, 4: 500, 3: 100 };
    let coinsFromS5 = 0;

    const collectionResults = results.filter(pulled => {
      const si = cardInventory[pulled.id]?.si ?? 0;
      if (si >= 4) {
        coinsFromS5 += S5_COIN_VALUES[pulled.rarity] || 0;
        return false;
      }
      return true;
    });

    if (coinsFromS5 > 0) {
      setCoins(c => c + coinsFromS5);
      setS5CoinsEarned(coinsFromS5);
    } else {
      setS5CoinsEarned(0);
    }

    setCollection(prev => [...prev, ...collectionResults]);

    batchRef.current = results;
    setBatch(results);
    setQueueIdx(0);

    const maxRar = Math.max(...results.map(r => r.rarity));
    setHighestRar(maxRar);
    if (maxRar >= 5) {
      try { const a = new Audio(`${BASE}sounds/pull_5star.mp3`); a.volume = 0.85; a.play().catch(() => {}); } catch { /* empty */ }
    }
    setPhase('summon');
  };

  const onSummonEnd = () => enterCard(0, batchRef.current);

  const skipSummon = () => {
    if (!summonRef.current) return;
    summonRef.current.onended = null;
    summonRef.current.pause();
    onSummonEnd();
  };

  const onCardVideoEnd = () => setPhase('reveal-queue');

  const advanceQueue = () => {
    stopAudio();
    const b    = batchRef.current;
    const next = queueIdx + 1;
    if (next >= b.length) {
      setSummaryBatch([...batchRef.current]);
      setBatch([]);
      setQueueIdx(0);
      setPhase('results');
    } else {
      enterCard(next, b);
    }
  };

  const handleSmartSkip = e => {
    e.stopPropagation();
    stopAudio();
    const b = batchRef.current;

    let nextHighIdx = -1;
    for (let i = queueIdx + 1; i < b.length; i++) {
      if (isHighRarity(b[i])) { nextHighIdx = i; break; }
    }

    if (nextHighIdx !== -1) {
      enterCard(nextHighIdx, b);
    } else {
      setSummaryBatch([...b]);
      setBatch([]);
      setQueueIdx(0);
      setPhase('results');
    }
  };

  // ── Derived button image src ──────────────────────────────────
  const pullBtnSrc = () => {
    if (hovBtn1) return `${BASE}ui/ui_pullbtnhover1.png`;
    if (hovBtn2) return `${BASE}ui/ui_pullbtnhover2.png`;
    return `${BASE}ui/ui_pullbtn.png`;
  };

  // ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed', inset:0, fontFamily:"'Segoe UI',sans-serif", userSelect:'none' }}>

      <audio ref={audioRef} style={{ display:'none' }} />

      {/* Summon intro video */}
      <video
        ref={summonRef}
        onEnded={onSummonEnd}
        playsInline
        style={{
          position:'absolute', inset:0, width:'100%', height:'100%',
          objectFit:'cover', background:'#000', zIndex:50,
          display: phase === 'summon' ? 'block' : 'none',
        }}
      />

      {/* Per-card reveal video */}
      <video
        ref={revealRef}
        onEnded={onCardVideoEnd}
        playsInline
        style={{
          position:'absolute', inset:0, width:'100%', height:'100%',
          objectFit:'cover', background:'#000', zIndex:50,
          display: phase === 'card-video' ? 'block' : 'none',
        }}
      />

      <style>{`
        * { -webkit-user-select:none; user-select:none; }
        img { -webkit-user-drag:none; }
        @keyframes twinkle   { 0%,100%{opacity:0.15} 50%{opacity:0.9} }
        @keyframes shimmer   { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes orbFloat  { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.04)} }
        @keyframes revealUp  { from{opacity:0;transform:scale(0.65) translateY(50px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes starPop   { from{opacity:0;transform:scale(0) rotate(-120deg)} to{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes highPulse { 0%,100%{text-shadow:0 0 24px currentColor} 50%{text-shadow:0 0 48px currentColor, 0 0 80px currentColor} }
        @keyframes tapHint   { 0%,100%{opacity:0.2} 50%{opacity:0.6} }
        @keyframes goldShimmer { 0%{background-position:-300% center} 100%{background-position:300% center} }
        @keyframes convertOverlay  { from{opacity:0} to{opacity:1} }
        @keyframes coinEntry       { 0%{opacity:0;transform:scale(0.1) rotate(-220deg) translateY(40px)} 65%{transform:scale(1.18) rotate(12deg) translateY(-6px)} 82%{transform:scale(0.94) rotate(-4deg) translateY(3px)} 100%{opacity:1;transform:scale(1) rotate(0deg) translateY(0)} }
        @keyframes coinIdle        { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-8px) scale(1.04)} }
        @keyframes coinShine       { 0%,100%{filter:drop-shadow(0 0 10px rgba(240,192,64,0.7)) brightness(1)} 50%{filter:drop-shadow(0 0 32px rgba(240,192,64,1)) drop-shadow(0 0 56px rgba(255,220,100,0.55)) brightness(1.25)} }
        @keyframes amountPop       { 0%{opacity:0;transform:scale(0.4) translateY(24px)} 65%{transform:scale(1.12) translateY(-3px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes badgeSlideIn    { 0%{opacity:0;transform:translateY(10px) scale(0.85)} 100%{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes ringPulse       { 0%{transform:scale(0.6);opacity:0.7} 100%{transform:scale(2.2);opacity:0} }
        @keyframes charFloat       { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        @keyframes pulseGlow       { 0%,100%{opacity:0.7} 50%{opacity:1} }
        .result-tile {
          display:flex; flex-direction:column; align-items:center;
          justify-content:flex-end; gap:6px;
          width:100%; aspect-ratio:3/4;
          border-radius:12px; overflow:hidden;
          position:relative; cursor:default;
          transition:transform 0.15s;
        }
        .result-tile:hover { transform:scale(1.05); z-index:2; }
        .tile-high::after {
          content:'';
          position:absolute; inset:0; border-radius:12px;
          background: linear-gradient(120deg,transparent 30%,rgba(255,215,80,0.18) 50%,transparent 70%);
          background-size:300% auto;
          animation:goldShimmer 2.4s linear infinite;
          pointer-events:none;
        }
        .banner-card { transition: border-color 0.15s, background 0.15s; }
        .banner-card:hover { transform: scale(1.02); }
        .pull-btn-overlay {
        position:absolute; top:0; height:100%;
        background:none; border:none; cursor:pointer; padding:0;
        outline:none;
      }
      .pull-btn-overlay:focus { outline:none; }
      .pull-btn-overlay:focus-visible { outline:none; }
      .pull-btn-overlay:disabled { cursor:not-allowed; }
      `}</style>

      {/* ══════════════════════════════════════════════════════════
          ── IDLE — Custom Retirement Home Banner UI ─────────────
          ══════════════════════════════════════════════════════════ */}
      {phase === 'idle' && (
        <div style={{
  width: '100%', height: '100%',
  background: '#1a1a2e',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', overflow: 'hidden',
  zoom: 0.9,
}}>

    {/* Header bar */}
    <div style={{
      width: '100%', flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '6px 20px',
background: 'rgba(0,0,0,0.55)',
zIndex: 10,
    }}>
      <button
        onClick={() => { playClose(); navigate('main'); }}
        style={{
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: '#ccc', fontSize: 14,
          padding: '7px 18px', borderRadius: 8, cursor: 'pointer',
        }}
      >
        ← back
      </button>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(85,136,255,0.45)',
        borderRadius: 20, padding: '6px 18px 6px 12px',
      }}>
        <GemImg size={24} />
        <span style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>{currency}</span>
      </div>

      <div
        onClick={() => setShowBannerSelect(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          border: `1px solid ${activeBanner.accentColor}55`,
          borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = activeBanner.accentColor}
        onMouseLeave={e => e.currentTarget.style.borderColor = `${activeBanner.accentColor}55`}
      >
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Banner</span>
        <span style={{ fontWeight: 700, fontSize: 12, color: activeBanner.accentColor }}>{activeBanner.name}</span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>▼</span>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', textAlign: 'right' }}>
        4★ {pity4}/10 · 5★ {pity5}/90 · {collection.length} cards
      </div>
    </div>

    {/* Banner card */}
{/* Banner card */}
<div style={{
  position: 'relative',
  width: 'min(96vw, 700px)',
  aspectRatio: '16/10',
  flexShrink: 0,
  marginTop: 95,
}}>

  {/* Clipped inner frame — bg + text only */}
  <div style={{
    position: 'absolute',
    inset: 0,
    borderRadius: 0,
    overflow: 'hidden',
  }}>
    {activeBanner.uiAssets?.bg
      ? <img src={`${BASE}ui/${activeBanner.uiAssets.bg}.png`} alt="" draggable={false}
          style={{
            position: 'absolute',
            top: '-30%', left: 0,
            width: '100%', height: '130%',
            objectFit: 'fill',
            zIndex: 0,
          }} />
      : <div style={{ position:'absolute', inset:0, zIndex:0, background:`radial-gradient(ellipse at 30% 60%, ${activeBanner.accentColor}22 0%, #07000f 70%)` }} />
    }

    {activeBanner.uiAssets?.text && (
      <img src={`${BASE}ui/${activeBanner.uiAssets.text}.png`} alt="" draggable={false}
        style={{
          position: 'absolute',
          top: '-30%', left: 0,
          width: '100%', height: '130%',
          objectFit: 'fill',
          zIndex: 2,
          pointerEvents: 'none',
        }} />
    )}

    {activeBanner.uiAssets?.text && (
      <div style={{
        position: 'absolute', bottom: '9%', right: '4%',
        zIndex: 3, pointerEvents: 'none',
        color: '#e0e8ff', fontSize: 'clamp(10px, 1.2vw, 14px)',
        fontFamily: "'Courier New', monospace", fontWeight: 700,
        letterSpacing: '0.1em',
        textShadow: '0 0 14px rgba(120,180,255,0.9), 0 1px 4px rgba(0,0,0,0.9)',
      }}>
        {timeLeft}
      </div>
    )}

    {!activeBanner.uiAssets?.text && (
      <div style={{ position:'absolute', left:20, bottom:20, zIndex:3, pointerEvents:'none' }}>
        <div style={{ color:activeBanner.accentColor, fontSize:'clamp(18px,3vw,32px)', fontWeight:900 }}>{activeBanner.name}</div>
        <div style={{ color:'rgba(255,255,255,0.5)', fontSize:13 }}>{activeBanner.subtitle}</div>
        <div style={{ color:'rgba(255,255,255,0.35)', fontSize:12, marginTop:4 }}>ends in: {timeLeft}</div>
      </div>
    )}
  </div>

  {/* Characters — outside clip so they pop above, bottom anchored to card bottom */}
  {activeBanner.uiAssets?.char2 && (
    <img src={`${BASE}ui/${activeBanner.uiAssets.char2}.png`} alt="" draggable={false}
      style={{
        position: 'absolute',
        left: '0%', bottom: 1.5,
        height: '120%',
        objectFit: 'contain',
        objectPosition: 'bottom center',
        zIndex: 1,
        pointerEvents: 'none',
      }} />
  )}

  {activeBanner.uiAssets?.char1 && (
    <img src={`${BASE}ui/${activeBanner.uiAssets.char1}.png`} alt="" draggable={false}
      style={{
        position: 'absolute',
        right: '0%', bottom: 1.5,
        height: '120%',
        objectFit: 'contain',
        objectPosition: 'bottom center',
        zIndex: 0,
        pointerEvents: 'none',
      }} />
  )}
</div>
    {/* Pity + buttons */}
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      padding: '8px 20px 16px', width: '100%',
    }}>
      {/* Pity bars */}
      <div style={{
        display: 'flex', gap: 28,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(168,85,247,0.35)',
        borderRadius: 16, padding: '10px 28px',
      }}>
        {[['4★', pity4, 10, '#a855f7'], ['5★', pity5, 90, '#f0c040']].map(([lbl, val, max, clr]) => (
          <div key={lbl} style={{ textAlign: 'center', minWidth: 72 }}>
            <div style={{ color: clr, fontSize: 12, marginBottom: 4 }}>{lbl} Pity</div>
            <div style={{ color: clr, fontSize: 20, fontWeight: 800 }}>
              {val}<span style={{ fontSize: 11, opacity: 0.5 }}>/{max}</span>
            </div>
            <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 5 }}>
              <div style={{ width: `${val / max * 100}%`, height: '100%', background: clr, borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Pull buttons */}
      <div style={{ position: 'relative', lineHeight: 0, userSelect: 'none', width: 'min(96vw, 580px)' }}>
        {/* Base — always visible */}
        <img src={`${BASE}ui/ui_pullbtn.png`} alt="pull buttons" draggable={false}
          style={{ width: '100%', objectFit: 'contain', display: 'block' }} />
        {/* Hover 1 overlay */}
        <img src={`${BASE}ui/ui_pullbtnhover1.png`} alt="" draggable={false}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'contain', display: 'block',
            opacity: hovBtn1 ? 1 : 0, transition: 'opacity 0.1s', pointerEvents: 'none',
          }} />
        {/* Hover 2 overlay */}
        <img src={`${BASE}ui/ui_pullbtnhover2.png`} alt="" draggable={false}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'contain', display: 'block',
            opacity: hovBtn2 ? 1 : 0, transition: 'opacity 0.1s', pointerEvents: 'none',
          }} />
        {/* Click areas */}
        <button
          className="pull-btn-overlay"
          disabled={currency < 1}
          style={{ left: 0, width: '46%', opacity: currency < 1 ? 0.4 : 1 }}
          onMouseEnter={() => setHovBtn1(true)}
          onMouseLeave={() => setHovBtn1(false)}
          onClick={() => startPulls(1)}
        />
        <button
          className="pull-btn-overlay"
          disabled={currency < 10}
          style={{ right: 0, width: '46%', opacity: currency < 10 ? 0.4 : 1 }}
          onMouseEnter={() => setHovBtn2(true)}
          onMouseLeave={() => setHovBtn2(false)}
          onClick={() => startPulls(10)}
        />
      </div>

      <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: 12 }}>
        5★ 0.6% · 4★ 5.1% · 6★ 0.67%
      </div>
    </div>
  </div>
)}

      {/* ── SUMMON skip button overlay ────────────────────────── */}
      {phase === 'summon' && (
        <div style={{ position:'absolute', inset:0, zIndex:51, pointerEvents:'none' }}>
          <button onClick={skipSummon} style={{ position:'absolute', top:20, right:20, pointerEvents:'auto', background:'rgba(255,255,255,0.15)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:10, color:'#fff', fontSize:16, padding:'12px 32px', cursor:'pointer' }}>
            Skip →
          </button>
        </div>
      )}

      {/* ── CARD-VIDEO: name hint only ────────────────────────── */}
      {phase === 'card-video' && currentCard && (
        <div style={{ position:'absolute', inset:0, zIndex:51, pointerEvents:'none' }}>
          <div style={{ position:'absolute', bottom:32, left:0, right:0, textAlign:'center' }}>
            <div style={{ color:rc(currentCard.rarity), fontSize:18, fontWeight:700, textShadow:'0 0 20px rgba(0,0,0,0.8)' }}>
              {'★'.repeat(Math.min(currentCard.rarity,6))} {currentCard.name}
            </div>
          </div>
        </div>
      )}

      {/* ── REVEAL QUEUE ─────────────────────────────────────── */}
      {phase === 'reveal-queue' && batch.length > 0 && currentCard && (() => {
        const c            = currentCard;
        const isHigh       = isHighRarity(c);
        const isLast       = queueIdx >= batch.length - 1;
        const si           = cardInventory[c.id]?.si ?? 0;
        const isS5Dupe     = si >= 4;
        const S5_COIN_VALUES = { 6: 5000, 5: 2500, 4: 500, 3: 100 };
        const coinValue    = S5_COIN_VALUES[c.rarity] || 0;

        return (
          <div
            onClick={advanceQueue}
            style={{
              position:'absolute', inset:0, zIndex:52, cursor:'pointer', overflow:'hidden',
              background:`radial-gradient(ellipse at 50% 55%,${rg(c.rarity)} 0%,#05000f 65%)`,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            }}
          >
            {(c.characterImage || c.image) && (
              <div style={{ position:'absolute', inset:0, zIndex:0, backgroundImage:`url(${c.characterImage||c.image})`, backgroundSize:'cover', backgroundPosition:'center top', filter:'blur(32px) brightness(0.2)', transform:'scale(1.1)' }} />
            )}

            <div style={{ position:'absolute', top:20, left:24, color:'rgba(255,255,255,0.4)', fontSize:14, zIndex:2 }}>{queueIdx+1} / {batch.length}</div>

            {!isHigh && !isLast && (
              <button
                onClick={handleSmartSkip}
                style={{
                  position:'absolute', top:20, right:20, zIndex:10,
                  background:'rgba(255,255,255,0.12)', backdropFilter:'blur(8px)',
                  border:'1px solid rgba(255,255,255,0.2)',
                  borderRadius:10, color:'#fff',
                  fontSize:14, padding:'10px 24px', cursor:'pointer',
                }}
              >
                Skip all →
              </button>
            )}

            <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:18, padding:'20px 32px', textAlign:'center' }}>
              <div style={{ position:'relative' }}>
                <img
                  key={c.instanceId}
                  src={c.characterImage || c.image}
                  alt={c.name}
                  draggable={false}
                  style={{ maxHeight:'50vh', maxWidth:'80vw', objectFit:'contain', filter:`drop-shadow(0 0 40px ${rg(c.rarity)})`, animation:'revealUp 0.6s cubic-bezier(0.34,1.56,0.64,1)', display:'block', opacity: isS5Dupe ? 0.5 : 1 }}
                  onError={e => { const fb = c.characterImage||c.image; if (fb && e.target.src !== fb) e.target.src = fb; }}
                />

                {isS5Dupe && (
                  <div style={{
                    position:'absolute', inset:0, zIndex:3,
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    gap:16,
                    background:'radial-gradient(ellipse at 50% 52%, rgba(240,192,64,0.22) 0%, rgba(0,0,0,0.55) 65%)',
                    animation:'convertOverlay 0.3s ease both',
                  }}>
                    <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <div style={{ position:'absolute', width:90, height:90, borderRadius:'50%', border:'3px solid rgba(240,192,64,0.6)', animation:'ringPulse 1s cubic-bezier(0,0,0.2,1) 0.55s both', pointerEvents:'none' }} />
                      <div style={{ position:'absolute', width:90, height:90, borderRadius:'50%', border:'2px solid rgba(240,192,64,0.35)', animation:'ringPulse 1s cubic-bezier(0,0,0.2,1) 0.75s both', pointerEvents:'none' }} />
                      <img src={`${BASE}ui/ui_cucoin.png`} alt="coin" draggable={false} style={{ width:90, height:90, objectFit:'contain', imageRendering:'pixelated', animation:'coinEntry 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both, coinIdle 2.4s ease-in-out 0.9s infinite, coinShine 2s ease-in-out 1s infinite' }} />
                    </div>
                    <div style={{ fontSize:38, fontWeight:900, color:'#f0c040', textShadow:'0 0 28px rgba(240,192,64,0.95), 0 2px 8px rgba(0,0,0,0.8)', letterSpacing:1, lineHeight:1, animation:'amountPop 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.45s both' }}>
                      +{formatCoins(coinValue)}
                    </div>
                    <div style={{ color:'#f0c040', fontSize:13, fontWeight:800, letterSpacing:4, textShadow:'0 0 14px rgba(240,192,64,0.6)', background:'rgba(0,0,0,0.45)', border:'1px solid rgba(240,192,64,0.4)', borderRadius:20, padding:'5px 20px', animation:'badgeSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.65s both' }}>
                      CONVERTED
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display:'flex', gap:8 }}>
                {[...Array(Math.min(c.rarity,6))].map((_,i) => (
                  <span key={i} style={{ fontSize:28, color:rc(c.rarity), filter:`drop-shadow(0 0 8px ${rc(c.rarity)})`, animation:`starPop 0.45s ${0.1+i*0.07}s cubic-bezier(0.34,1.56,0.64,1) both` }}>★</span>
                ))}
              </div>

              <div>
                <div style={{ fontSize:'clamp(22px,4vw,44px)', fontWeight:900, letterSpacing:1, color:rc(c.rarity), animation:isHigh?'highPulse 2s ease-in-out infinite':'none', opacity: isS5Dupe ? 0.6 : 1 }}>{c.name}</div>
                <div style={{ color:'rgba(255,255,255,0.55)', fontSize:16, marginTop:4, opacity: isS5Dupe ? 0.6 : 1 }}>{c.subtitle}</div>
                {c.ability && <div style={{ color:'rgba(196,181,253,0.7)', fontSize:13, marginTop:6, opacity: isS5Dupe ? 0.6 : 1 }}>✦ {c.ability.name}</div>}
              </div>

              <div style={{ color:'rgba(255,255,255,0.2)', fontSize:13, animation:'tapHint 2s infinite' }}>
                {isLast ? 'tap to finish' : 'tap anywhere for next'}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── RESULTS SUMMARY ──────────────────────────────────── */}
      {phase === 'results' && (summaryBatch.length > 0 || s5CoinsEarned > 0) && (
        <div style={{
          position:'absolute', inset:0, zIndex:60, overflow:'auto',
          background:'linear-gradient(160deg,#07000f 0%,#120020 60%,#07000f 100%)',
          display:'flex', flexDirection:'column', alignItems:'center',
          padding:'24px 16px 40px', color:'#fff',
          zoom: 0.9,
        }}>
          <div style={{ fontSize:'clamp(20px,4vw,36px)', fontWeight:900, letterSpacing:2, marginBottom:4,
            background:'linear-gradient(90deg,#f0c040,#ec4899,#a855f7)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          }}>
            Pull Results
          </div>
          <div style={{ color:'rgba(255,255,255,0.35)', fontSize:14, marginBottom:20 }}>
            {summaryBatch.length + (s5CoinsEarned > 0 ? 1 : 0)} reward{summaryBatch.length + (s5CoinsEarned > 0 ? 1 : 0) !== 1 ? 's' : ''}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:10, width:'100%', maxWidth:680 }}>
            {summaryBatch.map((c, i) => {
              const isHigh = isHighRarity(c);
              return (
                <div
                  key={c.instanceId || i}
                  className={`result-tile${isHigh ? ' tile-high' : ''}`}
                  onClick={() => setSelectedResult(c)}
                  style={{
                    cursor:'pointer',
                    background:'linear-gradient(175deg,#1a0030,#08000e)',
                    border:`2px solid ${rc(c.rarity)}`,
                    boxShadow:`0 0 ${isHigh ? 18 : 8}px ${rg(c.rarity)}, inset 0 0 ${isHigh ? 12 : 4}px ${rg(c.rarity)}`,
                  }}
                >
                  <img
                    src={c.characterImage || c.image}
                    alt={c.name}
                    draggable={false}
                    style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', objectPosition:'center center', filter:`brightness(${isHigh ? 1.05 : 0.85})` }}
                    onError={e => { const fb = c.characterImage||c.image; if (fb && e.target.src !== fb) e.target.src = fb; }}
                  />
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.82) 0%,transparent 55%)', zIndex:1 }} />
                  <div style={{ position:'relative', zIndex:2, textAlign:'center', padding:'0 4px 8px', width:'100%' }}>
                    <div style={{ display:'flex', justifyContent:'center', gap:1, marginBottom:2 }}>
                      {[...Array(Math.min(c.rarity, 6))].map((_, si) => (
                        <span key={si} style={{ fontSize:9, color:rc(c.rarity), filter:`drop-shadow(0 0 3px ${rc(c.rarity)})` }}>★</span>
                      ))}
                    </div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.9)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>
                      {c.name}
                    </div>
                  </div>
                </div>
              );
            })}

            {s5CoinsEarned > 0 && (
              <div style={{
                display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'flex-end', gap:6,
                width:'100%', aspectRatio:'3/4',
                borderRadius:12, overflow:'hidden',
                position:'relative', cursor:'default',
                background:'linear-gradient(175deg,#1a1500,#0a0a00)',
                border:`2px solid #f0c040`,
                boxShadow:`0 0 18px rgba(240,192,64,0.6), inset 0 0 12px rgba(240,192,64,0.3)`,
              }}>
                <div style={{ position:'absolute', inset:0, zIndex:0, backgroundImage:`url(${BASE}ui/ui_cucoin.png)`, backgroundSize:'60%', backgroundPosition:'center', backgroundRepeat:'no-repeat', opacity:0.1 }} />
                <div style={{ position:'relative', zIndex:2, textAlign:'center', padding:'0 4px 8px', width:'100%' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>💰</div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#f0c040', textShadow:'0 1px 4px rgba(0,0,0,0.9)' }}>
                    +{formatCoins(s5CoinsEarned)}
                  </div>
                  <div style={{ fontSize:11, color:'rgba(240,192,64,0.7)', marginTop:4 }}>S5 Dupes</div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => { setSummaryBatch([]); setPhase('idle'); setS5CoinsEarned(0); }}
            style={{ marginTop:32, padding:'14px 52px', borderRadius:14, background:'linear-gradient(135deg,#7c3aed,#db2777)', boxShadow:'0 0 28px rgba(124,58,237,0.55)', border:'none', color:'#fff', fontSize:17, fontWeight:800, cursor:'pointer', letterSpacing:1 }}
            onMouseEnter={e => e.currentTarget.style.transform='scale(1.06)'}
            onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
          >
            Close
          </button>
        </div>
      )}

      {/* ── CARD ART LIGHTBOX ────────────────────────────────── */}
      {showArt && (
        <div
          onClick={() => setShowArt(null)}
          style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.97)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
        >
          <img src={showArt.cardArt} alt={showArt.name} draggable={false} style={{ maxWidth:'90vw', maxHeight:'82vh', objectFit:'contain', borderRadius:12 }} onClick={e => e.stopPropagation()} />
          <div style={{ marginTop:14, textAlign:'center' }}>
            <div style={{ color:rc(showArt.rarity), fontSize:16, marginBottom:4 }}>{'★'.repeat(Math.min(showArt.rarity,6))} {showArt.name}</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:13 }}>{showArt.subtitle}</div>
            <div style={{ color:'rgba(255,255,255,0.2)', fontSize:12, marginTop:8 }}>tap anywhere to close</div>
          </div>
        </div>
      )}

      {/* ── CARD DETAIL MODAL ────────────────────────────────── */}
      {selectedResult && (
        <div
          onClick={() => setSelectedResult(null)}
          style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background:'linear-gradient(160deg,#12001f,#07000e)', border:`2px solid ${rc(selectedResult.rarity)}`, borderRadius:18, padding:24, width:'100%', maxWidth:360, color:'#fff', position:'relative', boxShadow:`0 0 40px ${rg(selectedResult.rarity)}` }}
          >
            <div
              onClick={() => { if (selectedResult.cardArt) { setSelectedResult(null); setShowArt(selectedResult); } }}
              style={{ width:'100%', aspectRatio:'1', borderRadius:12, overflow:'hidden', marginBottom:8, border:`2px solid ${rc(selectedResult.rarity)}88`, cursor: selectedResult.cardArt ? 'zoom-in' : 'default', background:'#0a0010' }}
            >
              <img src={selectedResult.characterImage || selectedResult.image} alt={selectedResult.name} style={{ width:'100%', height:'100%', objectFit:'contain', objectPosition:'center center' }} onError={e => { const fb = selectedResult.characterImage||selectedResult.image; if(fb&&e.target.src!==fb) e.target.src=fb; }} />
            </div>
            {selectedResult.cardArt && <div style={{ color:'rgba(255,255,255,0.25)', fontSize:11, textAlign:'center', marginBottom:10 }}>tap image for full art</div>}

            <div style={{ display:'flex', gap:3, justifyContent:'center', marginBottom:6 }}>
              {[...Array(Math.min(selectedResult.rarity,6))].map((_,i) => (
                <span key={i} style={{ fontSize:16, color:rc(selectedResult.rarity), filter:`drop-shadow(0 0 4px ${rc(selectedResult.rarity)})` }}>★</span>
              ))}
            </div>
            <div style={{ fontSize:22, fontWeight:900, color:rc(selectedResult.rarity), textAlign:'center', marginBottom:2 }}>{selectedResult.name}</div>
            <div style={{ color:'rgba(255,255,255,0.45)', fontSize:13, textAlign:'center', marginBottom:14 }}>{selectedResult.subtitle}</div>

            {selectedResult.stats && (
              <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:14 }}>
                {[['HP', selectedResult.stats.hp,'#44cc66'],['ATK', selectedResult.stats.atk,'#f0c040'],['DEF', selectedResult.stats.def,'#5588ff']].map(([lbl,val,clr]) => (
                  <div key={lbl} style={{ textAlign:'center', background:'rgba(0,0,0,0.4)', borderRadius:8, padding:'6px 14px' }}>
                    <div style={{ color:'rgba(255,255,255,0.35)', fontSize:10 }}>{lbl}</div>
                    <div style={{ color:clr, fontWeight:800, fontSize:16 }}>{val ?? '—'}</div>
                  </div>
                ))}
              </div>
            )}

            {selectedResult.ability && (
              <div style={{ background:'rgba(240,192,64,0.07)', border:'1px solid rgba(240,192,64,0.25)', borderRadius:8, padding:'8px 12px', marginBottom:8 }}>
                <div style={{ color:'#f0c040', fontWeight:700, marginBottom:4 }}>✦ {selectedResult.ability.name}</div>
                <div style={{ color:'#aaa', fontSize:12 }}>{selectedResult.ability.description}</div>
                {selectedResult.ability.cooldown && <div style={{ color:'#556', fontSize:11, marginTop:4 }}>CD: {selectedResult.ability.cooldown}s</div>}
              </div>
            )}

            {selectedResult.passive && (
              <div style={{ background:'rgba(85,136,255,0.07)', border:'1px solid rgba(85,136,255,0.2)', borderRadius:8, padding:'8px 12px' }}>
                <div style={{ color:'#88aaff', fontWeight:700, marginBottom:4 }}>◈ {selectedResult.passive.name}</div>
                <div style={{ color:'#aaa', fontSize:12 }}>{selectedResult.passive.description}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BANNER SELECT MODAL ──────────────────────────────── */}
      {showBannerSelect && (
        <div
          onClick={() => setShowBannerSelect(false)}
          style={{
            position:'fixed', inset:0, zIndex:150,
            background:'rgba(0,0,0,0.88)', backdropFilter:'blur(10px)',
            display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center',
            gap:14, padding:24,
          }}
        >
          <div style={{ fontSize:22, fontWeight:900, color:'#fff', marginBottom:4, letterSpacing:1 }}>Select Banner</div>
          <div style={{ color:'rgba(255,255,255,0.3)', fontSize:13, marginBottom:8 }}>Choose which banner to pull from</div>

          {BANNERS.map(banner => {
            const isActive = banner.id === activeBannerId;
            return (
              <div
                key={banner.id}
                className="banner-card"
                onClick={e => { e.stopPropagation(); setActiveBannerId(banner.id); setShowBannerSelect(false); }}
                style={{
                  width:'100%', maxWidth:420,
                  background: isActive
                    ? `linear-gradient(135deg,${banner.accentColor}22,#12002288)`
                    : 'rgba(255,255,255,0.03)',
                  border:`2px solid ${isActive ? banner.accentColor : 'rgba(255,255,255,0.1)'}`,
                  borderRadius:16, padding:'16px 22px', cursor:'pointer',
                  boxShadow: isActive ? `0 0 20px ${banner.accentColor}44` : 'none',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = banner.accentColor}
                onMouseLeave={e => e.currentTarget.style.borderColor = isActive ? banner.accentColor : 'rgba(255,255,255,0.1)'}
              >
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:16, color:banner.accentColor }}>{banner.name}</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{banner.subtitle}</div>
                  </div>
                  {isActive && (
                    <div style={{ fontSize:12, color:banner.accentColor, fontWeight:700, background:`${banner.accentColor}22`, border:`1px solid ${banner.accentColor}66`, borderRadius:20, padding:'4px 12px' }}>
                      ✓ Active
                    </div>
                  )}
                </div>
                {banner.featuredIds.length > 0 && (
                  <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:6 }}>
                    {banner.featuredIds.map(id => {
                      const char = CHARACTERS.find(c => c.id === id);
                      if (!char) return null;
                      return (
                        <div key={id} style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(0,0,0,0.35)', border:`1px solid ${rc(char.rarity)}44`, borderRadius:20, padding:'3px 10px' }}>
                          <span style={{ color:rc(char.rarity), fontSize:10 }}>{'★'.repeat(Math.min(char.rarity,6))}</span>
                          <span style={{ color:'rgba(255,255,255,0.7)', fontSize:12, fontWeight:600 }}>{char.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ color:'rgba(255,255,255,0.2)', fontSize:12, marginTop:4 }}>tap outside to cancel</div>
        </div>
      )}

    </div>
  );
}