"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

export function BottomSheet({
  summary,
  children,
  onHeight,
}: {
  summary: ReactNode;
  children: ReactNode;
  onHeight: (height: number) => void;
}) {
  const peek = 168;
  const [height, setHeight] = useState(peek);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; height: number; moved: boolean } | null>(null);

  useEffect(() => {
    onHeight(height);
  }, [height, onHeight]);

  function expanded() {
    return Math.min(window.innerHeight * 0.72, 640);
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    drag.current = { y: event.clientY, height, moved: false };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const delta = drag.current.y - event.clientY;
    if (Math.abs(delta) > 6) drag.current.moved = true;
    const next = Math.min(expanded(), Math.max(peek, drag.current.height + delta));
    setHeight(next);
  }

  function onPointerUp() {
    const moved = drag.current?.moved ?? false;
    drag.current = null;
    setDragging(false);
    if (!moved) {
      setHeight((current) => (current > peek + 24 ? peek : expanded()));
      return;
    }
    setHeight((current) => (current > (peek + expanded()) / 2 ? expanded() : peek));
  }

  const open = height > peek + 24;

  return (
    <section
      className="glass absolute inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-line md:hidden"
      style={{
        height,
        transition: dragging ? "none" : "height 200ms ease",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="People in this session"
    >
      <button
        type="button"
        className="flex w-full flex-col items-center gap-3 px-5 pt-3 pb-2"
        aria-expanded={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="h-1 w-10 rounded-full bg-line" />
        {!open ? <span className="w-full text-left">{summary}</span> : null}
      </button>
      <div className={open ? "h-[calc(100%-52px)] overflow-y-auto px-5 pb-6" : "hidden"}>{children}</div>
    </section>
  );
}
