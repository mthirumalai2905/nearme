import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import Link from "next/link";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#suggestions", label: "Suggestions" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 px-4 pt-4 md:px-8">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4">
        <div className="flex h-12 items-center rounded-full border border-line/70 bg-bg/85 pr-4 pl-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          <Logo circle className="text-[15px]" />
        </div>

        <div className="flex h-12 items-center rounded-full border border-line/70 bg-bg/85 pr-1.5 pl-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          <nav aria-label="Primary" className="hidden items-center lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-2 text-[13px] font-medium text-muted transition duration-200 hover:bg-surface hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <span className="mx-1 hidden h-4 w-px bg-line lg:block" aria-hidden="true" />
          <ButtonLink href="/join" variant="ghost" size="sm" pill className="hidden px-3 sm:inline-flex">
            Join
          </ButtonLink>
          <ThemeToggle className="h-9 w-9 rounded-full" />
          <ButtonLink href="/create" size="sm" pill className="px-4">
            Create session
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
