"use client";

import { useId, type InputHTMLAttributes } from "react";

export function TextField({
  label,
  hint,
  id,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-2 block text-[15px] font-medium">
        {label}
      </label>
      <input
        id={fieldId}
        className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-ink outline-none transition duration-200 placeholder:text-muted"
        {...props}
      />
      {hint ? <p className="mt-2 text-[13px] leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}
