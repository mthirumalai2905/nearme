import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function Logo({ className, onPhoto = false, circle = false }: { className?: string; onPhoto?: boolean; circle?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5 text-[16px] font-semibold tracking-tight", onPhoto ? "text-[#1d1d1f]" : "text-ink", className)}>
      <span
        className={cn(
          "grid h-7 w-7 place-items-center text-[13px]",
          circle ? "rounded-full" : "rounded-lg",
          onPhoto ? "bg-[#1d1d1f] text-white" : "bg-ink text-bg",
        )}
        aria-hidden="true"
      >
        N
      </span>
      Near Me
    </Link>
  );
}
