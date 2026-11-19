import React, { useEffect, useState } from "react";

export function Link({ to = "/", children, className = "", ...props }) {
  return <a href={`#${to}`} className={className} {...props}>{children}</a>;
}

export function useSaved(key, initial) {
  const read = () => {
    try {
      const value = JSON.parse(window.localStorage.getItem(key));
      return value === null || (Array.isArray(initial) && !Array.isArray(value)) ? initial : value;
    } catch {
      return initial;
    }
  };
  const [value, setValue] = useState(read);
  useEffect(() => {
    const sync = (event) => {
      if (!event.key || event.key === key) setValue(read());
    };
    window.addEventListener("storage", sync);
    window.addEventListener("glidepath-storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("glidepath-storage", sync);
    };
  }, [key]);
  return [value, (nextOrUpdate) => {
    const next = typeof nextOrUpdate === "function" ? nextOrUpdate(read()) : nextOrUpdate;
    setValue(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event("glidepath-storage"));
    } catch {}
  }];
}
