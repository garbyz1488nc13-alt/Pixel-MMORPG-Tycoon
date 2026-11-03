import { useSessionStore } from '@/stores/sessionStore';
import { t } from '@/i18n';
import { SettingsForm } from '../components/SettingsForm';
import { ScreenFrame } from './ScreenFrame';

export function SettingsScreen() {
  const go = useSessionStore((s) => s.go);
  return (
    <ScreenFrame title={t('Settings')} onBack={() => go('menu')}>
      <SettingsForm showDanger />
      <div className="controls-help">
        <h3 className="pixel-title">{t('Controls')}</h3>
        <table>
          <tbody>
            <tr><td>WASD / Arrows</td><td>{t('Pan camera (Shift = faster)')}</td></tr>
            <tr><td>{t('Right / Middle drag, Space + drag')}</td><td>{t('Pan camera')}</td></tr>
            <tr><td>{t('Mouse wheel, + / −')}</td><td>{t('Zoom in / out')}</td></tr>
            <tr><td>Home</td><td>{t('Fit map to screen')}</td></tr>
            <tr><td>B / F / R / I</td><td>{t('Brush / Fill / Rectangle / Picker')}</td></tr>
            <tr><td>1 – 8</td><td>{t('Select terrain')}</td></tr>
            <tr><td>[ / ]</td><td>{t('Brush size')}</td></tr>
            <tr><td>Ctrl+Z / Ctrl+Y</td><td>{t('Undo / Redo')}</td></tr>
            <tr><td>Ctrl+S</td><td>{t('Save')}</td></tr>
            <tr><td>P</td><td>{t('Play / Pause simulation')}</td></tr>
            <tr><td>V / E</td><td>{t('Select / Erase objects')}</td></tr>
            <tr><td>Del, Ctrl+C / Ctrl+V / Ctrl+D</td><td>{t('Delete, copy, paste, duplicate selection')}</td></tr>
            <tr><td>G</td><td>{t('Toggle grid')}</td></tr>
          </tbody>
        </table>
      </div>
    </ScreenFrame>
  );
}
