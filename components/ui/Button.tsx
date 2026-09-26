import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const variants = {
  primary: "bg-accent text-white hover:bg-[var(--accent-press)]",
  secondary: "border border-line bg-bg text-ink hover:bg-surface",
  ghost: "text-ink hover:bg-surface",
  danger: "text-danger hover:bg-surface",
  ink: "bg-[#1d1d1f] text-white hover:bg-black",
  photo: "border border-white/80 bg-white/80 text-[#1d1d1f] hover:bg-white",
};

const sizes = {
  sm: "h-9 px-3.5 text-[14px]",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-5 text-[16px]",
};

type Variant = keyof typeof variants;

function classes(variant: Variant, size: keyof typeof sizes, pill: boolean, className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-medium transition duration-200 disabled:pointer-events-none disabled:opacity-40",
    pill ? "rounded-full" : "rounded-xl",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "lg",
  pill = false,
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  pill?: boolean;
}) {
  return <button type={type} className={classes(variant, size, pill, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "lg",
  pill = false,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: keyof typeof sizes;
  pill?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={classes(variant, size, pill, className)}>
      {children}
    </Link>
  );
}

export function IconButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-bg text-ink transition duration-200 hover:bg-surface disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
