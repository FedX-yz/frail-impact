// The terminal screen filter over the whole game: barely-there scanlines and vignette (~5-8%).
// Settings → Screen filter turns it off. Never blocks clicks.
import { useEffect, useState } from 'react';
import { getSettings, onSettings } from '../utils/settings';

export default function CrtOverlay() {
  const [on, setOn] = useState(() => getSettings().crt);
  useEffect(() => onSettings(s => setOn(s.crt)), []);
  if (!on) return null;
  return (
    <div aria-hidden="true" style={{
      position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'none',
      background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.035) 0 1px, transparent 1px 3px)',
      boxShadow: 'inset 0 0 120px rgba(0,0,0,0.08)',
    }} />
  );
}
