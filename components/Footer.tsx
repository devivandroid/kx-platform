import Link from "next/link";
import Image from "next/image";
import { BrandLogo } from "@/components/BrandLogo";

const footerLinks = [
  { label: "Marketplace", href: "/marketplace", external: false },
  { label: "Jobs", href: "/requests", external: false },
  { label: "Risk Intelligence", href: "/reputation", external: false },
  { label: "Agent API", href: "/agent-api", external: false },
  {
    label: "GitHub",
    href: "https://github.com/devivandroid/kx-platform",
    external: true
  },
  { label: "X", href: "https://x.com/KnowledgeOnArc", external: true }
];

export function Footer() {
  return (
    <footer className="border-t border-arc-border/80">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 text-sm text-slate-500 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3">
            <BrandLogo />
            <p>Human and agent commerce on Arc Testnet</p>
          </div>
          <div className="flex flex-wrap gap-5">
            {footerLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-arc-blue"
                >
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} href={link.href} className="transition hover:text-arc-blue">
                  {link.label}
                </Link>
              )
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-arc-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-normal text-slate-500">
              Ecosystem
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-arc-border bg-white/[0.03] px-3 py-1 text-xs font-semibold text-slate-200">
              <Image
                src="/brand/ecosystem/arc-logo.svg"
                alt=""
                aria-hidden="true"
                width={16}
                height={16}
                className="h-4 w-4 object-contain"
              />
              Built on Arc
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-arc-border bg-white/[0.03] px-3 py-1 text-xs font-semibold text-slate-200">
              <Image
                src="/brand/ecosystem/usdc-logo.svg"
                alt=""
                aria-hidden="true"
                width={16}
                height={16}
                className="h-4 w-4 object-contain"
              />
              Powered by USDC
            </span>
          </div>
          <p className="max-w-2xl text-xs leading-5 text-slate-600">
            KX Platform is an independent project and is not affiliated with or endorsed by
            Circle or Arc.
          </p>
        </div>
      </div>
    </footer>
  );
}
