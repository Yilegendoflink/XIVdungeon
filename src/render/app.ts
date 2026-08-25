import { Application, Assets, Container, Graphics, type Texture } from 'pixi.js';
import { DEFAULT_PLAYER_JOB, MAP_H, MAP_W, playerTexturePath, RENDER_SCALE, TILE_SIZE } from '@/config';
import type { GameState } from '@/game/state';
import { idx } from '@/game/state';
import { drawTile } from '@/render/tiles';
import { drawEnemy, drawHero, drawItem } from '@/render/sprites';

export class GameRenderer {
  app = new Application();
  private world = new Container();
  private tiles = new Container();
  private entities = new Container();
  private playerTexture: Texture | null = null;
  private playerTextureJob: string | null = null;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    const w = MAP_W * TILE_SIZE * RENDER_SCALE;
    const h = MAP_H * TILE_SIZE * RENDER_SCALE;

    await this.app.init({
      canvas,
      width: w,
      height: h,
      backgroundColor: 0x0a0a1a,
      resolution: 1,
      autoDensity: true,
    });

    await this.setPlayerJobTexture();

    this.app.stage.scale.set(RENDER_SCALE);
    this.world.addChild(this.tiles);
    this.world.addChild(this.entities);
    this.app.stage.addChild(this.world);
  }

  async setPlayerJobTexture(job = DEFAULT_PLAYER_JOB): Promise<void> {
    if (this.playerTextureJob === job) return;
    this.playerTextureJob = job;
    try {
      this.playerTexture = await Assets.load(playerTexturePath(job));
    } catch {
      this.playerTexture = null;
      console.warn(`未找到玩家图片素材，请将文件放置于 ${playerTexturePath(job)}`);
    }
  }

  render(state: GameState): void {
    this.tiles.removeChildren().forEach((c) => c.destroy());
    this.entities.removeChildren().forEach((c) => c.destroy());

    const { floor } = state;
    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        const i = idx(x, y, floor.width);
        const vis = floor.visibility[i];
        if (vis === 'unseen') continue;

        const g = new Graphics();
        const kind = floor.tiles[i];
        drawTile(g, kind, vis, kind === 'exit' && !floor.exitUnlocked);
        g.position.set(x * TILE_SIZE, y * TILE_SIZE);
        this.tiles.addChild(g);
      }
    }

    for (const item of floor.items) {
      if (item.x === undefined || item.y === undefined) continue;
      if (floor.visibility[idx(item.x, item.y, floor.width)] !== 'visible') continue;
      drawItem(this.entities, item);
    }

    for (const enemy of floor.enemies) {
      if (floor.visibility[idx(enemy.x, enemy.y, floor.width)] !== 'visible') continue;
      drawEnemy(this.entities, enemy);
    }

    drawHero(this.entities, state.hero.x, state.hero.y, this.playerTexture);
  }
}
