import type { JSX } from 'react';

interface StatusModuleProps {
  name: string;
  detail: string;
  tone?: 'safe' | 'warning' | 'danger';
}

export function StatusModule({ name, detail, tone = 'safe' }: StatusModuleProps): JSX.Element {
  return (
    <article className="module-card">
      <div className="module-head">
        <div className="module-name">{name}</div>
        <div
          className={`status-dot ${tone === 'warning' ? 'warning' : tone === 'danger' ? 'danger' : ''}`}
        />
      </div>
      <div className="module-meta">{detail}</div>
    </article>
  );
}
