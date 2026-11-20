import React, { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);
let nextToastId = 0;

export function GlidyToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, tone = "success") => {
    const id = ++nextToastId;
    setToasts((current) => [...current, { id, message, tone }].slice(-3));
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);

  return <ToastContext.Provider value={toast}>
    {children}
    <div className="glidy-toast-stack" aria-live="polite" aria-relevant="additions removals">
      {toasts.map((item) => <div className={`glidy-toast ${item.tone}`} key={item.id} role={item.tone === "error" ? "alert" : "status"}>{item.message}</div>)}
    </div>
  </ToastContext.Provider>;
}

export function useGlidyToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useGlidyToast must be used within GlidyToastProvider");
  return toast;
}
