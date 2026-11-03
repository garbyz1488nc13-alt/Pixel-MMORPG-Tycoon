import { useEffect, type ReactNode } from 'react';

export function Modal({ title, children, actions, onClose, width }: { title: string; children: ReactNode; actions?: ReactNode; onClose?: () => void; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="panel modal" style={width ? { width } : undefined} role="dialog" aria-label={title}>
        <div className="panel-header">{title}</div>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
