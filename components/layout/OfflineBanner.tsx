"use client";

import { useOnline } from "@/hooks/useTheme";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <p role="status" className="fixed inset-x-0 top-0 z-50 bg-ink px-5 py-3 text-center text-[14px] text-bg">
      You’re offline. We’ll reconnect automatically.
    </p>
  );
}
