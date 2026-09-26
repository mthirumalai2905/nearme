"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Map, MapPin, Users } from "lucide-react";

const PreviewMap = dynamic(() => import("@/components/landing/PreviewMap").then((mod) => mod.PreviewMap), {
  ssr: false,
});

const PANES = [
  { id: "map", label: "Map", icon: Map },
  { id: "people", label: "People", icon: Users },
  { id: "places", label: "Places", icon: MapPin },
] as const;

type Pane = (typeof PANES)[number]["id"];

const PEOPLE = [
  { name: "Thiru", detail: "Sharing", avatar: "/avatars/01.jpg" },
  { name: "Alex", detail: "1.8 km away", avatar: "/avatars/04.jpg" },
  { name: "Sarah", detail: "3.4 km away", avatar: "/avatars/09.jpg" },
  { name: "John", detail: "7.2 km away", avatar: "/avatars/12.jpg" },
];

const PLACES = [
  { name: "Cafe", note: "Closest overall" },
  { name: "Park", note: "Open space between the group" },
  { name: "Restaurant", note: "Similar travel for each person" },
];

export function MacbookShowcase() {
  const [pane, setPane] = useState<Pane>("map");

  return (
    <div className="mx-auto h-full w-[min(1360px,calc(100vw-1.5rem))]">
      <div
        className="h-full rounded-[18px] p-px shadow-[0_24px_50px_rgba(0,0,0,0.28)]"
        style={{ background: "linear-gradient(180deg, #8a8a8e 0%, #2a2a2c 22%, #0a0a0c 100%)" }}
      >
        <div className="h-full rounded-[17px] bg-[#0c0c0e] p-[7px] pb-[9px] sm:p-[8px] sm:pb-[10px]">
          <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[9px] bg-[#d7e6f2]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-landscape.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center">
              <div className="flex h-[20px] w-[118px] items-center justify-center rounded-b-[10px] bg-[#0c0c0e] sm:h-[22px] sm:w-[132px]">
                <span className="h-[7px] w-[7px] rounded-full bg-[#1c1c1e] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]" />
              </div>
            </div>

            <div className="relative z-20 flex h-7 shrink-0 items-center gap-3.5 bg-white/55 px-3 text-[11px] text-[#1d1d1f] backdrop-blur-xl sm:h-8 sm:px-3.5 sm:text-[12px]">
              <span className="flex items-center gap-1.5 font-semibold tracking-tight">
                <svg viewBox="0 0 14 17" className="h-3.5 w-3" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M11.2 8.9c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.7-3.1.7s-1.6-.7-2.7-.7c-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7s1.6.7 2.7.7 1.8-1 2.5-2c.8-1.1 1.1-2.2 1.1-2.3-.1 0-2.2-.8-2.2-3.4zM9.4 2.7c.6-.7 1-1.6.9-2.6-1 .1-2.1.6-2.7 1.4-.6.7-1.1 1.7-.9 2.6 1 .1 2.1-.5 2.7-1.4z"
                  />
                </svg>
                Near Me
              </span>
              <span className="hidden items-center gap-3.5 sm:flex">
                <span>File</span>
                <span>Edit</span>
                <span>View</span>
              </span>
              <span className="ml-auto font-medium tabular-nums">9:41</span>
            </div>

            <div className="relative z-20 min-h-0 flex-1 px-3 pt-2.5 pb-3 sm:px-4 sm:pt-3">
              <div className="isolate flex h-full flex-col overflow-hidden rounded-[12px] border border-black/10 bg-[#f5f5f7] shadow-[0_22px_50px_rgba(0,0,0,0.28)]">
                <div className="relative flex h-9 shrink-0 items-center border-b border-black/8 bg-white/90 px-3">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                    <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                    <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                  </div>
                  <p className="pointer-events-none absolute inset-x-0 text-center text-[12px] font-medium text-[#1d1d1f]">Near Me</p>
                </div>

                <div className="flex min-h-0 flex-1">
                  <nav aria-label="App" className="flex w-[132px] shrink-0 flex-col gap-0.5 border-r border-black/8 bg-[#f5f5f7] p-2 sm:w-[148px]">
                    {PANES.map((item) => {
                      const Icon = item.icon;
                      const active = pane === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPane(item.id)}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] ${active ? "bg-black/8 font-medium text-[#1d1d1f]" : "text-[#1d1d1f]/75 hover:bg-black/5"}`}
                        >
                          <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                          {item.label}
                        </button>
                      );
                    })}
                  </nav>

                  <div className="relative min-h-0 min-w-0 flex-1 bg-white">
                    {pane === "map" ? (
                      <div className="absolute inset-0">
                        <PreviewMap />
                      </div>
                    ) : null}
                    {pane === "people" ? (
                      <ul className="space-y-1 p-3">
                        {PEOPLE.map((person) => (
                          <li key={person.name} className="flex items-center gap-3 rounded-xl px-2 py-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={person.avatar} alt="" className="nm-avatar h-8 w-8" />
                            <span>
                              <span className="block text-[14px] font-medium text-[#1d1d1f]">{person.name}</span>
                              <span className="block text-[12px] text-[#6e6e73]">{person.detail}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {pane === "places" ? (
                      <ol className="space-y-2 p-3">
                        {PLACES.map((place, index) => (
                          <li key={place.name} className="flex items-center gap-3 rounded-xl border border-black/8 px-3 py-3">
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#f5f5f7] text-[12px] font-semibold text-[#1d1d1f]">
                              {index + 1}
                            </span>
                            <span>
                              <span className="block text-[14px] font-medium text-[#1d1d1f]">{place.name}</span>
                              <span className="block text-[12px] text-[#6e6e73]">{place.note}</span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
