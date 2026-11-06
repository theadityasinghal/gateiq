import { cn } from "@/lib/cn";

export const TEAM = ["Love Rajawat", "Aditya Singhal", "Ayush Yadav", "Bhut Meet", "Bhanwar Lal", "Kartikeya Jain"];

export function TeamCredit({ className }: { className?: string }) {
  return (
    <p className={cn("text-caption", className)}>
      Made by <span className="font-semibold">Eureka</span> ({TEAM.join(", ")})
    </p>
  );
}
