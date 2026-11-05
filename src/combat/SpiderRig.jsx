// DADDY HAIRY LEGS, drawn from his pieces (spiderArt.js) where his rig puts them (spiderKin.js):
// the abdomen and the bulb under it behind, then the eight legs (upper leg out of its socket, the
// knee knob, the forearm, the hand), then his head and jaw in front. Plus what he leaves around
// the arena: web patches, web traps and egg sacs (drawn here: they're effects, not characters).
import { SPIDER_ART } from './spiderArt';

const BASE = import.meta.env.BASE_URL;
const PC = SPIDER_ART.pieces, EX = SPIDER_ART.ex, BODY = SPIDER_ART.body;
const plen = p => Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) / EX;

// one picture laid along a bone from A to B (its joints a → b land on them)
function Bone({ name, flip, A, B, filter }) {
  const p = PC[name];
  const ax = p.a[0], ay = p.a[1];
  let dx = p.b[0] - ax; const dy = p.b[1] - ay;
  if (flip) dx = -dx;
  const L = Math.hypot(B.x - A.x, B.y - A.y), s = L / (Math.hypot(dx, dy) || 1);
  const ang = Math.atan2(B.y - A.y, B.x - A.x) - Math.atan2(dy, dx);
  return (
    <img src={`${BASE}${p.src}`} alt="" draggable={false} className="spider-piece"
      style={{ left: A.x - ax * s, top: A.y - ay * s, width: p.w * s, height: p.h * s, filter,
        transformOrigin: `${ax * s}px ${ay * s}px`, transform: `rotate(${ang.toFixed(4)}rad)${flip ? ' scaleX(-1)' : ''}` }} />
  );
}

function Leg({ r, leg, filter }) {
  if (!leg.knee) return null;
  const { hip, knee, wrist, hdir, pieces: P } = leg;
  const fx = knee.x - hip.x, fy = knee.y - hip.y, fl = Math.hypot(fx, fy) || 1, u = [fx / fl, fy / fl];
  const Ls = plen(PC[P.socket.name]) * r.sc, Lk = plen(PC.knee) * r.sc;
  const sB = { x: hip.x + u[0] * Ls * 0.2, y: hip.y + u[1] * Ls * 0.2 }, sA = { x: sB.x - u[0] * Ls, y: sB.y - u[1] * Ls };
  const kA = { x: knee.x - u[0] * Lk * 0.5, y: knee.y - u[1] * Lk * 0.5 }, kB = { x: knee.x + u[0] * Lk * 0.5, y: knee.y + u[1] * Lk * 0.5 };
  const hB = { x: wrist.x + hdir[0] * leg.LH * r.sc, y: wrist.y + hdir[1] * leg.LH * r.sc };
  const f = leg.broken ? 'brightness(0.45) saturate(0.6)' : leg.hurt ? 'brightness(1.8)' : filter;
  return (
    <>
      <Bone {...P.femur} A={hip} B={knee} filter={f} />
      <Bone {...P.tibia} A={knee} B={wrist} filter={f} />
      <Bone {...P.hand} A={wrist} B={hB} filter={f} />
      <Bone {...P.socket} A={sA} B={sB} filter={filter} />
      <Bone {...P.knee} A={kA} B={kB} filter={f} />
    </>
  );
}

function BodyBox({ r, parts, filter, opacity }) {
  const lift = (r.bob - r.rear * 140) * r.sc;
  return (
    <div className="spider-body" style={{ left: r.x, top: r.y + lift, transform: `scale(${r.sc})`, filter, opacity }}>
      {parts.map(k => {
        const p = PC[k], c = BODY[k], [w, h] = p.art;
        // the jaw: shut when he's idle (raised 100 art units into his face: the art is drawn open),
        // dropping open to bite, spit and chew (r.jaw 0 → 1, a little past the art's own gape)
        const jaw = k === 'jaw' ? `translateY(${(-100 + r.jaw * 130).toFixed(1)}px) scaleY(${(1 + r.jaw * 0.08).toFixed(3)})` : undefined;
        return <img key={k} src={`${BASE}${p.src}`} alt="" draggable={false} className="spider-piece"
          style={{ left: c[0] - w / 2, top: c[1] - h / 2, width: w, height: h, transformOrigin: '50% 0', transform: jaw }} />;
      })}
    </div>
  );
}

// r: the rig; hurt / dim: filters; thread: dropping in on a line of silk (from the top)
export function SpiderRig({ r, hurt = false, dim, opacity = 1, thread = false, z = 5 }) {
  if (!r) return null;
  const bodyF = hurt ? 'brightness(1.7)' : dim;
  const order = [3, 2, 1, 0].flatMap(i => r.legs.filter(l => l.idx === i));
  return (
    <div className="spider-rig" style={{ zIndex: z, opacity }}>
      {thread && (
        <svg className="spider-thread" width="100%" height="100%">
          <line x1={r.x} y1={-20} x2={r.x} y2={r.y - 1100 * r.sc} stroke="#e5e7eb" strokeWidth={Math.max(1.5, 7 * r.sc)} opacity={0.75} />
        </svg>
      )}
      <BodyBox r={r} parts={['abdomen', 'bulb']} filter={bodyF} />
      {order.map(l => <Leg key={`${l.side}${l.idx}`} r={r} leg={l} filter={dim} />)}
      <BodyBox r={r} parts={['jaw', 'head']} filter={bodyF} />
    </div>
  );
}

// webs, traps and eggs on the arena (an SVG layer under the enemies)
export function SpiderGround({ s, k }) {
  if (!s.webs?.length && !s.eggs?.length) return null;
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3, overflow: 'visible' }}>
      {s.webs.map(w => <Web key={w.id} w={w} k={k} stuck={s.player.stuck?.id === w.id} />)}
      {s.eggs.map(e => <Egg key={e.id} e={e} k={k} t={s.time} />)}
    </svg>
  );
}

function Web({ w, k, stuck }) {
  const grow = Math.min(1, w.t / 0.3), fade = w.t > w.life - 0.6 ? Math.max(0, (w.life - w.t) / 0.6) : 1;
  const R = w.r * (0.5 + 0.5 * grow), spokes = w.trap ? 12 : 9, rings = w.trap ? 5 : 3;
  const pts = (rr, j) => Array.from({ length: spokes }, (_, i) => {
    const a = (i / spokes) * Math.PI * 2 + w.id * 0.7, wob = 1 + Math.sin(i * 2.3 + j + w.id) * 0.08;
    return `${(w.x + Math.cos(a) * rr * wob).toFixed(1)},${(w.y + Math.sin(a) * rr * wob).toFixed(1)}`;
  }).join(' ');
  const col = w.trap ? '#f8fafc' : '#e2e8f0';
  return (
    <g opacity={fade * (w.trap ? 0.95 : 0.8)}>
      <circle cx={w.x} cy={w.y} r={R} fill={w.trap ? 'rgba(248,250,252,0.22)' : 'rgba(226,232,240,0.12)'} />
      {Array.from({ length: spokes }, (_, i) => {
        const a = (i / spokes) * Math.PI * 2 + w.id * 0.7;
        return <line key={i} x1={w.x} y1={w.y} x2={w.x + Math.cos(a) * R} y2={w.y + Math.sin(a) * R} stroke={col} strokeWidth={(w.trap ? 1.8 : 1.3) * k} />;
      })}
      {Array.from({ length: rings }, (_, j) => <polygon key={j} points={pts(R * (j + 1) / (rings + 0.3), j)} fill="none" stroke={col} strokeWidth={(w.trap ? 1.6 : 1.1) * k} />)}
      {w.trap && <circle cx={w.x} cy={w.y} r={R} fill="none" stroke={stuck ? '#fde047' : '#cbd5e1'} strokeWidth={2.5 * k} strokeDasharray={`${5 * k} ${4 * k}`} />}
    </g>
  );
}

function Egg({ e, k, t }) {
  const grow = Math.min(1, e.t / 0.4), pulse = 1 + Math.sin(t * 3 + e.id) * 0.04;
  const R = e.r * grow * pulse;
  return (
    <g>
      <circle cx={e.x} cy={e.y} r={e.hatchR} fill="none" stroke="#fca5a5" strokeWidth={1.2 * k} strokeDasharray={`${4 * k} ${6 * k}`} opacity={0.45} />
      <ellipse cx={e.x} cy={e.y} rx={R} ry={R * 1.18} fill="#e7e5e4" stroke="#78716c" strokeWidth={2 * k} />
      {[0, 1, 2, 3].map(i => <path key={i} d={`M${e.x - R} ${e.y + (i - 1.5) * R * 0.45} Q ${e.x} ${e.y + (i - 1.5) * R * 0.45 + R * 0.35} ${e.x + R} ${e.y + (i - 1.5) * R * 0.45}`}
        fill="none" stroke="#a8a29e" strokeWidth={1.1 * k} />)}
      {[0, 1, 2].map(i => <circle key={`d${i}`} cx={e.x + (i - 1) * R * 0.35} cy={e.y - R * 0.15 + (i % 2) * R * 0.3} r={R * 0.13} fill="#57534e" opacity={0.55 + 0.3 * Math.sin(t * 5 + i)} />)}
    </g>
  );
}

// the MAIM wind-up: where his hands will close (tracks you, then locks)
export function MaimRing({ m, k }) {
  if (!m) return null;
  const p = Math.min(1, m.t / m.dur), locked = m.t >= m.lockAt;
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9, overflow: 'visible' }}>
      <circle cx={m.x} cy={m.y} r={m.r} fill={`rgba(220,38,38,${0.12 + 0.3 * p})`} stroke={locked ? '#fecaca' : '#ef4444'} strokeWidth={(locked ? 4 : 3) * k}
        strokeDasharray={locked ? undefined : `${14 * k} ${8 * k}`} />
      <circle cx={m.x} cy={m.y} r={m.r * (1 - p) + 4 * k} fill="none" stroke="#fee2e2" strokeWidth={2.5 * k} opacity={0.9} />
      <text x={m.x} y={m.y - m.r - 8 * k} textAnchor="middle" fill="#fecaca" fontSize={13 * Math.max(0.85, k)} fontWeight={900}
        style={{ paintOrder: 'stroke', stroke: '#450a0a', strokeWidth: 3 }}>MAIM · GET OUT</text>
    </svg>
  );
}

export const SPIDER_CSS = `
  .spider-rig { position:absolute; inset:0; pointer-events:none; }
  .spider-rig img { max-width:none; max-height:none; }
  .spider-piece { position:absolute; }
  .spider-body { position:absolute; width:0; height:0; transform-origin:0 0; }
  .spider-thread { position:absolute; inset:0; overflow:visible; }
`;
