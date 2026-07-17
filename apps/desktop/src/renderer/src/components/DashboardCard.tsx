import type { JSX, ReactNode } from 'react';

interface DashboardCardProps {
  title: string;
  children: ReactNode;
}

export function DashboardCard({ title, children }: DashboardCardProps): JSX.Element {
  return (
    <section className="panel" style={{ padding: '18px 20px' }}>
      <div className="panel-title">{title}</div>
      {children}
    </section>
  );
}
