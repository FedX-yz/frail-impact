// A picture that fills its box, zoomed in on one spot (e.g. a face).
// focus = [x %, y %, zoom]: the spot in the picture and how far to zoom.
// The parent must have a size and `overflow: hidden`.
export default function FocusImg({ src, focus = [50, 30, 1], alt = '', style }) {
  const [x, y, zoom = 1] = focus;
  return (
    <img src={src} alt={alt} draggable={false} decoding="async"
      style={{
        width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${x}% ${y}%`,
        transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%`, display: 'block', ...style,
      }} />
  );
}
