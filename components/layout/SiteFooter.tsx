import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#product", label: "Live map" },
      { href: "/#suggestions", label: "Meeting suggestions" },
      { href: "/#how-it-works", label: "How it works" },
    ],
  },
  {
    title: "Session",
    links: [
      { href: "/create", label: "Create a session" },
      { href: "/join", label: "Join a session" },
    ],
  },
  {
    title: "Privacy",
    links: [{ href: "/privacy", label: "How location is used" }],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-muted">
            A temporary map for the people you are meeting. Location sharing ends with the session.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-[13px] font-semibold">{column.title}</p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[14px] text-muted hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
