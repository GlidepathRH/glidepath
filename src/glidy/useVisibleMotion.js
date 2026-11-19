import { useEffect, useRef, useState } from "react";

// Decorative loops only run while visible, including across tab switches.
export function useVisibleMotion() {
  const ref = useRef(null),
    [running, setRunning] = useState(false);
  useEffect(() => {
    let visible = false;
    const update = () => setRunning(visible && !document.hidden);
    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            update();
          })
        : null;
    if (observer && ref.current) observer.observe(ref.current);
    else {
      visible = true;
      update();
    }
    document.addEventListener("visibilitychange", update);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return { ref, "data-animating": running };
}
