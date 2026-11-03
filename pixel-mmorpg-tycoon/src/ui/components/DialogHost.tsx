import { useEffect, useState } from 'react';
import { useDialogStore } from '@/stores/dialogStore';
import { Modal } from './Modal';

/** Renders confirm/prompt dialogs requested via confirmDialog()/promptDialog(). */
export function DialogHost() {
  const current = useDialogStore((s) => s.current);
  const close = useDialogStore((s) => s.close);
  const [value, setValue] = useState('');

  useEffect(() => setValue(current?.defaultValue ?? ''), [current]);
  if (!current) return null;

  const finish = (v: string | boolean | null) => {
    current.resolve(v);
    close();
  };
  const ok = () => finish(current.kind === 'prompt' ? value.trim() || null : true);

  return (
    <Modal
      title={current.title}
      onClose={() => finish(current.kind === 'prompt' ? null : false)}
      actions={
        <>
          <button className="btn" onClick={() => finish(current.kind === 'prompt' ? null : false)}>Cancel</button>
          <button className={`btn ${current.danger ? 'danger' : 'primary'}`} onClick={ok}>{current.confirmLabel ?? 'OK'}</button>
        </>
      }
    >
      {current.message && <div style={{ whiteSpace: 'pre-line' }}>{current.message}</div>}
      {current.kind === 'prompt' && (
        <input className="input" autoFocus value={value} maxLength={48} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ok()} />
      )}
    </Modal>
  );
}
