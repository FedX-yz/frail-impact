// A screen title written like a terminal prompt: C:\FRAIL\DECK> _
export default function TermTitle({ path, style, onClick, small = false }) {
  return (
    <span onClick={onClick} style={{ fontFamily: 'var(--font-ui)', color: 'var(--amber)', fontSize: small ? 13 : 17, letterSpacing: 1, whiteSpace: 'nowrap', userSelect: 'none', ...style }}>
      <span style={{ color: 'var(--amber-dim)' }}>C:\FRAIL\</span>{path}&gt;<span className="term-cursor">_</span>
    </span>
  );
}
