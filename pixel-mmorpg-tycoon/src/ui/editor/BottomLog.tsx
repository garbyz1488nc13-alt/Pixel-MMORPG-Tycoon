import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@/i18n';
import { formatGameTime } from '@/simulation/time';
import { useLogStore, type LogChannel } from '@/stores/logStore';

const FILTERS: { key: LogChannel | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'event', label: 'Events' },
  { key: 'sim', label: 'Simulation' },
  { key: 'system', label: 'System' },
];

export function BottomLog() {
  const entries = useLogStore((s) => s.entries);
  const clear = useLogStore((s) => s.clear);
  const [filter, setFilter] = useState<LogChannel | 'all'>('all');
  const listRef = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => (filter === 'all' ? entries : entries.filter((e) => e.channel === filter)), [entries, filter]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length]);

  return (
    <div className="bottom-log panel">
      <div className="log-tabs">
        {FILTERS.map((f) => (
          <button key={f.key} className={`tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {t(f.label)}
            <span className="count">{f.key === 'all' ? entries.length : entries.filter((e) => e.channel === f.key).length}</span>
          </button>
        ))}
        <div className="grow" />
        <button className="btn small" onClick={clear}>{t('Clear')}</button>
      </div>
      <div className="log-list scroll" ref={listRef}>
        {shown.length === 0 && <div className="hint">{t('No messages.')}</div>}
        {shown.map((e) => (
          <div key={e.id} className={`log-row ${e.level}`}>
            <span className="log-time">{e.gameMinutes !== undefined ? formatGameTime(e.gameMinutes) : new Date(e.at).toLocaleTimeString()}</span>
            <span className={`log-chan ${e.channel}`}>{e.channel === 'sim' ? t('SIM') : e.channel === 'event' ? t('EVENT') : t('SYS')}</span>
            <span className="log-text">{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
