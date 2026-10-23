import { useState, useEffect, useRef } from 'react';
import { CHARACTERS } from '../data/characters';
import { BANNERS } from '../data/banners';
import { bannerStatus, formatTimeLeft, formatLength } from '../utils/bannerSchedule';
import { useLiveSchedule } from '../utils/liveSchedule';
import { playClose, preloadSound, playMusic, stopMusic, musicElapsed, playStamp, playScribble } from '../utils/sfx';
import { thumb } from '../utils/assets';
import FocusImg from '../components/FocusImg';
import { getSettings } from '../utils/settings';

const BASE = import.meta.env.BASE_URL;

const RARITY_COLOR = { 6:'#ff4444', 5:'#f0c040', 4:'#a855f7', 3:'#60a5fa' };
const RARITY_GLOW  = { 6:'rgba(255,50,50,0.7)', 5:'rgba(240,192,64,0.6)', 4:'rgba(168,85,247,0.6)', 3:'rgba(96,165,250,0.5)' };
const SUMMON_VID   = {
  6: `${BASE}animations/6star.mp4`,
  5: `${BASE}animations/5star.mp4`,
  4: `${BASE}animations/4star.mp4`,
  3: `${BASE}animations/3star.mp4`,
};
// Extra sound on a 5★+ pull, on top of the video's own audio. The file was never
// added (every 5★ pull asked for it and got a 404), so it's off until there is one:
// drop it in public/sounds/ and put its name here, e.g. 'sounds/pull_5star.mp3'
const PULL_5STAR_SFX = null;

const rc = r => RARITY_COLOR[r] || '#fff';
// Build-up before a card with pull music: the silhouette shakes harder and harder
const TREMBLE = Array.from({ length: 41 }, (_, i) => {
  const p = i / 40, a = p * p * 9;
  return `${(p * 100).toFixed(1)}%{transform:translate(${((i % 2 ? 1 : -1) * a).toFixed(1)}px,${(((i % 3) - 1) * a * 0.6).toFixed(1)}px)}`;
}).join(' ');
// 1×1 black poster: hides the grey "play" placeholder phones show before a video starts
const BANNER_KEY = 'frail_banner';
const FORCE5_KEY = 'frail_force5';   // dev: guaranteed 5★ toggle
const BLANK_POSTER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const rg = r => RARITY_GLOW[r]  || 'transparent';
const isHighRarity = card => card && card.rarity >= 5;
// A card's reveal video: one path, or { wide, tall } (phones held upright get `tall`)
const pickVideo = v => (!v ? null : typeof v === 'string' ? v
  : (window.innerHeight > window.innerWidth ? v.tall ?? v.wide : v.wide ?? v.tall) ?? null);

// Banner art layer: a path inside public/ (written out in full so the build can turn it into a
// light WebP), or just a file name in public/ui/ without .png
const uiArt = p => (p.includes('/') ? `${BASE}${p}` : `${BASE}ui/${p}.png`);
// Where a banner art layer goes on the 16:10 banner card.
//  • with uiFrame: every layer is the same picture size and the card is the rectangle `card`
//    in it, so each layer is scaled and shifted until that rectangle covers the card
//  • without (Retirement Home layout, 3183×2447): bg/text at 130% height shifted up 30%,
//    characters at 120% height standing on the card's bottom edge, char2 left, char1 right
const artStyle = (banner, kind) => {
  const z = { bg: 0, char1: 0, char2: 1, text: 2 }[kind];
  const f = banner.uiFrame;
  if (f) {
    const [W, H] = f.size, [x, y, w, h] = f.card;
    return { position: 'absolute', left: `${-x / w * 100}%`, top: `${-y / h * 100}%`, width: `${W / w * 100}%`, height: `${H / h * 100}%`,
      maxWidth: 'none', objectFit: 'fill', zIndex: z, pointerEvents: 'none' };
  }
  if (kind === 'bg' || kind === 'text') return { position: 'absolute', top: '-30%', left: 0, width: '100%', height: '130%', objectFit: 'fill', zIndex: z, pointerEvents: 'none' };
  return { position: 'absolute', [kind === 'char2' ? 'left' : 'right']: '0%', bottom: 1.5, height: '120%', objectFit: 'contain', objectPosition: 'bottom center', zIndex: z, pointerEvents: 'none' };
};

const formatCoins = v => v >= 1000 ? `${Math.floor(v / 1000)}k` : String(v);

const GemImg = ({ size = 22 }) => (
  <img
    src={`${BASE}ui/ui_frailite.png`}
    alt="gem"
    style={{ width: size, height: size, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0, verticalAlign: 'middle' }}
  />
);

// ── Pull logic ────────────────────────────────────────────────────
// force5 (dev): every pull is a 5★ — a featured one on banners that have them
function doPulls(count, pity4, pity5, banner, force5 = false) {
  let p4 = pity4, p5 = pity5;
  const results = [];

  for (let i = 0; i < count; i++) {
    p4++; p5++;
    const rand = Math.random() * 100;
    let rarity;
    // 0.6% base 5★ rate, soft pity from 60, hard pity at 90.
    // (Before, 5★ was impossible until pull 60.)
    const rate5 = p5 >= 60 ? 2 + (p5 - 60) * 6 : 0.6;
    if (force5) {
      rarity = 5;
    } else if (p5 >= 90 || rand < rate5) {
      rarity = Math.random() < 0.1 ? 6 : 5; p5 = 0;
    } else if (p4 >= 10 || rand < 5.1) {
      rarity = 4; p4 = 0;
    } else {
      rarity = 3;
    }

    let pool = CHARACTERS.filter(c => c.rarity === rarity && !c.unpullable);   // unpullable: not released yet

    if (
      banner.featuredIds.length > 0 &&
      rarity === banner.boostedRarity &&
      (force5 || Math.random() < banner.boostedChance)
    ) {
      const featuredOfRarity = CHARACTERS.filter(c =>
        banner.featuredIds.includes(c.id) && c.rarity === rarity && !c.unpullable
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
  // the debug toggle doesn't touch pity
  return force5 ? { results, newPity4: pity4, newPity5: pity5 } : { results, newPity4: p4, newPity5: p5 };
}

// ── Clock ─────────────────────────────────────────────────────
// Ticks once a second: runs the banner countdown and swaps the banner when one
// ends. Which banners are live comes from the owner's schedule (utils/liveSchedule.js).
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return now;
}

// ─────────────────────────────────────────────────────────────────
export default function GachaScreen({
  navigate, currency, setCurrency,
  collection, setCollection,
  pity4, setPity4, pity5, setPity5,
  cardInventory = {},
  setCoins,
  devMode = false,
  profile = null,
}) {
  const [phase,           setPhase]           = useState('idle');
  const [batch,           setBatch]           = useState([]);
  const [queueIdx,        setQueueIdx]        = useState(0);
  const [highestRar,      setHighestRar]      = useState(3);
  const [showArt,         setShowArt]         = useState(null);
  const [selectedResult,  setSelectedResult]  = useState(null);
  const [summaryBatch,    setSummaryBatch]    = useState([]);
  // remembers the banner you were on (per device); if it's no longer live you get the current one
  const [activeBannerId,  setActiveBannerIdRaw] = useState(() => {
    try { return localStorage.getItem(BANNER_KEY); } catch { return null; }
  });
  const setActiveBannerId = (id) => {
    setActiveBannerIdRaw(id);
    try { localStorage.setItem(BANNER_KEY, id); } catch { /* storage blocked */ }
  };
  const [showBannerSelect,setShowBannerSelect]= useState(false);
  const [s5CoinsEarned,   setS5CoinsEarned]   = useState(0);

  // ── Custom banner UI state ──────────────────────────────────
  const [hovBtn1, setHovBtn1] = useState(false);
  const [hovBtn2, setHovBtn2] = useState(false);

  const now = useNow();
  const schedule = useLiveSchedule();
  const { live, endsAt, upcoming } = bannerStatus(now, schedule);
  const activeBanner = live.find(b => b.id === activeBannerId) || live[0] || BANNERS[0];
  const isPermanent = b => !(b.id in endsAt);
  const timeLeftOf = b => isPermanent(b) ? 'Permanent' : formatTimeLeft(endsAt[b.id] - now);
  const timeLeft = timeLeftOf(activeBanner);

  // Dev: every pull is a 5★ (remembered; only works while dev mode is on)
  const [force5Raw, setForce5Raw] = useState(() => { try { return localStorage.getItem(FORCE5_KEY) === '1'; } catch { return false; } });
  const force5 = devMode && force5Raw;
  const toggleForce5 = () => {
    const v = !force5Raw;
    setForce5Raw(v);
    try { if (v) localStorage.setItem(FORCE5_KEY, '1'); else localStorage.removeItem(FORCE5_KEY); } catch { /* storage blocked */ }
  };

  const summonRef = useRef(null);
  const audioRef  = useRef(null);
  const batchRef  = useRef([]);
  const phaseRef  = useRef('idle');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => { batchRef.current = batch; }, [batch]);

  const currentCard = batch[queueIdx] ?? null;

  // Paper sounds, timed to the animations: a scribble as a Polaroid's caption is
  // written, a thud when each stamp lands (reveal: one card; report: every file)
  useEffect(() => {
    if (phase !== 'reveal-queue' || !currentCard) return;
    const high = currentCard.rarity >= 5;
    const rowCount = 2 + (currentCard.element ? 1 : 0) + (currentCard.skill ? 1 : 0) + (currentCard.ult ? 1 : 0);
    const timers = [setTimeout(() => playStamp(), (high ? 0.75 + rowCount * 0.16 + 0.2 : 1.3) * 1000)];
    if (!high) timers.push(setTimeout(() => playScribble(0.8, 0.8), 700));
    return () => timers.forEach(clearTimeout);
  }, [phase, currentCard]);
  useEffect(() => {
    if (phase !== 'results' || !summaryBatch.length) return;
    const n = summaryBatch.length, first = 0.35 + n * 0.08;
    const timers = summaryBatch.map((_, i) => setTimeout(() => playStamp(0.55), (first + i * 0.07 + 0.18) * 1000));
    return () => timers.forEach(clearTimeout);
  }, [phase, summaryBatch]);

  // Pull music build-up: { lead, key } once the track is fading in; flash = the drop just hit
  const [build, setBuild] = useState(null);
  const [flash, setFlash] = useState(false);
  const revealNowRef = useRef(null);
  useEffect(() => () => stopMusic(0.2), []);   // leaving the gacha screen

  const stopAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };
  const playAudio = src => {
    const vol = getSettings().volume;   // Settings → Volume (0 = silent)
    if (!src || !audioRef.current || vol <= 0) return;
    audioRef.current.volume = Math.min(1, vol);
    audioRef.current.src = src;
    audioRef.current.load();
    audioRef.current.play().catch(() => {});
  };
  // Phones (and the Claude app) can block video with sound until you've
  // interacted, and Android shows a grey "play" placeholder while a video
  // isn't playing. So: stay invisible until frames actually play, retry
  // muted if sound is blocked, and skip ahead if it still won't start.
  const [vidPlaying, setVidPlaying] = useState(false);
  const vidTimer = useRef(null);
  const playVideo = (ref, src, onFail) => {
    const v = ref.current;
    if (!v || !src) { onFail?.(); return; }
    setVidPlaying(false);
    clearTimeout(vidTimer.current);
    const vol = getSettings().volume;   // Settings → Volume (iPhones ignore .volume, so 0 also mutes)
    v.volume = Math.min(1, Math.max(0, vol));
    v.muted = vol <= 0;
    v.src = src;
    v.load();
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => onFail?.());
    });
    // slow connection / stuck decoder: don't leave the player staring at black
    vidTimer.current = setTimeout(() => { if (v.paused) onFail?.(); }, 9000);
  };
  useEffect(() => () => clearTimeout(vidTimer.current), []);

  const enterCard = (idx, cards) => {
    const b    = cards || batchRef.current;
    const card = b[idx];
    setQueueIdx(idx);
    if (isHighRarity(card) && pickVideo(card.resultVideo)) {
      setPhase('card-video');
    } else if (card?.pullMusic) {
      setPhase('buildup');
    } else {
      setPhase('reveal-queue');
    }
  };

  useEffect(() => {
    if (phase !== 'summon') return;
    playVideo(summonRef, SUMMON_VID[highestRar] || SUMMON_VID[3], () => skipSummonRef.current());
  }, [phase, highestRar]);

  // A card's reveal video (the older 5★ reveals, the Anemic Kaisen eyecatch).
  // With pull music, the track fades in under the last `lead` seconds of the
  // video and the card is revealed on its drop, right as the video ends.
  const videoDropRef = useRef(null);
  useEffect(() => {
    if (phase !== 'card-video') return;
    const card = batchRef.current[queueIdx];
    const src = pickVideo(card?.resultVideo), pm = card?.pullMusic;
    videoDropRef.current = null;
    // video won't play: the build-up instead (if it has music), or straight to the card
    if (!src) { setPhase(pm ? 'buildup' : 'reveal-queue'); return; }
    playVideo(summonRef, src, () => setPhase(pm ? 'buildup' : 'reveal-queue'));
    if (!pm) return;
    const lead = Math.max(0.5, Math.min(pm.lead ?? 2, pm.drop, 3));   // 2 s under the eyecatch unless the card asks for more (Astrec: 3)
    let raf = 0, done = false, started = false, h = null;
    const reveal = () => {
      if (done) return;
      done = true; cancelAnimationFrame(raf); clearTimeout(vidTimer.current);
      summonRef.current?.pause();
      setFlash(true); setPhase('reveal-queue');
    };
    const toDrop = () => { if (!done) { playMusic(pm.src, { offset: pm.drop }); reveal(); } };
    videoDropRef.current = {
      skip: toDrop,                                   // tapped: straight to the drop
      ended: () => (h ? reveal() : toDrop()),         // video over: the drop is now
    };
    const tick = () => {
      const v = summonRef.current;
      if (!started && v && isFinite(v.duration) && v.duration > 0 && v.currentTime >= v.duration - lead) {
        started = true;
        playMusic(pm.src, { offset: pm.drop - lead, fadeIn: lead }).then(x => { h = x; });
      }
      if (h && musicElapsed(h) >= lead) { reveal(); return; }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { done = true; cancelAnimationFrame(raf); };
  }, [phase, queueIdx]);

  // Cards with pull music: the track fades in `lead` seconds before its drop
  // and the card is revealed right on the drop (timed off the audio clock).
  // Tapping skips straight to the drop.
  useEffect(() => {
    if (phase !== 'buildup') return;
    const pm = batchRef.current[queueIdx]?.pullMusic;
    if (!pm) { setPhase('reveal-queue'); return; }
    const lead = Math.max(0.5, Math.min(pm.lead ?? 2.5, pm.drop));
    let done = false, raf = 0;
    const reveal = () => {
      if (done) return;
      done = true; cancelAnimationFrame(raf); clearTimeout(giveUp);
      setBuild(null); setFlash(true); setPhase('reveal-queue');
    };
    revealNowRef.current = () => { if (!done) { playMusic(pm.src, { offset: pm.drop }); reveal(); } };
    const giveUp = setTimeout(reveal, (lead + 4) * 1000);   // track didn't load in time: reveal anyway
    setBuild(null);
    playMusic(pm.src, { offset: pm.drop - lead, fadeIn: lead }).then(h => {
      if (done) return;
      if (!h) { reveal(); return; }
      setBuild({ lead, key: queueIdx });   // starts the build-up animation in step with the music
      const tick = () => { if (musicElapsed(h) >= lead) reveal(); else raf = requestAnimationFrame(tick); };
      tick();
    });
    return () => { done = true; cancelAnimationFrame(raf); clearTimeout(giveUp); };
  }, [phase, queueIdx]);

  useEffect(() => {
    if (phase !== 'reveal-queue') return;
    const card = batchRef.current[queueIdx];
    stopAudio();
    if (card?.voiceLine) playAudio(card.voiceLine);
  }, [phase, queueIdx]);

  const startPulls = cnt => {
    if ((phase !== 'idle' && phase !== 'results') || currency < cnt || activeBanner.comingSoon) return;   // comingSoon: banner shown, pulls closed
    setSummaryBatch([]); setS5CoinsEarned(0);
    setCurrency(c => c - cnt);
    const { results, newPity4, newPity5 } = doPulls(cnt, pity4, pity5, activeBanner, force5);
    setPity4(newPity4);
    setPity5(newPity5);

    const S5_COIN_VALUES = { 6: 5000, 5: 2500, 4: 500, 3: 100 };
    let coinsFromS5 = 0;

    // for the results screen: NEW the first time you ever get a card, "maxed" when it turned into coins
    const owned = new Set(collection.map(c => c.id));
    results.forEach(r => { r.isNew = !owned.has(r.id); owned.add(r.id); r.maxed = (cardInventory[r.id]?.si ?? 0) >= 4; });

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

    setCollection(prev => [...prev, ...collectionResults.map(c => ({ id: c.id }))]);

    results.forEach(r => preloadSound(r.pullMusic?.src));   // ready by the time its card comes up
    batchRef.current = results;
    setBatch(results);
    setQueueIdx(0);

    const maxRar = Math.max(...results.map(r => r.rarity));
    setHighestRar(maxRar);
    if (maxRar >= 5 && PULL_5STAR_SFX) {
      try { const a = new Audio(`${BASE}${PULL_5STAR_SFX}`); a.volume = 0.85 * getSettings().volume; a.play().catch(() => {}); } catch { /* empty */ }
    }
    setPhase('summon');
  };

  const onSummonEnd = () => enterCard(0, batchRef.current);

  const skipSummon = () => {
    clearTimeout(vidTimer.current);
    if (summonRef.current) summonRef.current.pause();
    if (phaseRef.current === 'summon') onSummonEnd();
  };
  const skipSummonRef = useRef(skipSummon);
  skipSummonRef.current = skipSummon;

  const onCardVideoEnd = (tapped) => {
    const drop = videoDropRef.current;
    if (drop) { tapped === true ? drop.skip() : drop.ended(); return; }   // pull music: reveal on its drop
    clearTimeout(vidTimer.current);
    if (summonRef.current) summonRef.current.pause();
    setPhase('reveal-queue');
  };

  const advanceQueue = () => {
    stopAudio(); stopMusic(); setFlash(false);
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
    stopAudio(); stopMusic(); setFlash(false);
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


  // ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed', inset:0, fontFamily:'var(--font-ui)', userSelect:'none' }}>

      <audio ref={audioRef} style={{ display:'none' }} />

      {/* The pull animation and the per-card reveal videos (eyecatch) share one player:
          iPhones only let a player use sound after it was started from a tap, and the
          pull tap unlocks this one — a second player would play the eyecatch muted */}
      {(phase === 'summon' || phase === 'card-video') && <div style={{ position:'absolute', inset:0, background:'#000', zIndex:49 }} />}
      <video
        ref={summonRef}
        onEnded={() => {
          if (phaseRef.current === 'summon') onSummonEnd();
          else if (phaseRef.current === 'card-video') onCardVideoEnd();
        }}
        onPlaying={() => setVidPlaying(true)}
        onError={() => {
          if (phaseRef.current === 'summon') { skipSummon(); return; }
          if (phaseRef.current !== 'card-video') return;
          if (videoDropRef.current) { videoDropRef.current = null; setPhase('buildup'); }   // eyecatch missing: the build-up instead
          else onCardVideoEnd();
        }}
        playsInline preload="auto" poster={BLANK_POSTER}
        disablePictureInPicture controls={false}
        style={{
          position:'absolute', inset:0, width:'100%', height:'100%',
          objectFit:'cover', background:'#000', zIndex:50,
          display: phase === 'summon' || phase === 'card-video' ? 'block' : 'none',
          opacity: vidPlaying ? 1 : 0,
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
        @keyframes buildGlow       { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1.5)} }
        @keyframes buildRise       { from{opacity:0;transform:scale(0.75)} 30%{opacity:0.9} to{opacity:1;transform:scale(1.06)} }
        @keyframes buildTremble    { ${TREMBLE} }
        @keyframes dropFlash       { 0%{opacity:0.95} 100%{opacity:0} }
        @keyframes dropJolt        { 0%{transform:scale(1.18)} 25%{transform:scale(0.96) translate(-6px,4px)} 45%{transform:scale(1.03) translate(5px,-3px)} 70%{transform:scale(0.99) translate(-2px,1px)} 100%{transform:scale(1)} }
        /* reveal queue (one card at a time) */
        .rv-screen { position:absolute; inset:0; z-index:52; cursor:pointer; overflow:hidden; display:flex; flex-direction:column; align-items:center; justify-content:center;
          font-family:var(--font-dialogue); color:#e9e1cc; padding:56px 16px 44px; }
        .rv-desk { position:absolute; inset:0; z-index:-2;
          background: radial-gradient(ellipse 55% 45% at 50% 45%, color-mix(in srgb, var(--rg) 70%, transparent), transparent 70%),
                      radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,196,110,0.16), transparent 70%),
                      repeating-linear-gradient(92deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 7px),
                      linear-gradient(180deg, #1d1612 0%, #120d0b 55%, #070506 100%); }
        .rv-screen.agent .rv-desk { background: radial-gradient(ellipse 50% 60% at 35% 50%, color-mix(in srgb, var(--rg) 90%, transparent), transparent 70%),
                      radial-gradient(circle, rgba(0,0,0,.35) 30%, transparent 34%) 0 0/14px 14px, linear-gradient(160deg, #0d0a14 0%, #070509 100%); }
        .rv-band { position:absolute; left:-20%; width:140%; z-index:-1; transform:rotate(-12deg); }
        .rv-band.b1 { top:58%; height:22%; background: color-mix(in srgb, var(--rc) 85%, #000); animation: rvBandL .45s cubic-bezier(.2,.9,.2,1) both; }
        .rv-band.b2 { top:18%; height:5%; background:#f4f1ea; opacity:.85; animation: rvBandR .45s .12s cubic-bezier(.2,.9,.2,1) both; }
        .rv-top { position:absolute; top:16px; left:20px; right:20px; display:flex; justify-content:space-between; align-items:center; font-size:13px; letter-spacing:2px; color:#b9ab8c; z-index:5; }
        .rv-skip { font-family:var(--font-dialogue); font-size:13px; letter-spacing:1px; padding:7px 14px; border-radius:4px; cursor:pointer; color:#2a2219; background:#e7dcc2; border:2px solid #000; box-shadow:3px 3px 0 #000; }
        .rv-flash { position:absolute; inset:0; z-index:20; background:#fff; pointer-events:none; animation: dropFlash 0.8s ease-out forwards; }
        .rv-tap { position:absolute; bottom:16px; left:0; right:0; text-align:center; font-size:12px; letter-spacing:2px; color:rgba(233,225,204,.4); animation: tapHint 2s infinite; }
        /* 5★/6★ agent */
        .rv-agent { display:flex; align-items:center; justify-content:center; gap:clamp(12px,3vw,40px); width:100%; max-width:1000px; height:100%; }
        .rv-art { flex:1 1 55%; height:100%; display:flex; align-items:center; justify-content:center; min-width:0; }
        .rv-cutout { max-width:100%; max-height:min(72vh, 620px); object-fit:contain; filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 24px var(--rc)) drop-shadow(0 12px 30px rgba(0,0,0,.6));
          animation: rvArtIn .6s cubic-bezier(.2,.9,.25,1.1) both; }
        .rv-photo { position:relative; display:block; height:min(66vh, 560px); aspect-ratio: 2424 / 3552; max-width:100%; padding:10px; background:#f4f1ea; transform:rotate(-3deg);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--rc) 70%, transparent), 0 0 40px var(--rg), 0 16px 40px rgba(0,0,0,.7); animation: rvArtIn .6s cubic-bezier(.2,.9,.25,1.1) both; }
        .rv-photo img { width:100%; height:100%; object-fit:cover; display:block; }
        .rv-clip { position:absolute; top:-12px; left:18%; width:20px; height:50px; border:4px solid #e7b94a; border-radius:10px; z-index:2; }
        .rv-dossier { position:relative; flex:0 1 360px; min-width:0; padding:16px 18px 18px; color:#211a12; border-radius:3px; border-top:5px solid var(--rc);
          background: radial-gradient(ellipse at 30% 15%, rgba(255,255,255,.45), transparent 60%), repeating-linear-gradient(0deg, rgba(120,95,60,.05) 0 1px, transparent 1px 3px), #ece2c9;
          box-shadow: 0 16px 40px rgba(0,0,0,.7); transform: rotate(1.5deg); animation: rvDossIn .5s .2s cubic-bezier(.2,.9,.25,1.1) both; }
        .rv-dhead { display:flex; justify-content:space-between; gap:8px; font-size:9.5px; letter-spacing:1.5px; color:#6f6150; border-bottom:1.5px solid #211a12; padding-bottom:5px; }
        .rv-stars { color:var(--rc); letter-spacing:0; font-size:12px; text-shadow:0 0 6px var(--rg); }
        .rv-name { font-family:var(--font-dramatic); font-size:clamp(30px,4vw,46px); line-height:1.05; margin:8px 0 6px; color:#160f08; }
        .rv-row { display:flex; gap:10px; align-items:baseline; border-bottom:1px dotted rgba(40,30,20,.35); padding:3px 0; animation: rvType .5s steps(24) both; }
        .rv-row i { font-style:normal; font-size:9.5px; letter-spacing:1.5px; color:#6f6150; width:76px; flex-shrink:0; }
        .rv-row b { font-weight:400; font-size:14px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .rv-stamp { position:absolute; right:10px; top:26px; font-family:var(--font-hit); font-size:34px; letter-spacing:2px; padding:0 10px; border:4px solid currentColor; border-radius:7px;
          transform:rotate(-14deg); opacity:.88; mix-blend-mode:multiply; animation: prStamp .3s cubic-bezier(.3,1.4,.5,1) both; pointer-events:none; }
        .rv-stamp.hired { color:#b3121b; } .rv-stamp.promoted { color:#1f5fa8; font-size:26px; } .rv-stamp.surplus { color:#5b4a2a; font-size:28px; }
        .rv-approve { display:flex; align-items:flex-end; gap:10px; margin-top:10px; border-bottom:1.5px solid #211a12; padding-bottom:2px; animation: rvWrite .6s steps(14) both; }
        .rv-approve span { font-size:9.5px; letter-spacing:1.5px; color:#6f6150; padding-bottom:4px; }
        .rv-approve img { height:40px; max-width:220px; object-fit:contain; transform:rotate(-3deg); }
        .pr-approve { display:flex; align-items:flex-end; gap:6px; margin-top:2px; }
        .pr-approve i { font-style:normal; font-size:8px; letter-spacing:1px; color:#7a6a50; padding-bottom:3px; }
        .pr-approve img { height:22px; max-width:70%; object-fit:contain; transform:rotate(-3deg); }
        .rv-coins { display:flex; align-items:center; gap:6px; margin-top:10px; font-size:13px; color:#5b4a2a; animation: prFade .4s ease both; }
        .rv-coins img { width:20px; height:20px; image-rendering:pixelated; }
        .rv-coins b { color:#9a6b00; font-weight:400; font-size:16px; }
        .rv-coins.solo { color:#d9cba8; margin-top:14px; } .rv-coins.solo b { color:#f0c040; }
        @media (max-width: 760px) {
          .rv-approve img { height:32px; }
          .rv-agent { flex-direction:column; gap:10px; }
          .rv-art { flex:1 1 auto; height:auto; max-height:46vh; }
          .rv-cutout { max-height:44vh; } .rv-photo { height:40vh; }
          .rv-dossier { flex:0 0 auto; width:min(100%, 380px); padding:12px 14px 14px; transform:rotate(1deg); }
          .rv-name { font-size:30px; margin:4px 0 2px; } .rv-row b { font-size:13px; } .rv-stamp { font-size:26px; top:20px; }
        }
        /* 3★/4★ evidence */
        .rv-evidence { display:flex; flex-direction:column; align-items:center; }
        .rv-pol { position:relative; display:flex; flex-direction:column; width:min(76vw, 330px); padding:12px 12px 10px; background:#f3efe6; border-radius:2px; transform:rotate(-3deg);
          box-shadow: 0 18px 40px rgba(0,0,0,.65), 0 0 0 1px rgba(0,0,0,.06); animation: rvPolIn .55s cubic-bezier(.2,.9,.25,1.1) both; }
        .rv-screen.r4 .rv-pol { box-shadow: 0 18px 40px rgba(0,0,0,.65), 0 0 30px rgba(168,85,247,.45); }
        .rv-tape { position:absolute; top:-12px; left:50%; width:44%; height:24px; transform:translateX(-50%) rotate(-3deg); z-index:2; background: rgba(235,225,190,.75);
          clip-path: polygon(3% 0, 97% 4%, 100% 50%, 96% 100%, 2% 96%, 0 45%); }
        .rv-screen.r4 .rv-tape { background: rgba(178,130,240,.65); }
        .rv-pol-photo { position:relative; display:block; aspect-ratio:1/1; overflow:hidden; background:#111; }
        .rv-pol-photo img { width:100%; height:100%; object-fit:cover; object-position:50% 30%; animation: rvDevelop 1.3s ease-out both; }
        .rv-pol-photo img.framed { position:absolute; width:132.4%; height:auto; left:-16.2%; top:-13.2%; max-width:none; object-fit:initial; }
        .rv-caption { font-family:var(--font-narration); font-size:28px; color:#22306e; text-align:center; margin-top:8px; line-height:1.1; animation: rvWrite .9s .7s steps(18) both; }
        .rv-pstars { text-align:center; font-size:13px; color:var(--rc); }
        .rv-pstamp { position:absolute; right:10px; top:14%; font-family:var(--font-hit); font-size:24px; letter-spacing:1px; padding:0 8px; border:3px solid currentColor; border-radius:5px;
          transform:rotate(-12deg); background:rgba(243,239,230,.85); opacity:.93; animation: prStamp .28s 1.1s cubic-bezier(.3,1.4,.5,1) both; }
        .rv-pstamp.logged { color:#2f6b3a; } .rv-pstamp.duplicate { color:#1f5fa8; } .rv-pstamp.surplus { color:#5b4a2a; }
        .rv-note { margin-top:18px; font-size:14px; color:#cfc3a6; text-align:center; max-width:340px; animation: prFade .4s 1s ease both; }
        @keyframes rvBandL { from { transform: rotate(-12deg) translateX(-100%); } to { transform: rotate(-12deg) translateX(0); } }
        @keyframes rvBandR { from { transform: rotate(-12deg) translateX(100%); } to { transform: rotate(-12deg) translateX(0); } }
        @keyframes rvArtIn { from { opacity:0; transform: translateX(-60px) scale(.94); filter: brightness(3); } to { opacity:1; } }
        @keyframes rvDossIn { from { opacity:0; transform: translateX(60px) rotate(8deg); } to { opacity:1; transform: rotate(1.5deg); } }
        @keyframes rvType { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
        @keyframes rvPolIn { from { opacity:0; transform: translateY(-70px) rotate(-14deg) scale(1.1); } to { opacity:1; transform: rotate(-3deg); } }
        @keyframes rvDevelop { 0% { filter: brightness(2.6) contrast(.4) sepia(.6) blur(3px); } 100% { filter: none; } }
        @keyframes rvWrite { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
        /* personnel report (pull results) */
        .pr-screen { position:absolute; inset:0; z-index:60; overflow:auto; color:#e9e1cc; display:flex; flex-direction:column; align-items:center;
          padding:20px 12px 0; font-family:var(--font-dialogue); background:#0b0a0d; }
        .pr-desk { position:fixed; inset:0; pointer-events:none; z-index:-1;
          background: radial-gradient(ellipse 60% 42% at 50% 6%, rgba(255,196,110,0.20), transparent 70%),
                      repeating-linear-gradient(92deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 7px),
                      repeating-linear-gradient(88deg, rgba(0,0,0,0.25) 0 1px, transparent 1px 13px),
                      linear-gradient(180deg, #1d1612 0%, #120d0b 55%, #070506 100%); }
        .pr-head { text-align:center; margin-bottom:12px; animation: prFade .4s ease both; }
        .pr-org { font-size:11px; letter-spacing:3px; color:#b9ab8c; }
        .pr-org span { color:#8a1c1c; }
        .pr-title { font-size:clamp(26px,4.6vw,44px); letter-spacing:6px; color:#efe6cf; line-height:1.1; margin:2px 0 4px;
          text-shadow: 0 2px 0 #000, 0 0 18px rgba(255,190,100,.18); }
        .pr-meta { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; font-size:11px; color:#9c8f74; letter-spacing:1px; }
        .pr-tally { margin-top:6px; font-size:13px; color:#cfc3a6; }
        .pr-tally b { color:#efe6cf; font-weight:400; margin-left:3px; }
        .pr-files { display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:18px 14px; width:100%; max-width:880px; padding:8px 8px 0; align-items:start; }
        .pr-files.single { grid-template-columns:minmax(0,1fr); max-width:250px; }
        @media (max-width: 760px) { .pr-files { grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px 10px; } }
        .pr-file { position:relative; padding:0; border:none; background:none; cursor:pointer; text-align:left; font-family:inherit;
          transform: rotate(var(--tilt)); animation: prDrop .5s cubic-bezier(.2,.8,.25,1.1) both; transition: transform .15s; }
        .pr-file:hover { transform: rotate(0deg) translateY(-4px) scale(1.03); z-index:3; }
        .pr-tab { position:absolute; top:-11px; right:10px; height:16px; padding:0 8px; font-size:9px; line-height:16px; letter-spacing:-.5px; border-radius:4px 4px 0 0;
          background: color-mix(in srgb, var(--rc) 70%, #3a2a1a); color:#fff8e6; text-shadow:0 1px 1px rgba(0,0,0,.5); }
        .pr-paper { position:relative; display:flex; flex-direction:column; gap:8px; padding:10px 10px 12px; border-radius:3px; color:#2a2219;
          background: radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.35), transparent 60%),
                      repeating-linear-gradient(0deg, rgba(120,95,60,.06) 0 1px, transparent 1px 3px), #e7dcc2;
          box-shadow: 0 1px 0 rgba(255,255,255,.4) inset, 0 -18px 30px -24px rgba(90,60,20,.6) inset, 0 10px 22px rgba(0,0,0,.6), 0 2px 4px rgba(0,0,0,.5);
          border-top: 3px solid var(--rc); }
        .pr-file.high .pr-paper { box-shadow: 0 1px 0 rgba(255,255,255,.4) inset, 0 10px 22px rgba(0,0,0,.6), 0 0 0 2px color-mix(in srgb, var(--rc) 70%, transparent), 0 0 26px color-mix(in srgb, var(--rc) 55%, transparent); }
        .pr-photo-wrap { position:relative; display:block; }
        .pr-photo { position:relative; display:block; aspect-ratio: 1 / 1; overflow:hidden; border-radius:2px;
          background: linear-gradient(180deg, #8d97a3, #5d6670); box-shadow: 0 0 0 4px #f6f0e0, 0 2px 6px 4px rgba(0,0,0,.25); margin:4px 4px 2px;
          filter: sepia(.12) contrast(1.04); }
        .pr-file.high .pr-photo { background: linear-gradient(180deg, color-mix(in srgb, var(--rc) 45%, #6b5a3a), #3d3020); }
        .pr-framed { position:absolute; width:132.4%; left:-16.2%; top:-13.2%; max-width:none; }
        .pr-clip { position:absolute; top:-6px; left:14%; width:14px; height:34px; border:3px solid #9aa3ab; border-radius:8px; z-index:2;
          box-shadow: 1px 1px 2px rgba(0,0,0,.4); }
        .pr-file.high .pr-clip { border-color:#e7b94a; }
        .pr-priority { position:absolute; left:0; right:0; bottom:8px; text-align:center; font-family:var(--font-hit); font-size:11px; letter-spacing:1px;
          color:#fff; background: color-mix(in srgb, #b3121b 85%, transparent); transform: rotate(-4deg) scaleX(1.08); padding:1px 0; }
        .pr-fields { display:flex; flex-direction:column; gap:3px; }
        .pr-row { display:flex; gap:6px; align-items:baseline; border-bottom:1px dotted rgba(60,45,25,.35); padding-bottom:1px; min-width:0; }
        .pr-row i { font-style:normal; font-size:8.5px; letter-spacing:1px; color:#7a6a50; flex-shrink:0; }
        .pr-row b { font-weight:400; font-size:12.5px; color:#1d1711; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .pr-files.single .pr-row b { font-size:15px; }
        .pr-files:not(.single) .pr-id { display:none; }
        @media (max-width: 760px) { .pr-sub { display:none; } }
        .pr-stamp { position:absolute; right:0; top:12%; font-family:var(--font-hit); font-size:20px; background:rgba(238,229,206,.88); letter-spacing:1px; padding:1px 7px;
          border:3px solid currentColor; border-radius:5px; transform: rotate(-14deg); opacity:.93; box-shadow: 0 2px 6px rgba(0,0,0,.35);
          animation: prStamp .28s cubic-bezier(.3,1.4,.5,1) both; pointer-events:none; }
        .pr-stamp.hired { color:#b3121b; }
        .pr-stamp.promoted { color:#1f5fa8; font-size:16px; }
        .pr-stamp.surplus { color:#5b4a2a; font-size:17px; }
        .pr-files.single .pr-stamp { font-size:28px; }
        .pr-note { display:flex; align-items:center; gap:8px; margin-top:18px; font-size:13px; color:#d9cba8; animation: prFade .4s ease both;
          background: rgba(231,220,194,.07); border:1px dashed rgba(231,220,194,.35); padding:6px 12px; border-radius:4px; }
        .pr-note img { width:18px; height:18px; image-rendering:pixelated; }
        .pr-note b { color:#f0c040; font-weight:400; }
        .pr-sign { display:flex; flex-direction:column; align-items:center; margin-top:16px; padding:8px 22px 8px; background:#e7dcc2; border-radius:2px; color:#2a2219;
          box-shadow: 0 8px 18px rgba(0,0,0,.55); transform: rotate(-1deg); animation: prFade .5s ease both; }
        .pr-sig { height:46px; display:flex; align-items:flex-end; justify-content:center; font-family:var(--font-narration); font-size:28px; color:#1d2a6b; line-height:1; }
        .pr-sig img { max-height:46px; max-width:240px; transform: rotate(-3deg); }
        .pr-sig i { font-style:normal; transform: rotate(-3deg); }
        .pr-line { border-top:1px solid #2a2219; padding-top:4px; margin-top:2px; font-size:9.5px; letter-spacing:2px; color:#5e5140; min-width:240px; text-align:center; }
        .pr-bar { position:sticky; bottom:0; width:100%; display:flex; gap:10px; justify-content:center; padding:16px 12px calc(16px + env(safe-area-inset-bottom));
          margin-top:auto; padding-top:24px; background: linear-gradient(180deg, transparent, rgba(8,6,6,.92) 35%); }
        .pr-btn { font-family:var(--font-dialogue); font-size:15px; letter-spacing:1px; padding:10px 20px; border-radius:4px; cursor:pointer; color:#1a0505;
          background:#d63a2a; border:2px solid #1a0505; box-shadow: 3px 3px 0 #1a0505, 0 0 18px rgba(214,58,42,.35);
          display:inline-flex; align-items:center; gap:10px; transition: transform .1s, box-shadow .1s; }
        .pr-btn:hover:not(:disabled) { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 #1a0505, 0 0 22px rgba(214,58,42,.45); }
        .pr-btn:active:not(:disabled) { transform: translate(2px,2px); box-shadow: 1px 1px 0 #1a0505; }
        .pr-btn:disabled { filter:grayscale(.8) brightness(.6); cursor:default; }
        .pr-btn.ghost { background:#e7dcc2; color:#2a2219; box-shadow: 3px 3px 0 #000; border-color:#000; }
        @media (max-width: 760px) { .pr-btn { font-size:13px; padding:9px 12px; gap:7px; white-space:nowrap; } }
        .pr-cost { display:inline-flex; align-items:center; gap:4px; background:rgba(0,0,0,.18); border-radius:3px; padding:1px 7px 1px 4px; font-size:13px; }
        /* evidence Polaroids (3★/4★) */
        .pr-pol { position:relative; display:flex; flex-direction:column; padding:8px 8px 6px; border:none; cursor:pointer; text-align:center; font-family:inherit;
          background:#f3efe6; border-radius:2px; margin-top:10px;
          box-shadow: 0 10px 20px rgba(0,0,0,.55), 0 2px 3px rgba(0,0,0,.45), inset 0 0 0 1px rgba(0,0,0,.06);
          transform: rotate(var(--tilt)); animation: prDrop .5s cubic-bezier(.2,.8,.25,1.1) both; transition: transform .15s; }
        .pr-pol:hover { transform: rotate(0deg) translateY(-4px) scale(1.04); z-index:3; }
        .pr-tape { position:absolute; top:-9px; left:50%; width:46%; height:18px; transform: translateX(-50%) rotate(-3deg); z-index:2;
          background: rgba(235,225,190,.72); box-shadow: 0 1px 2px rgba(0,0,0,.25);
          clip-path: polygon(3% 0, 97% 4%, 100% 50%, 96% 100%, 2% 96%, 0 45%); }
        .pr-pol.r4 .pr-tape { background: rgba(178,130,240,.62); }
        .pr-pol-photo { position:relative; display:block; aspect-ratio: 1 / 1; overflow:hidden; background:#222; filter: sepia(.15) saturate(.9) contrast(1.05); }
        .pr-pol.r4 .pr-pol-photo { box-shadow: 0 0 0 2px rgba(168,85,247,.55); }
        .pr-exhibit { position:absolute; left:4px; bottom:4px; font-size:8px; letter-spacing:1px; color:#fff; background:rgba(0,0,0,.6); padding:1px 4px; font-family:var(--font-dialogue); }
        .pr-caption { font-family:var(--font-narration); font-size:15px; line-height:1.15; color:#22306e; margin-top:6px; min-height:18px;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .pr-pol-stars { font-size:8px; color:var(--rc); letter-spacing:-.5px; margin-top:1px; }
        .pr-files.single .pr-caption { font-size:22px; } .pr-files.single .pr-pol-stars { font-size:12px; }
        .pr-ev { position:absolute; right:6px; top:18%; font-family:var(--font-hit); font-size:13px; letter-spacing:1px; padding:0 5px; border:2px solid currentColor;
          border-radius:4px; transform: rotate(-12deg); background:rgba(243,239,230,.85); opacity:.92; animation: prStamp .28s cubic-bezier(.3,1.4,.5,1) both; pointer-events:none; }
        .pr-ev.logged { color:#2f6b3a; } .pr-ev.duplicate { color:#1f5fa8; } .pr-ev.surplus { color:#5b4a2a; }
        .pr-files.single .pr-ev { font-size:20px; }
        @keyframes prDrop { from { opacity:0; transform: translateY(-60px) rotate(calc(var(--tilt) * 4)) scale(1.08); } to { opacity:1; transform: rotate(var(--tilt)); } }
        @keyframes prStamp { from { opacity:0; transform: rotate(-14deg) scale(2.6); } to { opacity:.93; transform: rotate(-14deg) scale(1); } }
        @keyframes prFade { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
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
      /* phones: the pity panel under the banner already shows these */
      @media (max-width: 560px) { .gacha-hdr-pity { display:none; } }
      `}</style>

      {/* ══════════════════════════════════════════════════════════
          ── IDLE — Custom Retirement Home Banner UI ─────────────
          ══════════════════════════════════════════════════════════ */}
      {phase === 'idle' && (
        <div style={{
  width: '100%', height: '100%',
  background: 'var(--desk)',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', overflow: 'hidden',
  zoom: 0.9,
}}>

    {/* Header bar */}
    <div style={{
      width: '100%', flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 6,   // wraps on phones instead of pushing the page sideways
      padding: '6px 20px',
background: 'rgba(0,0,0,0.55)',
zIndex: 10,
    }}>
      <button
        onPointerDown={playClose} onClick={() => navigate('main')}
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
      {devMode && (
        <button onClick={toggleForce5} title="Dev: every pull is a 5★ (featured on banners that have them). Doesn't change pity."
          style={{
            background: force5 ? 'rgba(168,85,247,0.35)' : 'rgba(0,0,0,0.55)', color: force5 ? '#f3e8ff' : '#c4b5fd',
            border: `1px solid ${force5 ? '#c084fc' : 'rgba(168,85,247,0.5)'}`, borderRadius: 20,
            padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
            boxShadow: force5 ? '0 0 12px rgba(168,85,247,0.6)' : 'none',
          }}>
          🛠 Guaranteed 5★: {force5 ? 'ON' : 'OFF'}
        </button>
      )}
      <div className="gacha-hdr-pity" style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', textAlign: 'right' }}>
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
      ? <img src={uiArt(activeBanner.uiAssets.bg)} alt="" draggable={false} style={artStyle(activeBanner, 'bg')} />
      : <div style={{ position:'absolute', inset:0, zIndex:0, background:`radial-gradient(ellipse at 30% 60%, ${activeBanner.accentColor}22 0%, #07000f 70%)` }} />
    }

    {/* No banner art yet → fan out the featured cards */}
    {!activeBanner.uiAssets?.bg && activeBanner.featuredIds.length > 0 && (() => {
      const feat = activeBanner.featuredIds.map(id => CHARACTERS.find(c => c.id === id)).filter(Boolean);
      const n = feat.length;
      return (
        <div style={{ position:'absolute', top:'10%', bottom:'8%', left:'40%', right:'4%', zIndex:1, pointerEvents:'none' }}>
          {feat.map((c, i) => {
            const t = n > 1 ? i / (n - 1) : 0.5;
            return (
              <img key={c.id} src={thumb(c.image)} alt={c.name} draggable={false}
                style={{ position:'absolute', top: `${4 + Math.abs(t - 0.5) * 12}%`, left: `calc(${t} * (100% - 34%))`, width:'34%', aspectRatio:'2633 / 3752',
                  transform:`rotate(${(t - 0.5) * 16}deg)`, transformOrigin:'50% 110%', borderRadius:6,
                  boxShadow:'-4px 6px 18px rgba(0,0,0,0.6)', zIndex: i }} />
            );
          })}
        </div>
      );
    })()}

    {activeBanner.uiAssets?.text && (
      <img src={uiArt(activeBanner.uiAssets.text)} alt="" draggable={false} style={artStyle(activeBanner, 'text')} />
    )}

    {/* countdown (banners that are always available have none). Art made on its own canvas
        (uiFrame) has no "ends in:" drawn in, so it gets a small label of its own. */}
    {activeBanner.uiFrame && activeBanner.uiAssets?.text && !isPermanent(activeBanner) && (
      <div style={{
        position: 'absolute', bottom: '4%', right: '2.5%', zIndex: 3, pointerEvents: 'none',
        background: 'rgba(8,4,12,0.72)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, padding: '3px 8px',
        color: '#fff', fontSize: 'clamp(10px, 1.3vw, 14px)', fontFamily: 'var(--font-dialogue)', fontWeight: 700, letterSpacing: '0.06em',
        textShadow: '0 1px 3px rgba(0,0,0,0.9)', whiteSpace: 'nowrap',
      }}>
        <span style={{ fontStyle: 'italic', opacity: 0.8 }}>ends in:</span> {timeLeft}
      </div>
    )}
    {!activeBanner.uiFrame && activeBanner.uiAssets?.text && !isPermanent(activeBanner) && (
      <div style={{
        position: 'absolute', bottom: '9%', right: '4%',
        zIndex: 3, pointerEvents: 'none',
        color: '#e0e8ff', fontSize: 'clamp(10px, 1.2vw, 14px)',
        fontFamily: 'var(--font-dialogue)', fontWeight: 700,
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
        {activeBanner.comingSoon && <div style={{ display:'inline-block', marginTop:6, fontFamily:'var(--font-hit)', fontSize:'clamp(16px,2.6vw,26px)', letterSpacing:2, color:activeBanner.accentColor,
          border:`3px solid ${activeBanner.accentColor}`, borderRadius:6, padding:'0 10px', transform:'rotate(-4deg)', background:'rgba(0,0,0,0.45)' }}>COMING SOON</div>}
        <div style={{ color:'rgba(255,255,255,0.35)', fontSize:12, marginTop:4 }}>{isPermanent(activeBanner) ? 'Permanent banner' : endsAt[activeBanner.id] === Infinity ? 'Limited · no end date yet' : `ends in: ${timeLeft}`}</div>
      </div>
    )}
  </div>

  {/* Characters — outside clip so they pop above, bottom anchored to card bottom */}
  {activeBanner.uiAssets?.char2 && (
    <img src={uiArt(activeBanner.uiAssets.char2)} alt="" draggable={false} style={artStyle(activeBanner, 'char2')} />
  )}

  {activeBanner.uiAssets?.char1 && (
    <img src={uiArt(activeBanner.uiAssets.char1)} alt="" draggable={false} style={artStyle(activeBanner, 'char1')} />
  )}
</div>
    {/* What's coming after the current limited banner */}
    {upcoming[0] && (
      <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'center', padding: '0 12px' }}>
        Up next: <span style={{ color: upcoming[0].banner.accentColor, fontWeight: 700 }}>{upcoming[0].banner.name}</span> in {formatTimeLeft(upcoming[0].start - now)}
      </div>
    )}
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
      <div style={{ position: 'relative', lineHeight: 0, userSelect: 'none', width: 'min(96vw, 580px)', opacity: activeBanner.comingSoon ? 0.35 : 1, filter: activeBanner.comingSoon ? 'grayscale(0.8)' : 'none' }}>
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
          disabled={currency < 1 || activeBanner.comingSoon}
          style={{ left: 0, width: '46%', opacity: currency < 1 || activeBanner.comingSoon ? 0.4 : 1 }}
          onMouseEnter={() => setHovBtn1(true)}
          onMouseLeave={() => setHovBtn1(false)}
          onClick={() => startPulls(1)}
        />
        <button
          className="pull-btn-overlay"
          disabled={currency < 10 || activeBanner.comingSoon}
          style={{ right: 0, width: '46%', opacity: currency < 10 || activeBanner.comingSoon ? 0.4 : 1 }}
          onMouseEnter={() => setHovBtn2(true)}
          onMouseLeave={() => setHovBtn2(false)}
          onClick={() => startPulls(10)}
        />
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
        <div onClick={() => onCardVideoEnd(true)} style={{ position:'absolute', inset:0, zIndex:51, cursor:'pointer' }}>
          <div style={{ position:'absolute', top:20, right:20, color:'rgba(255,255,255,0.5)', fontSize:13 }}>tap to skip</div>
          {typeof currentCard.resultVideo === 'string' && <div style={{ position:'absolute', bottom:32, left:0, right:0, textAlign:'center' }}>
            <div style={{ color:rc(currentCard.rarity), fontFamily:'var(--font-dramatic)', fontSize:22, fontWeight:700, textShadow:'0 0 20px rgba(0,0,0,0.8)' }}>
              {'★'.repeat(Math.min(currentCard.rarity,6))} {currentCard.name}
            </div>
          </div>}
        </div>
      )}

      {/* ── BUILD-UP (pull music fading in before the drop) ──── */}
      {phase === 'buildup' && currentCard && (
        <div onClick={() => revealNowRef.current?.()} style={{ position:'absolute', inset:0, zIndex:52, cursor:'pointer', overflow:'hidden', background:'#030008',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          {build && (
            <div key={build.key} style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at 50% 55%, ${rg(currentCard.rarity)} 0%, transparent 62%)`,
                animation:`buildGlow ${build.lead}s cubic-bezier(.6,0,1,1) forwards` }} />
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ position:'absolute', width:160, height:160, borderRadius:'50%', border:`2px solid ${rc(currentCard.rarity)}`,
                  animation:`ringPulse ${Math.max(0.35, build.lead / 3)}s cubic-bezier(0,0,0.2,1) ${i * build.lead / 4}s infinite`, opacity:0 }} />
              ))}
              <div style={{ animation:`buildTremble ${build.lead}s linear forwards` }}>
                <img src={currentCard.characterImage || currentCard.image} alt="" draggable={false}
                  style={{ maxHeight:'50vh', maxWidth:'80vw', objectFit:'contain', display:'block',
                    filter:`brightness(0) drop-shadow(0 0 18px ${rc(currentCard.rarity)}) drop-shadow(0 0 40px ${rg(currentCard.rarity)})`,
                    animation:`buildRise ${build.lead}s cubic-bezier(.5,0,1,1) forwards` }} />
              </div>
            </div>
          )}
          <div style={{ position:'absolute', top:20, left:24, color:'rgba(255,255,255,0.4)', fontSize:14 }}>{queueIdx+1} / {batch.length}</div>
          <div style={{ position:'absolute', top:20, right:20, color:'rgba(255,255,255,0.45)', fontSize:13 }}>tap to skip</div>
        </div>
      )}

      {/* ── REVEAL QUEUE: one card at a time, on your desk ───── */}
      {/* 5★/6★ = a new agent: big art, a personnel dossier typing itself out, then a stamp.
          3★/4★ = evidence: a Polaroid that develops on the desk, with a handwritten caption.
          Maxed cards get SURPLUS and show the coins they turned into. */}
      {phase === 'reveal-queue' && batch.length > 0 && currentCard && (() => {
        const c            = currentCard;
        const isHigh       = isHighRarity(c);
        const isLast       = queueIdx >= batch.length - 1;
        const si           = cardInventory[c.id]?.si ?? 0;
        const isS5Dupe     = si >= 4;
        const S5_COIN_VALUES = { 6: 5000, 5: 2500, 4: 500, 3: 100 };
        const coinValue    = S5_COIN_VALUES[c.rarity] || 0;
        const stamp = isS5Dupe ? 'SURPLUS' : c.isNew === false ? (isHigh ? 'PROMOTED' : 'DUPLICATE') : (isHigh ? 'HIRED' : 'LOGGED');
        const fileNo = `${String(queueIdx + 1).padStart(2, '0')} / ${String(batch.length).padStart(2, '0')}`;
        const CLEAR = { 3: 'C', 4: 'B', 5: 'A', 6: 'Ω' };
        const rows = [
          ['TITLE', c.subtitle], ['CLEARANCE', `LVL ${CLEAR[Math.min(c.rarity, 6)] ?? '?'}`],
          c.element && ['ELEMENT', c.element], c.skill && ['SKILL', c.skill.name], c.ult && ['ULT', c.ult.name],
        ].filter(Boolean);
        const tapLine = isLast ? 'tap to see the report' : 'tap for the next file';
        return (
          <div key={c.instanceId} onClick={advanceQueue} className={`rv-screen ${isHigh ? 'agent' : 'evidence'} r${Math.min(c.rarity, 6)}`}
            style={{ '--rc': rc(c.rarity), '--rg': rg(c.rarity) }}>
            <div className="rv-desk" />
            {isHigh && <><div className="rv-band b1" /><div className="rv-band b2" /></>}

            <div className="rv-top">
              <span>FILE {fileNo}</span>
              {!isHigh && !isLast && <button className="rv-skip" onClick={handleSmartSkip}>Skip to {batch.slice(queueIdx + 1).some(isHighRarity) ? 'next agent' : 'report'} →</button>}
            </div>
            {flash && <div key={`flash${queueIdx}`} onAnimationEnd={() => setFlash(false)} className="rv-flash" />}

            {isHigh ? (
              <div className="rv-agent" style={{ animation: flash ? 'dropJolt 0.5s ease-out' : undefined }}>
                <div className="rv-art">
                  {c.sprite ? <img src={c.sprite} alt={c.name} draggable={false} className="rv-cutout" />
                    : <span className="rv-photo"><span className="rv-clip" /><img src={c.cardArt || c.characterImage || c.image} alt={c.name} draggable={false} /></span>}
                </div>
                <div className="rv-dossier">
                  <div className="rv-dhead"><span>FRAIL INITIATIVE · PERSONNEL</span><span className="rv-stars">{'★'.repeat(Math.min(c.rarity, 6))}</span></div>
                  <div className="rv-name">{c.name}</div>
                  {rows.map(([k, v], i) => (
                    <div key={k} className="rv-row" style={{ animationDelay: `${0.55 + i * 0.16}s` }}><i>{k}</i><b>{v}</b></div>
                  ))}
                  <span className={`rv-stamp ${stamp.toLowerCase()}`} style={{ animationDelay: `${0.75 + rows.length * 0.16}s` }}>{stamp}</span>
                  {isS5Dupe && <div className="rv-coins" style={{ animationDelay: `${1 + rows.length * 0.16}s` }}>
                    <img src={`${BASE}ui/ui_cucoin.png`} alt="" draggable={false} /> refunded <b>+{formatCoins(coinValue)}</b> coins</div>}
                  {profile?.signature && <div className="rv-approve" style={{ animationDelay: `${0.85 + rows.length * 0.16}s` }}>
                    <span>APPROVED</span><img src={profile.signature} alt="your signature" draggable={false} /></div>}
                </div>
              </div>
            ) : (
              <div className="rv-evidence" style={{ animation: flash ? 'dropJolt 0.5s ease-out' : undefined }}>
                <div className="rv-pol">
                  <span className="rv-tape" />
                  <span className="rv-pol-photo">
                    <img src={c.cardArt || c.characterImage || c.image} alt={c.name} draggable={false} className={c.cardArt ? undefined : 'framed'} />
                  </span>
                  <span className="rv-caption">{c.name}</span>
                  <span className="rv-pstars">{'★'.repeat(c.rarity)}</span>
                  <span className={`rv-pstamp ${stamp.toLowerCase()}`}>{stamp}</span>
                </div>
                {c.subtitle && <div className="rv-note">“{c.subtitle}”</div>}
                {isS5Dupe && <div className="rv-coins solo"><img src={`${BASE}ui/ui_cucoin.png`} alt="" draggable={false} /> refunded <b>+{formatCoins(coinValue)}</b> coins</div>}
              </div>
            )}

            <div className="rv-tap">{tapLine}</div>
          </div>
        );
      })()}

      {/* ── RESULTS: INTAKE REPORT ───────────────────────────── */}
      {/* You're the Frail Initiative's new rookie manager, so a pull is an intake on your desk,
          highest rarity first (once you've signed your job application in story mode, the
          personnel files carry your signature):
          • 5★/6★ are people → personnel files: ID photo, typed details, a stamp
            (HIRED = new, PROMOTED = a copy you already had, SURPLUS = maxed, paid out in coins)
          • 3★/4★ are moments → evidence: a taped-on Polaroid with a handwritten caption
            (LOGGED = new, DUPLICATE = a copy, SURPLUS = maxed) */}
      {phase === 'results' && (summaryBatch.length > 0 || s5CoinsEarned > 0) && (() => {
        const n = summaryBatch.length;
        const sorted = summaryBatch.map((c, i) => ({ c, i })).sort((a, b) => b.c.rarity - a.c.rarity || a.i - b.i);
        const people = summaryBatch.filter(c => c.rarity >= 5).length, items = n - people;
        let exhibit = 0;
        const tally = [6, 5, 4, 3].map(r => [r, summaryBatch.filter(c => c.rarity === r).length]).filter(([, k]) => k > 0);
        const again = n >= 10 ? 10 : 1;
        const reqNo = String((pity5 * 7919 + n * 104729 + summaryBatch.reduce((a, c) => a + c.id * 31, 0)) % 100000).padStart(5, '0');
        const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
        const CLEAR = { 3: 'C', 4: 'B', 5: 'A', 6: 'Ω' };
        const STAMP_IN = 0.35 + n * 0.08;    // stamps land once every file is on the desk
        return (
          <div className="pr-screen">
            <div className="pr-desk" />
            <div className="pr-head">
              <div className="pr-org">FRAIL INITIATIVE <span>·</span> FIELD OFFICE</div>
              <div className="pr-title">INTAKE REPORT</div>
              <div className="pr-meta">
                <span>REQ. Nº {reqNo}</span><span>{today}</span><span>DRIVE: {activeBanner.name.toUpperCase()}</span>
              </div>
              <div className="pr-tally">
                {[people && `${people} recruit${people !== 1 ? 's' : ''}`, items && `${items} item${items !== 1 ? 's' : ''} of evidence`].filter(Boolean).join(' · ')}{tally.length ? ' —' : ''}
                {tally.map(([r, k]) => <span key={r} style={{ color: rc(r) }}> {'★'.repeat(Math.min(r, 6))}<b>×{k}</b></span>)}
              </div>
            </div>

            <div className={`pr-files${n === 1 ? ' single' : ''}`}>
              {sorted.map(({ c }, i) => {
                const tilt = ((c.id * 37 + i * 53) % 9 - 4) * 0.55;
                if (c.rarity < 5) {
                  // evidence: a Polaroid taped to the report
                  const ev = c.maxed ? 'surplus' : c.isNew ? 'logged' : 'duplicate';
                  exhibit++;
                  return (
                    <button key={c.instanceId || i} className={`pr-pol r${c.rarity}`} onClick={() => setSelectedResult(c)}
                      style={{ '--rc': rc(c.rarity), '--tilt': `${tilt * 2.2}deg`, animationDelay: `${0.1 + i * 0.08}s` }}>
                      <span className="pr-tape" />
                      <span className="pr-pol-photo">
                        {c.cardArt ? <img src={c.cardArt} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }} />
                          : <img src={thumb(c.characterImage || c.image)} alt="" draggable={false} className="pr-framed"
                              onError={e => { const fb = c.characterImage || c.image; if (fb && e.target.src !== fb) e.target.src = fb; }} />}
                        <span className="pr-exhibit">EXHIBIT {String.fromCharCode(64 + exhibit)}</span>
                      </span>
                      <span className="pr-caption">{c.name}</span>
                      <span className="pr-pol-stars">{'★'.repeat(c.rarity)}</span>
                      <span className={`pr-ev ${ev}`} style={{ animationDelay: `${STAMP_IN + i * 0.07}s` }}>
                        {ev === 'logged' ? 'LOGGED' : ev === 'duplicate' ? 'DUPLICATE' : 'SURPLUS'}
                      </span>
                    </button>
                  );
                }
                const focus = c.portraitFocus && (c.sprite || c.cardArt)
                  ? [c.portraitFocus[0], c.portraitFocus[1], Math.max(1, c.portraitFocus[2] * 0.62)] : null;
                const stamp = c.maxed ? 'surplus' : c.isNew ? 'hired' : 'promoted';
                const high = c.rarity >= 5;
                return (
                  <button key={c.instanceId || i} className={`pr-file r${Math.min(c.rarity, 6)}${high ? ' high' : ''}`} onClick={() => setSelectedResult(c)}
                    style={{ '--rc': rc(c.rarity), '--tilt': `${tilt}deg`, animationDelay: `${0.1 + i * 0.08}s` }}>
                    <span className="pr-tab">{'★'.repeat(Math.min(c.rarity, 6))}</span>
                    <span className="pr-paper">
                      <span className="pr-photo-wrap">
                      <span className="pr-photo">
                        <span className="pr-clip" />
                        {focus ? <FocusImg src={c.sprite || c.cardArt} focus={focus} at={[50, 42]} />
                          : c.cardArt ? <img src={c.cardArt} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 22%' }} />
                            : <img src={thumb(c.characterImage || c.image)} alt="" draggable={false} className="pr-framed"
                                onError={e => { const fb = c.characterImage || c.image; if (fb && e.target.src !== fb) e.target.src = fb; }} />}
                        {high && <span className="pr-priority">PRIORITY ASSET</span>}
                      </span>
                      <span className={`pr-stamp ${stamp}`} style={{ animationDelay: `${STAMP_IN + i * 0.07}s` }}>
                        {stamp === 'hired' ? 'HIRED' : stamp === 'promoted' ? 'PROMOTED' : 'SURPLUS'}
                      </span>
                      </span>
                      <span className="pr-fields">
                        <span className="pr-row"><i>NAME</i><b>{c.name}</b></span>
                        {c.subtitle && <span className="pr-row pr-sub"><i>TITLE</i><b>{c.subtitle}</b></span>}
                        <span className="pr-row"><i>CLEARANCE</i><b style={{ color: 'var(--rc)' }}>LVL {CLEAR[Math.min(c.rarity, 6)] ?? '?'}</b></span>
                        <span className="pr-row pr-id"><i>FILE</i><b>FI-{String(c.id).padStart(4, '0')}</b></span>
                        {profile?.signature && <span className="pr-approve"><i>APPROVED</i><img src={profile.signature} alt="" draggable={false} /></span>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {s5CoinsEarned > 0 && (
              <div className="pr-note" style={{ animationDelay: `${STAMP_IN + 0.3}s` }}>
                <img src={`${BASE}ui/ui_cucoin.png`} alt="" draggable={false} />
                Surplus personnel refunded: <b>+{formatCoins(s5CoinsEarned)} coins</b>
              </div>
            )}

            <div className="pr-bar">
              <button className="pr-btn ghost" onClick={() => { setSummaryBatch([]); setPhase('idle'); setS5CoinsEarned(0); }}>File report</button>
              <button className="pr-btn" disabled={currency < again} onClick={() => startPulls(again)}>
                Recruit ×{again} again <span className="pr-cost"><GemImg size={15} />{again}</span>
              </button>
            </div>
          </div>
        );
      })()}

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
            <div style={{ fontFamily:'var(--font-dramatic)', fontSize:25, fontWeight:800, color:rc(selectedResult.rarity), textAlign:'center', marginBottom:2 }}>{selectedResult.name}</div>
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

            {[['✦ Skill', selectedResult.skill], ['⚡ Ult', selectedResult.ult]].filter(([, a]) => a).map(([tag, a]) => (
              <div key={tag} style={{ background:'rgba(240,192,64,0.07)', border:'1px solid rgba(240,192,64,0.25)', borderRadius:8, padding:'8px 12px', marginBottom:8 }}>
                <div style={{ color:'#f0c040', fontWeight:700, marginBottom:4 }}>{tag}: {a.name}</div>
                <div style={{ color:'#aaa', fontSize:12 }}>{a.description}</div>
                <div style={{ color:'#556', fontSize:11, marginTop:4 }}>{tag.includes('Ult') ? 'Unlocks at LV50 · charges from damage' : 'Always on from LV1 · full strength at LV20'}</div>
              </div>
            ))}

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
            alignItems:'center', justifyContent:'safe center',
            gap:14, padding:24, overflowY:'auto',
          }}
        >
          <div style={{ fontSize:22, fontWeight:900, color:'#fff', marginBottom:4, letterSpacing:1 }}>Select Banner</div>
          <div style={{ color:'rgba(255,255,255,0.3)', fontSize:13, marginBottom:8 }}>Choose which banner to pull from</div>

          {live.map(banner => {
            const isActive = banner === activeBanner;
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
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:3, fontWeight:600 }}>
                      {isPermanent(banner) ? 'Permanent' : endsAt[banner.id] === Infinity ? 'No end date yet' : `ends in ${timeLeftOf(banner)}`}
                    </div>
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

          {upcoming.length > 0 && (
            <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:468, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', letterSpacing:2, fontWeight:700, marginTop:4 }}>UP NEXT</div>
              {upcoming.slice(0, 4).map(u => (
                <div key={`${u.banner.id}-${u.start}`} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, borderRadius:12, padding:'10px 18px',
                  border:'1px dashed rgba(255,255,255,0.14)', background:'rgba(255,255,255,0.02)' }}>
                  <span style={{ color:u.banner.accentColor, fontWeight:700, fontSize:14, opacity:0.8 }}>{u.banner.name}</span>
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.45)', textAlign:'right' }}>in {formatTimeLeft(u.start - now)} · {formatLength(u.end - u.start)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ color:'rgba(255,255,255,0.2)', fontSize:12, marginTop:4 }}>tap outside to cancel</div>
        </div>
      )}

    </div>
  );
}