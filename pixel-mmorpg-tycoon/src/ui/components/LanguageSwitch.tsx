import { LANGUAGES } from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';

/** EN / УКР toggle. */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const lang = useSettingsStore((s) => s.language);
  const update = useSettingsStore((s) => s.update);
  return (
    <div className="chip-row lang-switch" role="group" aria-label="Language / Мова">
      {LANGUAGES.map((l) => (
        <button key={l.key} className={`btn small ${lang === l.key ? 'active' : ''}`} onClick={() => update({ language: l.key })} title={l.label}>
          {compact ? (l.key === 'uk' ? 'УКР' : 'EN') : l.label}
        </button>
      ))}
    </div>
  );
}
