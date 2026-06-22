interface PageHeaderProps {
  eyebrow: string;
  title: string;
  sub: string;
  action?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, sub, action }: PageHeaderProps) {
  return (
    <header className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-[2px] text-terra">
          {eyebrow}
        </div>
        {action && <div>{action}</div>}
      </div>
      <h1 className="font-serif text-[30px] font-semibold leading-tight tracking-wide">
        {title}
      </h1>
      <p className="mt-1.5 text-[14px] text-muted">{sub}</p>
    </header>
  );
}
