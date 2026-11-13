import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { TeamCredit } from "@/components/team-credit";
import { ArrowRight, Clock, FilePlus2, ScanLine, UserPlus, type LucideIcon } from "lucide-react";

const steps: Array<{ Icon: LucideIcon; word: string; line: string }> = [
  { Icon: FilePlus2, word: "Collect", line: "Everyone on the consignment adds their own papers." },
  { Icon: ScanLine, word: "Cross-check", line: "GateIQ compares every document with the others." },
  { Icon: Clock, word: "Gate", line: "Checks at the terminal gate. Coming next." },
];

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col">
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

      <section className="relative flex-1 overflow-hidden bg-brand-navy px-4 py-20 text-on-dark sm:px-8 lg:py-[120px]">
        <Dots />
        <div className="relative mx-auto max-w-[880px] text-center">
          <h1 className="text-[56px] font-semibold leading-[1.05] tracking-[-2px] sm:text-[72px] lg:text-[96px]">GateIQ</h1>
          <p className="mx-auto mt-6 max-w-[560px] text-subtitle text-on-dark-muted">
            Every document on one export consignment, checked against each other.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/sign-in?mode=sign-up" variant="primary">
              <UserPlus size={16} strokeWidth={1.8} aria-hidden="true" />Create an account
            </ButtonLink>
            <ButtonLink href="/sign-in" variant="secondary-on-dark">
              Sign in<ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </ButtonLink>
          </div>

          <ol className="mx-auto mt-16 grid max-w-[720px] gap-6 text-left sm:grid-cols-3">
            {steps.map(({ Icon, word, line }) => (
              <li key={word}>
                <Icon size={20} strokeWidth={1.6} className="text-on-dark-muted" aria-hidden="true" />
                <p className="mt-2 text-[15px] font-semibold">{word}</p>
                <p className="mt-1 text-body-sm text-on-dark-muted">{line}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-hairline px-4 py-6 text-body-sm text-steel sm:px-8">
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
    { c: "#ff64c8", x: "3%", y: "80%", s: 10 },
    { c: "#2a9d99", x: "86%", y: "16%", s: 12 },
    { c: "#dd5b00", x: "97%", y: "74%", s: 16 },
    { c: "#7b3ff2", x: "94%", y: "40%", s: 8 },
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
