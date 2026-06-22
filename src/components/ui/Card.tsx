import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface p-6 shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function CardTitle({ children, action }: CardTitleProps) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="flex items-center gap-2.5 font-serif text-[18px] font-semibold">
        {children}
      </h3>
      {action ? <span className="ml-auto">{action}</span> : null}
    </div>
  );
}
