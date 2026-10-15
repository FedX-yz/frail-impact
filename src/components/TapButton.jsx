import { useRef } from 'react';

// A button for menus that pop up in the middle of a tap.
//
// On phones, lifting your finger sends a "click" to whatever is under it at
// that moment — so if the tap itself opened a menu (the ult orb opening Room 16's
// picker, a cutscene line turning into a choice), the button that appeared under
// your finger gets pressed instantly. This one only counts a click if the press
// also started on it. Keyboard presses (Enter / Space) still work.
export default function TapButton({ onClick, onPointerDown, ...rest }) {
  const armed = useRef(false);
  return (
    <button
      {...rest}
      onPointerDown={e => { armed.current = true; onPointerDown?.(e); }}
      onClick={e => {
        const ok = armed.current || e.detail === 0;   // detail 0 = keyboard
        armed.current = false;
        if (ok) onClick?.(e);
      }}
    />
  );
}
