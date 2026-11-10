import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { tintBg } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { TeamCredit } from "@/components/team-credit";
import type { Tint } from "@/lib/roles";
import { ArrowRight, Clock, FilePlus2, ScanLine, ShieldCheck, UserPlus, type LucideIcon } from "lucide-react";

const stageIcon: LucideIcon[] = [FilePlus2, ScanLine, ShieldCheck];

const stages: Array<{ n: string; title: string; body: string; tint: Tint }> = [
  {
    n: "01",
    title: "Create the case",
    body: "The consignor records the goods, quantities, weights and value, and gets a Case ID. They invite the consignee, CHA and transporter to the case by username.",
    tint: "lavender",
  },
  {
    n: "02",
    title: "Record what was filed",
    body: "After filing the shipping bill on ICEGATE, the consignor attaches it. GateIQ normalises units, dates and names into one standard record.",
    tint: "peach",
  },
  {
    n: "03",
    title: "Ready for the gate",
    body: "The shipping bill and e-way bill become the Filed baseline that the papers and the truck are checked against at the gate. GateIQ never corrects it.",
    tint: "mint",
  },
];

export default function Home() {
  return (
    <main>
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <ButtonLink href="/sign-in" variant="primary">
              Sign in
            </ButtonLink>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-brand-navy px-4 py-20 text-on-dark sm:px-8 lg:py-[120px]">
        <Dots />
        <div className="relative mx-auto max-w-[880px] text-center">
          <p className="text-micro-upper text-on-dark-muted">Customs gate verification</p>
          <h1 className="mt-4 text-[56px] font-semibold leading-[1.05] tracking-[-2px] sm:text-[72px] lg:text-[96px]">GateIQ</h1>
          <p className="mx-auto mt-6 max-w-[640px] text-subtitle text-on-dark-muted">
            GateIQ keeps one record per consignment, from the exporter&apos;s declaration to the terminal gate, and shows every
            place the paperwork and the cargo disagree.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/sign-in?mode=sign-up" variant="primary">
              <UserPlus size={16} strokeWidth={1.8} aria-hidden="true" />Create an account
            </ButtonLink>
            <ButtonLink href="#how" variant="secondary-on-dark">
              How it works<ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8 lg:py-24">
        <h2 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">How a consignment moves through GateIQ</h2>
        <p className="mt-3 max-w-[640px] text-slate">The first three stages are live. Gate, weighbridge and inspection stages follow.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {stages.map((s, i) => {
            const Icon = stageIcon[i];
            return (
            <div key={s.n} className={`${tintBg[s.tint]} rounded-lg p-8 text-charcoal`}>
              <span className="flex items-center justify-between text-micro-upper text-slate">
                Stage {s.n}
                <Icon size={24} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-h4">{s.title}</h3>
              <p className="mt-2 text-body-sm">{s.body}</p>
            </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-lg bg-tint-yellow-bold p-8 text-charcoal">
          <span className="flex items-center gap-1.5 text-micro-upper text-slate"><Clock size={14} strokeWidth={2} aria-hidden="true" />Coming next</span>
          <h3 className="mt-3 text-h4">Direct ICEGATE and e-way bill lookups</h3>
          <p className="mt-2 max-w-[720px] text-body-sm">
            Through ULIP, GateIQ will fetch the filed record itself instead of relying on what was typed, and mark it as source-verified.
          </p>
        </div>
      </section>

      <footer className="border-t border-hairline px-4 py-10 text-body-sm text-steel sm:px-8">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4">
          <Logo />
          <TeamCredit />
        </div>
      </footer>
    </main>
  );
}

/** Decorative note dots for the hero band. */
function Dots() {
  const dots = [
    { c: "#f9e79f", x: "8%", y: "18%", s: 14 },
    { c: "#ff64c8", x: "16%", y: "72%", s: 10 },
    { c: "#2a9d99", x: "86%", y: "24%", s: 12 },
    { c: "#dd5b00", x: "78%", y: "78%", s: 16 },
    { c: "#7b3ff2", x: "92%", y: "54%", s: 8 },
    { c: "#1aae39", x: "4%", y: "46%", s: 8 },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden sm:block">
      <svg className="absolute inset-0 h-full w-full opacity-20" preserveAspectRatio="none">
        <path d="M0,80 C300,10 500,200 900,60 S1400,160 1800,40" stroke="#a4a097" fill="none" strokeWidth="1" />
        <path d="M0,420 C260,340 620,520 1000,400 S1500,480 1800,380" stroke="#a4a097" fill="none" strokeWidth="1" />
      </svg>
      {dots.map((d, i) => (
        <span key={i} className="absolute rounded-[3px]" style={{ left: d.x, top: d.y, width: d.s, height: d.s, background: d.c }} />
      ))}
    </div>
  );
}
