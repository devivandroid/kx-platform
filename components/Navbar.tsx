"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { WalletMenuButton } from "@/components/WalletMenuButton";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "New Product", href: "/publish-resource" },
  { label: "Jobs", href: "/requests" },
  { label: "My Activity", href: "/my-activity" },
  { label: "Trust Engine", href: "/reputation" },
  { label: "Trust Services", href: "/trust-services" },
  { label: "Agent API", href: "/agent-api" },
  { label: "Walkthrough", href: "/walkthrough" }
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-arc-border/80 bg-arc-ink/85 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <BrandLogo />
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <WalletMenuButton />
      </nav>
      <div className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-lg border border-arc-border bg-white/5 px-3 py-2 text-sm text-slate-300"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
