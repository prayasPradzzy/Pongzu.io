import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';

export const ARENA_WIDTH = PONG_CONFIG.arena.width;
export const ARENA_HEIGHT = PONG_CONFIG.arena.height;

/**
 * How many canvas pixels back each logical pixel. The canvas is rendered at
 * up to 2× and the camera zoomed to match, so text and shapes stay sharp on
 * high-density phone screens instead of being stretched up from 600×1000.
 */
export function pickRenderScale(): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(2, Math.max(1, Math.round(dpr)));
}

/** Zooms the camera so scene code can always work in 600×1000 logical pixels. */
export function setupSharpCamera(scene: Phaser.Scene) {
  const scale: number = scene.registry.get('renderScale') ?? 1;
  const camera = scene.cameras.main;
  camera.setZoom(scale);
  camera.centerOn(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);

  // Text is rasterised separately from the camera, so give every text object
  // the same resolution as the canvas when it is created.
  if (scale > 1) {
    const sharpen = (gameObject: Phaser.GameObjects.GameObject) => {
      if (gameObject instanceof Phaser.GameObjects.Text) gameObject.setResolution(scale);
    };
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, sharpen);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, sharpen));
  }
}

/** Pointer position in logical arena coordinates. */
export function pointerToArena(scene: Phaser.Scene, pointer: Phaser.Input.Pointer): { x: number; y: number } {
  const point = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
  return { x: point.x, y: point.y };
}
