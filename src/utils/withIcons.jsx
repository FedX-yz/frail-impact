// Text that may contain the emoji from data/icons.jsx → the same text with icons in their place
import { Fragment } from 'react';
import { BY_EMOJI, EMOJI_RE, USE_EMOJI } from '../data/icons';
import { Icon } from '../components/Icon';

export function withIcons(text) {
  if (USE_EMOJI || typeof text !== 'string' || !EMOJI_RE.test(text)) return text;
  EMOJI_RE.lastIndex = 0;
  const out = [];
  let last = 0, m, i = 0;
  while ((m = EMOJI_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<Icon key={`i${i++}`} name={BY_EMOJI[m[1]]} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((p, j) => (typeof p === 'string' ? <Fragment key={`t${j}`}>{p}</Fragment> : p));
}
