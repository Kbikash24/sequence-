"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { AlertCircle, Info } from "lucide-react";
import { useGameStore } from "@/stores/game";

export function NoticeToast() {
  const notice = useGameStore((s) => s.notice);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => {
      if (useGameStore.getState().notice?.id === notice.id)
        useGameStore.setState({ notice: null });
    }, 3500);
    return () => clearTimeout(id);
  }, [notice]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4"
      aria-live="polite"
    >
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm shadow-xl"
          >
            {notice.tone === "error" ? (
              <AlertCircle className="h-4 w-4 text-rose-400" />
            ) : (
              <Info className="h-4 w-4 text-sky-400" />
            )}
            {notice.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
