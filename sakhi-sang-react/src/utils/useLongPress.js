import { useRef, useCallback } from 'react';

/**
 * Long-press hook: triggers `onLongPress` after `delay` ms of continuous hold.
 * Returns props to spread on a target element.
 *   const lp = useLongPress(() => enterSelectMode(id), 600);
 *   <div {...lp}>...</div>
 */
export default function useLongPress(onLongPress, delay = 600) {
  const timer = useRef(null);
  const triggered = useRef(false);

  const start = useCallback((e) => {
    triggered.current = false;
    timer.current = setTimeout(() => {
      triggered.current = true;
      onLongPress(e);
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  return {
    onMouseDown: start,
    onTouchStart: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchEnd: clear,
    onTouchCancel: clear,
    // Caller can check if a click came from a long-press
    wasLongPress: () => triggered.current,
  };
}
