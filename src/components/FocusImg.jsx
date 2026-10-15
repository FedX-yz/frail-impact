// A picture that fills its box, zoomed in and centred on one spot (e.g. a face).
// focus = [x %, y %, zoom]: the spot in the picture and how far to zoom.
// The parent must have a size and `overflow: hidden`.
// With object-fit: cover and object-position x% y%, the spot sits at x% y% of the
// box; the translate then moves it to the middle (clamped so no empty edge shows)
// and the scale zooms around the middle.
export default function FocusImg({ src, focus = [50, 30, 1], at = [50, 50], alt = '', style }) {
  const [x, y, zoom = 1] = focus;
  const lim = 50 - 50 / Math.max(1, zoom);
  // `at` = where in the box the spot should end up (default: the middle)
  const tx = Math.max(-lim, Math.min(lim, 50 - x + (at[0] - 50) / zoom));
  const ty = Math.max(-lim, Math.min(lim, 50 - y + (at[1] - 50) / zoom));
  return (
    <img src={src} alt={alt} draggable={false} decoding="async"
      style={{
        width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${x}% ${y}%`,
        transform: `scale(${zoom}) translate(${tx}%, ${ty}%)`, transformOrigin: '50% 50%', display: 'block', ...style,
      }} />
  );
}
