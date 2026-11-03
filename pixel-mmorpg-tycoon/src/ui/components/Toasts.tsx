import { useToastStore } from '@/stores/toastStore';

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
      ))}
    </div>
  );
}
