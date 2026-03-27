import { useState, useCallback } from "react";

type ToastType = "success" | "error" | "info" | "warning";

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const show = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, type });
  }, []);

  const hide = useCallback(() => setToast(null), []);

  return { toast, show, hide };
}
