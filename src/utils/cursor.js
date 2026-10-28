// The battle cursor's sizes, colours and its hit / heal tracking (drawn by components/GameCursor.jsx)
export const CURSOR_SIZES = { s: 22, m: 30, l: 40, xl: 52 };   // arrow height in px
export const CURSOR_THEMES = {
  cyan:   { glow: '#8fffff', rim: '#ffffff', accent: '#00feff', heal: '#00feff' },
  yellow: { glow: '#fbff78', rim: '#feffc6', accent: '#eeff00', heal: '#feffc6' },
};

// HP changes → the flash. Called once a frame with the player; `log` is a ref's object.
// Hits flash at once; heals count once they add up to 2% of your HP within a moment
// (regen ticking up doesn't flash, the Deer's heal over 1.5s does).
export function trackHp(log, pl, now) {
  const max = pl.maxHp || 1, hp = pl.hp;
  if (log.hp == null || log.max !== max) { log.hp = hp; log.max = max; return; }
  const live = log.flash && now - log.flash.last < 0.6;
  if (hp < log.hp - 0.01) {
    const from = live && log.flash.kind === 'hit' ? log.flash.from : log.hp / max;
    log.flash = { kind: 'hit', from, to: hp / max, t0: live && log.flash.kind === 'hit' ? log.flash.t0 : now, last: now };
    log.healFrom = null;
  } else if (hp > log.hp + 0.01 && log.hp > 0) {
    if (log.healFrom == null || now - log.healT > 0.3) log.healFrom = log.hp;
    log.healT = now;
    if (hp - log.healFrom >= max * 0.02) {
      const cont = live && log.flash.kind === 'heal';
      log.flash = { kind: 'heal', from: cont ? log.flash.from : log.healFrom / max, to: hp / max, t0: cont ? log.flash.t0 : now, last: now };
    }
  }
  log.hp = hp;
}
