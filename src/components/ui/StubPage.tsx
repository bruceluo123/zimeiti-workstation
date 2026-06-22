import type { LucideIcon } from "lucide-react";

interface StubPageProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  highlight?: string;
  features: string[];
}

export function StubPage({ icon: Icon, title, desc, highlight, features }: StubPageProps) {
  return (
    <div className="px-5 py-[90px] text-center text-muted">
      <div className="mx-auto mb-[18px] grid h-[54px] w-[54px] place-items-center rounded-[14px] bg-terra-wash text-terra">
        <Icon className="h-[26px] w-[26px]" strokeWidth={1.6} />
      </div>
      <h3 className="mb-2 font-serif text-[22px] font-semibold text-ink">{title}</h3>
      <p className="mx-auto mb-1.5 max-w-[420px] text-[14px]">{desc}</p>
      {highlight ? (
        <p className="mx-auto max-w-[420px] text-[14px] text-terra-deep">{highlight}</p>
      ) : null}
      <div className="mt-[22px] flex flex-wrap justify-center gap-2.5">
        {features.map((f) => (
          <span
            key={f}
            className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12.5px] text-ink-soft"
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
