import { useSessionStore } from '@/stores/sessionStore';
import { SettingsForm } from '../components/SettingsForm';
import { ScreenFrame } from './ScreenFrame';

export function SettingsScreen() {
  const go = useSessionStore((s) => s.go);
  return (
    <ScreenFrame title="Settings" onBack={() => go('menu')}>
      <SettingsForm showDanger />
      <div className="controls-help">
        <h3 className="pixel-title">Controls</h3>
        <table>
          <tbody>
            <tr><td>WASD / Arrows</td><td>Pan camera (Shift = faster)</td></tr>
            <tr><td>Right / Middle drag, Space + drag</td><td>Pan camera</td></tr>
            <tr><td>Mouse wheel, + / −</td><td>Zoom in / out</td></tr>
            <tr><td>Home</td><td>Fit map to screen</td></tr>
            <tr><td>B / F / R / I</td><td>Brush / Fill / Rectangle / Picker</td></tr>
            <tr><td>1 – 8</td><td>Select terrain</td></tr>
            <tr><td>[ / ]</td><td>Brush size</td></tr>
            <tr><td>Ctrl+Z / Ctrl+Y</td><td>Undo / Redo</td></tr>
            <tr><td>Ctrl+S</td><td>Save</td></tr>
            <tr><td>P</td><td>Play / Pause simulation</td></tr>
            <tr><td>G</td><td>Toggle grid</td></tr>
          </tbody>
        </table>
      </div>
    </ScreenFrame>
  );
}
