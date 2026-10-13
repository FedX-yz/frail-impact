import { useEffect, useState } from 'react';

// Phone-sized screens (narrow, or a phone turned sideways)
const QUERY = '(max-width: 760px), (max-height: 520px)';

export default function useIsMobile() {
  const get = () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
  const [mobile, setMobile] = useState(get);
  const [portrait, setPortrait] = useState(() => typeof window !== 'undefined' && window.innerHeight >= window.innerWidth);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => { setMobile(mq.matches); setPortrait(window.innerHeight >= window.innerWidth); };
    mq.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    return () => { mq.removeEventListener('change', onChange); window.removeEventListener('resize', onChange); };
  }, []);
  return { mobile, portrait };
}
