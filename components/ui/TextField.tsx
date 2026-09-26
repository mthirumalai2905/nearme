"use client";

import { useId, type InputHTMLAttributes } from "react";

export function TextField({
  label,
  hint,
  id,
  light = false,
  ...props
}: { label: string; hint?: string; light?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div>
      <label htmlFor={fieldId} className={light ? "mb-2 block text-[15px] font-medium text-[#1d1d1f]" : "mb-2 block text-[15px] font-medium"}>
        {label}
      </label>
      <input
        id={fieldId}
        className={
          light
            ? "h-11 w-full rounded-xl border border-black/10 bg-white px-4 text-[16px] text-[#1d1d1f] outline-none transition duration-200 placeholder:text-[#6e6e73]"
            : "h-12 w-full rounded-xl border border-line bg-bg px-4 text-ink outline-none transition duration-200 placeholder:text-muted"
        }
        {...props}
      />
      {hint ? <p className={light ? "mt-2 text-[13px] leading-5 text-[#6e6e73]" : "mt-2 text-[13px] leading-5 text-muted"}>{hint}</p> : null}
    </div>
  );
}
