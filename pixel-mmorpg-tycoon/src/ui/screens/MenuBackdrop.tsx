import { useEffect, useRef } from 'react';
import { randomSeed } from '@/core/random';
import { generateTerrain } from '@/systems/generation/WorldGenerator';
import { renderGridTiles } from '../components/TilePreview';

/** Slowly panning procedurally generated world behind the menus. */
export function MenuBackdrop() {
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const grid = generateTerrain(120, 80, 'continent', randomSeed());
    const canvas = renderGridTiles(grid, 32);
    canvas.className = 'menu-backdrop-canvas';
    holder.current?.appendChild(canvas);
    return () => canvas.remove();
  }, []);
  return (
    <div className="menu-backdrop" ref={holder}>
      <div className="menu-vignette" />
    </div>
  );
}
