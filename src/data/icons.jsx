// The drawings for components/Icon.jsx: line icons that replace the emoji in battle and on the story map.
//
// USE_EMOJI = true puts every emoji back (one switch, nothing else to change).
// Each icon is drawn on a 24×24 grid in the text colour (currentColor), so it
// takes the colour of the damage number / chip / label it sits in.
// To use real art instead of one of these, give it an `img` (a path in public/).
import { Fragment } from 'react';

export const USE_EMOJI = false;
// 'detailed' = game-icons.net art (data/gameIcons.js); 'bold' = my simple drawings, sticker look; 'line' = thin lines
export const ICON_STYLE = 'detailed';

// n-pointed star / burst
const star = (n, ro, ri, cx = 12, cy = 12, rot = -90) => Array.from({ length: n * 2 }, (_, i) => {
  const r = i % 2 ? ri : ro, a = (rot + i * 180 / n) * Math.PI / 180;
  return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
}).join(' ');
const F = { fill: 'currentColor', stroke: 'none' };

// name → { emoji it replaces, the drawing }
export const ICONS = {
  // ── Bio (Ten Shadows) shikigami ──
  dog:   { emoji: '🐺', draw: <><path d="M4 3 L8.5 9 H15.5 L20 3 L19.5 12 L16 17.5 L12 20.5 L8 17.5 L4.5 12 Z" /><path d="M9 12.5 L10.8 13.2 M15 12.5 L13.2 13.2" /><path d="M10.8 16.5 H13.2 L12 17.8 Z" {...F} /></> },
  toad:  { emoji: '🐸', draw: <><path d="M3 15 C3 10.5 6 9.5 7.5 9.3 A3 3 0 1 1 11 7.2 H13 A3 3 0 1 1 16.5 9.3 C18 9.5 21 10.5 21 15 C21 19 17 20.5 12 20.5 C7 20.5 3 19 3 15 Z" /><circle cx="8.6" cy="7.4" r="1.1" {...F} /><circle cx="15.4" cy="7.4" r="1.1" {...F} /><path d="M7 15 C10 17 14 17 17 15" /></> },
  nue:   { emoji: '🦅', draw: <><path d="M2 8.5 C6 7.5 9.5 9.5 12 13 C14.5 9.5 18 7.5 22 8.5 C19.5 10.5 17.5 11.8 15.3 12.8 L12 20.5 L8.7 12.8 C6.5 11.8 4.5 10.5 2 8.5 Z" /><path d="M10.5 6 L12 4 L13.5 6" /></> },
  // ── Battle markers ──
  wheel: { emoji: '☸', draw: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.4" />{[0, 45, 90, 135, 180, 225, 270, 315].map(d => { const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return <Fragment key={d}><path d={`M${(12 + c * 2.4).toFixed(2)} ${(12 + s * 2.4).toFixed(2)} L${(12 + c * 8.5).toFixed(2)} ${(12 + s * 8.5).toFixed(2)}`} /><circle cx={(12 + c * 10.6).toFixed(2)} cy={(12 + s * 10.6).toFixed(2)} r="1.1" {...F} /></Fragment>; })}</> },
  fist:  { emoji: '👊', draw: <><path d="M5 9.5 A2 2 0 0 1 9 9.5 A2 2 0 0 1 13 9.5 A2 2 0 0 1 17 9.5 A2 2 0 0 1 19.5 11 V15 C19.5 18.5 16.5 21 12.5 21 H10 C6.8 21 5 18.6 5 15.5 Z" /><path d="M5 13.3 H10.5 C12 13.3 12 15.6 10.5 15.6 H8" /><path d="M9 9.5 V11.5 M13 9.5 V11.5 M17 9.5 V11.5" /></> },
  spirit:{ emoji: '👻', draw: <><path d="M5 21 V10.5 A7 7 0 0 1 19 10.5 V21 L16.7 19.2 L14.3 21 L12 19.2 L9.7 21 L7.3 19.2 Z" /><circle cx="9.6" cy="11" r="1.3" {...F} /><circle cx="14.4" cy="11" r="1.3" {...F} /></> },
  hand:  { emoji: '✋', draw: <path d="M7 12.5 V6.5 A1.5 1.5 0 0 1 10 6.5 V11 V4.5 A1.5 1.5 0 0 1 13 4.5 V11 V5.5 A1.5 1.5 0 0 1 16 5.5 V12 V8.5 A1.5 1.5 0 0 1 19 8.5 V15 C19 19 16.2 22 12.2 22 C8.6 22 6.6 20.2 4.8 16.8 L3.3 13.8 A1.5 1.5 0 0 1 5.9 12.3 Z" /> },
  snow:  { emoji: '❄', noFill: true, draw: <><path d="M12 2.5 V21.5 M3.8 7.25 L20.2 16.75 M3.8 16.75 L20.2 7.25" /><path d="M9.6 3.8 L12 6 L14.4 3.8 M9.6 20.2 L12 18 L14.4 20.2 M3.6 10.2 L6.6 9.6 L5.6 6.7 M18.4 17.3 L17.4 14.4 L20.4 13.8 M3.6 13.8 L6.6 14.4 L5.6 17.3 M18.4 6.7 L17.4 9.6 L20.4 10.2" /></> },
  // ── Damage labels: skills ──
  rock:  { emoji: '🪨', draw: <><path d="M3.5 17 L6.5 9 L12 5.5 L18 8.5 L20.5 16 L15.5 19.5 H8 Z" /><path d="M6.5 9 L11 13 L18 8.5 M11 13 L12 19.5" /></> },
  atom:  { emoji: '⚛', draw: <><ellipse cx="12" cy="12" rx="10" ry="3.8" /><ellipse cx="12" cy="12" rx="10" ry="3.8" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="3.8" transform="rotate(120 12 12)" /><circle cx="12" cy="12" r="1.8" {...F} /></> },
  eye:   { emoji: '👁', draw: <><path d="M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z" /><circle cx="12" cy="12" r="3.6" /><circle cx="12" cy="12" r="1.3" {...F} /></> },
  note:  { emoji: '💃', noFill: true, draw: <><path d="M9 18 V5.5 L19.5 3.5 V16" /><path d="M9 9 L19.5 7" /><circle cx="6.6" cy="18" r="2.5" {...F} /><circle cx="17" cy="16" r="2.5" {...F} /></> },
  lava:  { emoji: '🌋', noFill: true, draw: <><path d="M2.5 20.5 L8.5 10.5 H15.5 L21.5 20.5 Z" /><path d="M10.5 10.5 C10.5 13 12 13 12 15.5 M13.5 10.5 C13.5 12.5 14.8 13 14.8 14.5" /><path d="M12 7.5 V3.5 M8.6 7.8 L6.6 4.4 M15.4 7.8 L17.4 4.4" /></> },
  flame: { emoji: '🔥', draw: <path d="M12 2.5 C13.5 6.5 18.5 8.5 18.5 14 A6.5 6.5 0 0 1 5.5 14 C5.5 10.5 8 9.5 8.8 6.5 C10.5 8.5 10.5 10.5 11.6 11.5 C13 9 12 6 12 2.5 Z" /> },
  dagger:{ emoji: '🗡', draw: <><path d="M12 2 L14.2 13 H9.8 Z" /><path d="M6.8 13 H17.2 M12 13 V19.5" /><circle cx="12" cy="21" r="1.4" /></> },
  slash: { emoji: '✂', noFill: true, draw: <path d="M3.5 20.5 L20.5 3.5 M3.5 14 L14 3.5 M10 20.5 L20.5 10" /> },
  burst: { emoji: '💥', draw: <polygon points={star(8, 10.5, 4.6)} /> },
  // ── Damage labels: ults ──
  moai:  { emoji: '🗿', draw: <><path d="M6.5 21.5 V9.5 C6.5 5 8.5 2.5 12 2.5 C15.5 2.5 17.5 5 17.5 9.5 V21.5 Z" /><path d="M6.8 9.6 H17.2" strokeWidth="2.8" /><path d="M12.6 9.8 L14 15.3 H11.2" /><path d="M9.8 18.2 H14.2" /></> },
  void:  { emoji: '🌌', draw: <><ellipse cx="12" cy="12" rx="11" ry="3.8" transform="rotate(-20 12 12)" /><circle cx="12" cy="12" r="5.2" fill="#140a04" /><path d="M8.2 14.2 A4.8 4.8 0 0 1 9.4 8.4" transform="rotate(-20 12 12)" /></> },
  drop:  { emoji: '💧', draw: <><path d="M12 2.5 C12 2.5 5 10.8 5 15 A7 7 0 0 0 19 15 C19 10.8 12 2.5 12 2.5 Z" /><path d="M8.6 15.2 A3.4 3.4 0 0 0 11.4 18.4" /></> },
  sparkle:{ emoji: '✨', draw: <><path d="M10 2.5 L11.8 9.2 L18.5 11 L11.8 12.8 L10 19.5 L8.2 12.8 L1.5 11 L8.2 9.2 Z" /><path d="M18.5 15 L19.3 17.7 L22 18.5 L19.3 19.3 L18.5 22 L17.7 19.3 L15 18.5 L17.7 17.7 Z" /></> },
  spiral:{ emoji: '🌀', noFill: true, draw: <path d="M12 12 m-1 0 a1 1 0 1 1 2 0 a3 3 0 1 1 -6 0 a5 5 0 1 1 10 0 a7 7 0 1 1 -14 0 a9 9 0 1 1 18 0" /> },
  collapse:{ emoji: '🏚', draw: <><path d="M2.5 20.5 H21.5 M5 20.5 V10.5 L12 4.5 L19 10.5 V20.5" /><path d="M12 4.5 L10.8 9.5 L13.2 12.8 L10.8 16.6 L12 20.5" /></> },
  comet: { emoji: '☄', noFill: true, draw: <><circle cx="16" cy="8" r="4.3" /><path d="M12.8 11.2 L3 21 M11.9 7.4 L5.2 14.1 M16.6 12.1 L9.9 18.8" /></> },
  orb:   { emoji: '🟣', draw: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity="0.35" stroke="none" /><path d="M8 9 A4.8 4.8 0 0 1 11.2 6.4" /></> },
  arrow: { emoji: '🏹', noFill: true, draw: <><path d="M4 20 L20 4 M20 4 H13.5 M20 4 V10.5" /><path d="M4 20 V15.5 M4 20 H8.5 M6.5 17.5 V13 M6.5 17.5 H11" /></> },
  // ── Popups ──
  shield:{ emoji: '🛡', draw: <path d="M12 2.5 L20 5.5 V12 C20 17 16.3 20.3 12 21.5 C7.7 20.3 4 17 4 12 V5.5 Z" /> },
  bolt:  { emoji: '⚡', draw: <path d="M13.5 2 L4.5 14 H11 L10 22 L19.5 9.5 H13 Z" fill="currentColor" fillOpacity="0.85" /> },
  warn:  { emoji: '⚠', draw: <><path d="M12 3 L22 20.5 H2 Z" /><path d="M12 9.5 V14.2" /><circle cx="12" cy="17.2" r="1.1" {...F} /></> },
  // ── HQ rooms (game-icons only; the simple styles fall back to a box) ──
  armory:    { emoji: '🛠', draw: <rect x="4" y="4" width="16" height="16" /> },
  infirmary: { emoji: '⚕', draw: <rect x="4" y="4" width="16" height="16" /> },
  security:  { emoji: '📹', draw: <rect x="4" y="4" width="16" height="16" /> },
  analytics: { emoji: '📊', draw: <rect x="4" y="4" width="16" height="16" /> },
  ops:       { emoji: '📡', draw: <rect x="4" y="4" width="16" height="16" /> },
  payroll:   { emoji: '💰', draw: <rect x="4" y="4" width="16" height="16" /> },
  // ── Story map ──
  book:  { emoji: '📖', draw: <path d="M3 5 C6 4 9 4 12 6 C15 4 18 4 21 5 V19 C18 18 15 18 12 20 C9 18 6 18 3 19 Z M12 6 V20" /> },
  swords:{ emoji: '⚔', noFill: true, draw: <><path d="M3.5 3.5 L15 15 M12.5 17.5 L17.5 12.5 M15 15 L19 19" /><circle cx="20.2" cy="20.2" r="1.2" /><path d="M20.5 3.5 L9 15 M6.5 12.5 L11.5 17.5 M9 15 L5 19" /><circle cx="3.8" cy="20.2" r="1.2" /></> },
  skull: { emoji: '💀', draw: <><path d="M12 2.5 C7 2.5 4 6 4 10.5 C4 13.5 5.6 15 7 15.8 V19.5 H17 V15.8 C18.4 15 20 13.5 20 10.5 C20 6 17 2.5 12 2.5 Z" /><circle cx="8.9" cy="10.8" r="2" {...F} /><circle cx="15.1" cy="10.8" r="2" {...F} /><path d="M10.4 19.5 V17 M13.6 19.5 V17 M12 13.2 L11 15 H13 Z" /></> },
  lock:  { emoji: '🔒', draw: <><rect x="4.5" y="10.5" width="15" height="11" /><path d="M8 10.5 V7 A4 4 0 0 1 16 7 V10.5" /><circle cx="12" cy="15.2" r="1.4" {...F} /><path d="M12 16.5 V18.5" /></> },
};

// emoji (with or without the ️ variation selector) → icon name
export const BY_EMOJI = Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [v.emoji, k]));
export const EMOJI_RE = new RegExp(`(${Object.keys(BY_EMOJI).map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\uFE0F?`, 'gu');

