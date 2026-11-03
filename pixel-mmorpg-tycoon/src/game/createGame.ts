import Phaser from 'phaser';
import type { GameSession } from '@/session/GameSession';
import { WorldScene } from './scenes/WorldScene';

/** Create the Phaser game inside `parent`, rendering the given session. */
export function createGame(parent: HTMLElement, session: GameSession): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0d0b14',
    pixelArt: true,
    roundPixels: false,
    antialias: false,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    input: { keyboard: false, mouse: { preventDefaultWheel: true } },
    disableContextMenu: true,
    banner: false,
    fps: { target: 60 },
    scene: [],
  });
  game.scene.add('WorldScene', WorldScene, true, { session });
  return game;
}
