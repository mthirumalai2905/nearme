"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Appear } from "@/components/motion/Appear";
import { SiteHeader } from "@/components/layout/SiteHeader";

export function MacStage({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative min-h-dvh">
      <motion.img
        src="/hero-landscape.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        initial={reduce ? false : { opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />
      <div className="relative min-h-dvh">
        <Appear className="absolute inset-x-0 top-0 z-20" y={-12} delay={0.05}>
          <SiteHeader />
        </Appear>
        <main id="content" className="absolute inset-0 flex items-center justify-center overflow-y-auto px-5 pt-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Appear className="w-full max-w-[440px]" y={28} delay={0.16}>
          <div className="overflow-hidden rounded-[14px] border border-white/70 bg-[#f5f5f7] text-[#1d1d1f] shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
            <div className="relative flex h-11 items-center border-b border-black/10 bg-white/90 px-3.5">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>
              <p className="pointer-events-none absolute inset-x-0 text-center text-[13px] font-medium">Near Me</p>
            </div>
            <div className="px-6 py-7 sm:px-8">{children}</div>
          </div>
          </Appear>
        </main>
      </div>
    </div>
  );
}
