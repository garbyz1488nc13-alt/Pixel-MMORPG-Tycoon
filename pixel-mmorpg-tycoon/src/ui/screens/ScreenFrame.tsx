import type { ReactNode } from 'react';
import { PixelIcon } from '../components/PixelIcon';

/** Common framed panel for menu sub-screens. */
export function ScreenFrame({ title, onBack, children, actions }: { title: string; onBack: () => void; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="screen-wrap">
      <div className="panel screen-panel">
        <div className="panel-header">
          <span>{title}</span>
          <div className="row">
            {actions}
            <button className="btn small" onClick={onBack}><PixelIcon name="close" size={12} /> Back</button>
          </div>
        </div>
        <div className="screen-body scroll">{children}</div>
      </div>
    </div>
  );
}
