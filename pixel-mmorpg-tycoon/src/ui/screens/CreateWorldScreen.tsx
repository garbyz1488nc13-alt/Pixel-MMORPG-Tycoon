import type { StartMode } from '@/models/world';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t, t as tr } from '@/i18n';
import { randomSeed } from '@/core/random';
import { getTerrain, TERRAINS } from '@/data/terrain';
import { DIFFICULTIES, MAP_SIZES, MAX_MAP_SIZE, MIN_MAP_SIZE, WORLD_TYPES, type Difficulty, type WorldType } from '@/data/worldPresets';
import { gridToCanvas } from '@/game/textures/mapImage';
import type { TileGrid } from '@/models/TileGrid';
import { createAndOpenWorld } from '@/session/sessionActions';
import { STARTING_FUNDS, EMPTY_START_FUNDS_MULT } from '@/data/studio';
import type { GameMode } from '@/models/sim';
import { generateTerrain } from '@/systems/generation/WorldGenerator';
import { useSessionStore } from '@/stores/sessionStore';
import { toast } from '@/stores/toastStore';
import { PixelIcon } from '../components/PixelIcon';
import { ScreenFrame } from './ScreenFrame';

const STARTING_GOLD: Record<Difficulty, number> = { relaxed: 25000, normal: 10000, hard: 5000, brutal: 2000 };
const NAMES = ['Eldoria', 'Mythgard', 'Ravenreach', 'Stormhollow', 'Aetheria', 'Duskmire', 'Frostvale', 'Emberfall', 'Silverglen', 'Thornwick'];

export function CreateWorldScreen() {
  const go = useSessionStore((s) => s.go);
  const [name, setName] = useState(() => NAMES[Math.floor(Math.random() * NAMES.length)] + ' Online');
  const [sizeKey, setSizeKey] = useState('small');
  const [customW, setCustomW] = useState(128);
  const [customH, setCustomH] = useState(128);
  const [worldType, setWorldType] = useState<WorldType>('continent');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [startingGold, setStartingGold] = useState(STARTING_GOLD.normal);
  const [npcs, setNpcs] = useState(20);
  const [players, setPlayers] = useState(50);
  const [seed, setSeed] = useState(randomSeed);
  const [creating, setCreating] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('standard');
  const [startMode, setStartMode] = useState<StartMode>('ready');
  const [preview, setPreview] = useState<TileGrid | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { width, height } = useMemo(() => {
    if (sizeKey === 'custom') {
      const clamp = (v: number) => Math.max(MIN_MAP_SIZE, Math.min(MAX_MAP_SIZE, Math.round(v) || MIN_MAP_SIZE));
      return { width: clamp(customW), height: clamp(customH) };
    }
    const p = MAP_SIZES.find((s) => s.key === sizeKey)!;
    return { width: p.width, height: p.height };
  }, [sizeKey, customW, customH]);

  // Regenerate the real map (debounced) whenever its inputs change: the preview IS the world.
  useEffect(() => {
    const t = setTimeout(() => setPreview(generateTerrain(width, height, worldType, seed)), 150);
    return () => clearTimeout(t);
  }, [width, height, worldType, seed]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !preview) return;
    const src = gridToCanvas(preview);
    c.width = preview.width;
    c.height = preview.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
  }, [preview]);

  const composition = useMemo(() => {
    if (!preview) return [];
    const counts = preview.countByTerrain();
    const total = preview.tiles.length;
    return counts.map((c, id) => ({ id, pct: (c / total) * 100 })).filter((c) => c.pct > 0.5).sort((a, b) => b.pct - a.pct);
  }, [preview]);

  const onDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    setStartingGold(STARTING_GOLD[d]);
  };

  const create = async () => {
    if (!name.trim()) return toast(t('Please enter a world name.'), 'error');
    setCreating(true);
    try {
      await createAndOpenWorld(
        { name, width, height, worldType, difficulty, seed, startingGold, initialNpcCount: npcs, initialPlayerCount: players, gameMode, startMode },
        preview && preview.width === width && preview.height === height ? preview : undefined,
      );
    } catch (e) {
      toast(t('Failed to create world: {msg}', { msg: (e as Error).message }), 'error');
      setCreating(false);
    }
  };

  return (
    <ScreenFrame title={t('Create New World')} onBack={() => go('menu')}>
      <div className="create-grid">
        <div className="create-form">
          <div className="field">
            <label>{t('Game mode')}</label>
            <div className="mode-cards">
              <button className={`mode-card ${gameMode === 'standard' ? 'active' : ''}`} onClick={() => setGameMode('standard')}>
                <b className="pixel-title">{t('Standard game')}</b>
                <span>{t('Run a real studio: building costs money, servers have limits, players pay subscriptions. Grow carefully.')}</span>
                <span className="hint">{t('Starting funds')}: ${(STARTING_FUNDS[difficulty] * (startMode === 'empty' ? EMPTY_START_FUNDS_MULT : 1)).toLocaleString()}</span>
              </button>
              <button className={`mode-card ${gameMode === 'sandbox' ? 'active' : ''}`} onClick={() => setGameMode('sandbox')}>
                <b className="pixel-title">{t('Sandbox')}</b>
                <span>{t('Everything is free and unlimited. Build whatever you like and watch players react.')}</span>
              </button>
            </div>
          </div>
          <div className="field">
            <label>{t('Start')}</label>
            <div className="mode-cards">
              <button className={`mode-card ${startMode === 'ready' ? 'active' : ''}`} onClick={() => setStartMode('ready')}>
                <b className="pixel-title">{t('Ready world')}</b>
                <span>{t('A starter settlement with NPCs, monsters and quests. Players log in right away.')}</span>
              </button>
              <button className={`mode-card ${startMode === 'empty' ? 'active' : ''}`} onClick={() => setStartMode('empty')}>
                <b className="pixel-title">{t('Empty world')}</b>
                <span>{t('Only the land. Build every house, NPC and monster yourself. Servers open when you place the first spawn point.')}</span>
                {gameMode === 'standard' && <span className="hint">{t('Starting funds')}: ${(STARTING_FUNDS[difficulty] * EMPTY_START_FUNDS_MULT).toLocaleString()} (×{EMPTY_START_FUNDS_MULT})</span>}
              </button>
            </div>
          </div>
          <div className="field">
            <label>{t('World name')}</label>
            <input className="input" value={name} maxLength={48} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field">
            <label>{t('Map size')}</label>
            <div className="chip-row">
              {MAP_SIZES.map((s) => (
                <button key={s.key} className={`btn small ${sizeKey === s.key ? 'active' : ''}`} onClick={() => setSizeKey(s.key)}>{t(s.label)} ({s.width}×{s.height})</button>
              ))}
              <button className={`btn small ${sizeKey === 'custom' ? 'active' : ''}`} onClick={() => setSizeKey('custom')}>{t('Custom')}</button>
            </div>
            {sizeKey === 'custom' && (
              <div className="row">
                <input className="input" type="number" min={MIN_MAP_SIZE} max={MAX_MAP_SIZE} value={customW} onChange={(e) => setCustomW(+e.target.value)} style={{ width: 90 }} />
                ×
                <input className="input" type="number" min={MIN_MAP_SIZE} max={MAX_MAP_SIZE} value={customH} onChange={(e) => setCustomH(+e.target.value)} style={{ width: 90 }} />
                <span className="hint">{t('{min}–{max} tiles', { min: MIN_MAP_SIZE, max: MAX_MAP_SIZE })}</span>
              </div>
            )}
          </div>

          <div className="field">
            <label>{t('World type')}</label>
            <div className="type-grid">
              {WORLD_TYPES.map((t) => (
                <button key={t.key} className={`btn type-card ${worldType === t.key ? 'active' : ''}`} onClick={() => setWorldType(t.key)} title={tr(t.description)}>
                  {tr(t.label)}
                </button>
              ))}
            </div>
            <span className="hint">{tr(WORLD_TYPES.find((w) => w.key === worldType)?.description ?? '')}</span>
          </div>

          <div className="field">
            <label>{t('Difficulty')}</label>
            <div className="chip-row">
              {DIFFICULTIES.map((d) => (
                <button key={d.key} className={`btn small ${difficulty === d.key ? 'active' : ''}`} onClick={() => onDifficulty(d.key)} title={t(d.description)}>{t(d.label)}</button>
              ))}
            </div>
          </div>

          <div className="two-col">
            <div className="field">
              <label>{t('Starting gold (treasury)')}</label>
              <input className="input" type="number" min={0} step={500} value={startingGold} onChange={(e) => setStartingGold(Math.max(0, +e.target.value))} />
            </div>
            <div className="field">
              <label>{t('Seed')}</label>
              <div className="row">
                <input className="input grow" type="number" value={seed} onChange={(e) => setSeed(Math.abs(Math.floor(+e.target.value)) || 0)} />
                <button className="btn icon" title={t('Random seed')} onClick={() => setSeed(randomSeed())}><PixelIcon name="dice" /></button>
              </div>
            </div>
          </div>

          <div className="two-col">
            <div className="field">
              <label>{t('Initial NPCs')}: <b>{npcs}</b></label>
              <input type="range" min={0} max={200} value={npcs} disabled={startMode === 'empty'} onChange={(e) => setNpcs(+e.target.value)} />
            </div>
            <div className="field">
              <label>{t('Initial simulated players')}: <b>{players}</b></label>
              <input type="range" min={0} max={1000} step={10} value={players} onChange={(e) => setPlayers(+e.target.value)} />
            </div>
          </div>
          <div className="hint">
            {t('The NPCs live in a generated starter settlement. Simulated players log in as soon as you press Play (limited by server capacity).')}
          </div>
        </div>

        <div className="create-preview">
          <div className="preview-frame">
            <canvas ref={canvasRef} className="preview-canvas" />
          </div>
          <div className="hint center">{t('{w} × {h} tiles · seed {seed}', { w: width, h: height, seed })}</div>
          <div className="composition">
            {composition.map((c) => (
              <div key={c.id} className="comp-row">
                <span className="comp-dot" style={{ background: getTerrain(c.id).palette[0] }} />
                <span className="grow">{t(TERRAINS[c.id].name)}</span>
                <span>{c.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <button className="btn big primary" disabled={creating || !preview} onClick={create}>
            {creating ? t('Creating…') : t('Create World')}
          </button>
        </div>
      </div>
    </ScreenFrame>
  );
}
