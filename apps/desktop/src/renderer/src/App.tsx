import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import type { AppInfo } from '@jarvis/contracts';
import { DashboardCard } from './components/DashboardCard.js';
import { Orb } from './components/Orb.js';
import { StatusModule } from './components/StatusModule.js';
import './styles/dashboard.css';

interface ActivityItem {
  title: string;
  detail: string;
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning, William';
  if (hour < 18) return 'Good afternoon, William';
  return 'Good evening, William';
}

export function App(): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;

    const bridge = window.jarvis;
    if (bridge === undefined) {
      setError('The preload bridge did not load. window.jarvis is undefined.');
      return;
    }

    bridge
      .getAppInfo()
      .then((result) => {
        if (!cancelled) setInfo(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });

    const timer = window.setInterval(() => {
      setClock(new Date());
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const activity = useMemo<ActivityItem[]>(
    () => [
      { title: 'System sync', detail: 'Core telemetry nominal' },
      { title: 'Forge review', detail: 'Approval queue refreshed' },
      { title: 'Memory sweep', detail: 'Background indexing complete' },
    ],
    [],
  );

  const events = useMemo<ActivityItem[]>(
    () => [
      { title: 'Security posture', detail: 'AEGIS tier remains stable' },
      { title: 'Network uplink', detail: 'High-bandwidth link active' },
      { title: 'Thermals', detail: 'Cooling profile balanced' },
    ],
    [],
  );

  const notifications = useMemo<ActivityItem[]>(
    () => [
      { title: 'Voice ready', detail: 'Listening state primed' },
      { title: 'Drive Mode', detail: 'Ready for silent operation' },
      { title: 'Inbox', detail: 'No critical alerts' },
    ],
    [],
  );

  return (
    <main className="dashboard-shell">
      <header className="panel topbar">
        <div>
          <div className="status-pill">
            <span className="led" />
            <span>Secure connection</span>
          </div>
          <h1>Jarvis</h1>
          <p className="subtitle">{formatGreeting(clock)}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="panel-title">Current time</div>
          <div style={{ fontSize: '1.4rem', color: '#f3f7ff', fontWeight: 600 }}>
            {formatTime(clock)}
          </div>
          <div style={{ color: '#7d91b9', marginTop: 6 }}>
            {info ? `${info.platform.toUpperCase()} · ${info.arch}` : 'Syncing runtime'}
          </div>
        </div>
      </header>

      <aside className="panel left-panel">
        <div className="panel-title">System status</div>
        <div className="metric-list">
          {[
            ['CPU', '88%'],
            ['RAM', '74%'],
            ['GPU', '63%'],
            ['Disk', '41%'],
            ['Internet', 'Nominal'],
            ['Battery', '92%'],
            ['Temperature', '41°C'],
          ].map(([label, value]) => (
            <div className="metric-row" key={label}>
              <span className="metric-label">{label}</span>
              <span className="metric-value">{value}</span>
            </div>
          ))}
        </div>
      </aside>

      <section className="panel center-panel">
        <Orb />

        <div className="module-grid" style={{ gridColumn: '1 / span 2' }}>
          <div
            className="module-grid"
            style={{
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              display: 'grid',
              gap: '12px',
            }}
          >
            <StatusModule name="Jarvis Core" detail="Primed for orchestration" />
            <StatusModule name="Forge" detail="Build lane synchronized" />
            <StatusModule name="Ledger" detail="Advisory mode active" />
            <StatusModule name="AEGIS" detail="Security watch stable" tone="warning" />
            <StatusModule name="Memory" detail="Context retained" />
            <StatusModule name="Voice" detail="Listening standby" />
            <StatusModule name="Vision" detail="Frame capture idle" />
            <StatusModule name="Drive Mode" detail="Quiet profile ready" tone="danger" />
          </div>
        </div>
      </section>

      <aside className="panel right-panel">
        <DashboardCard title="Recent activity">
          <div className="activity-list">
            {activity.map((item) => (
              <div className="list-item" key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard title="System events">
          <div className="event-list">
            {events.map((item) => (
              <div className="list-item" key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard title="Notifications">
          <div className="notification-list">
            {notifications.map((item) => (
              <div className="list-item" key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </DashboardCard>
      </aside>

      <footer className="panel bottom-bar">
        <div>
          <div className="panel-title">Listening</div>
          <div style={{ color: '#edf7ff', fontWeight: 600 }}>Ambient command path active</div>
        </div>
        <div className="waveform" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index} style={{ height: 10 + ((index % 4) + 1) * 4 }} />
          ))}
        </div>
        <div style={{ color: '#8a95b2', textAlign: 'right' }}>
          {error ? `Bridge error: ${error}` : 'Renderer connected · host info live'}
        </div>
      </footer>
    </main>
  );
}
