"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { MacbookShowcase } from "@/components/landing/MacbookShowcase";
import { Logo } from "@/components/layout/Logo";
import { ButtonLink } from "@/components/ui/Button";

const ease = [0.22, 1, 0.36, 1] as const;

export function HomePage() {
  const reduce = useReducedMotion();
  const fade = (delay: number, y = 24) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.75, delay, ease },
        };

  return (
    <main id="content">
      <section className="relative h-[100svh] overflow-hidden text-[#1d1d1f]">
        <motion.div
          className="absolute inset-0"
          aria-hidden="true"
          initial={reduce ? false : { opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { duration: 0 } : { duration: 1.15, ease }}
        >
          <Image src="/hero-landscape.jpg" alt="" fill priority className="object-cover object-[center_58%]" sizes="100vw" />
        </motion.div>

        <motion.div className="absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-6" {...fade(0.05, -12)}>
          <nav aria-label="Primary" className="flex items-center gap-2 rounded-full border border-white/80 bg-white/80 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.1)] backdrop-blur-2xl">
            <Logo onPhoto circle className="h-9 px-2.5 text-[15px]" />
            <ButtonLink href="/create" variant="ink" size="sm" pill>
              Create session
            </ButtonLink>
          </nav>
        </motion.div>

        <div className="relative z-10 flex h-full flex-col">
          <div className="px-5 pt-24 text-center md:pt-28">
            <motion.h1 className="mx-auto max-w-3xl text-[42px] leading-[1.02] font-semibold tracking-[-0.045em] sm:text-[60px] lg:text-[68px]" {...fade(0.12)}>
              Find your people,
              <motion.span className="mt-1 block font-serif text-[1.02em] font-normal italic tracking-[-0.03em]" {...fade(0.22)}>
                on one map.
              </motion.span>
            </motion.h1>
            <motion.p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-[#1d1d1f]/70 sm:text-[18px]" {...fade(0.32)}>
              A temporary session for the group you are meeting. Share location, see distances, and pick a place that is fair.
            </motion.p>
            <motion.div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row" {...fade(0.42)}>
              <ButtonLink href="/create" variant="ink" pill className="min-w-44 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                Create a session
              </ButtonLink>
              <ButtonLink href="/join" variant="photo" pill className="min-w-44 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
                Join with a link
              </ButtonLink>
            </motion.div>
          </div>

          <motion.div id="product" className="relative mt-6 min-h-0 flex-1 md:mt-8" {...fade(0.5, 64)}>
            <div className="absolute inset-x-0 top-0 h-[200%]">
              <MacbookShowcase />
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
