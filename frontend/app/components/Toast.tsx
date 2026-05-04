"use client";
import { createContext, useContext, useState, useCallback, useEffect } from "react";

type ToastType = "success" | "error" | "info" | "warning";
interface Toast {
  id: number;
  message: string;
  type: ToastType;
}
interface ToastCtx {
  toast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

const icons: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  info: "ℹ️",
  warning: "⚠️",
};
const colors: Record<ToastType, string> = {
  success: "bg-green-900/90 border-green-600 text-green-100",
  error: "bg-red-900/90 border-red-600 text-red-100",
  info: "bg-blue-900/90 border-blue-600 text-blue-100",
  warning: "bg-yellow-900/90 border-yellow-600 text-yellow-100",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let counter = 0;

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + counter++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-xl text-sm font-medium animate-slide-in pointer-events-auto ${colors[t.type]}`}
          >
            <span>{icons[t.type]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
