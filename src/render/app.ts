import { Application, Assets, Container, Graphics, Text, type Texture } from 'pixi.js';
import { DEFAULT_PLAYER_JOB, MAP_H, MAP_W, playerTexturePath, RENDER_SCALE, TILE_SIZE } from '@/config';
import type { DamageEvent, GameState } from '@/game/state';
import { idx } from '@/game/state';
import { drawTile } from '@/render/tiles';
import { drawEnemy, drawHero, drawItem } from '@/render/sprites';

interface ActiveDamageNumber {
  text: Text;
  x: number;
  y: number;
  elapsed: number;
}

export class GameRenderer {
  app = new Application();
  private world = new Container();
  private tiles = new Container();
  private entities = new Container();
  private effects = new Container();
  private playerTexture: Texture | null = null;
  private playerTextureJob: string | null = null;
  private activeDamageNumbers: ActiveDamageNumber[] = [];
  private seenDamageEventIds = new Set<string>();

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
    this.world.addChild(this.effects);
    this.app.stage.addChild(this.world);
    this.app.ticker.add((ticker) => this.updateDamageNumbers(ticker.deltaMS));
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

    for (const event of state.damageEvents) {
      if (this.seenDamageEventIds.has(event.id)) continue;
      this.seenDamageEventIds.add(event.id);
      this.addDamageNumber(event);
    }
  }

  private addDamageNumber(event: DamageEvent): void {
    const text = new Text({
      text: `-${event.amount}`,
      style: {
        fontFamily: ['Arial', 'Microsoft YaHei', 'Noto Sans', 'sans-serif'],
        fontSize: 14,
        fontWeight: 'bold',
        fill: event.kind === 'dealt' ? 0x70b9ff : 0xff6b6b,
        stroke: { color: 0x101522, width: 3 },
      },
    });
    text.anchor.set(0.5, 1);
    const x = event.x * TILE_SIZE + TILE_SIZE / 2;
    const y = event.y * TILE_SIZE - 2;
    text.position.set(x, y);
    this.effects.addChild(text);
    this.activeDamageNumbers.push({ text, x, y, elapsed: 0 });
  }

  private updateDamageNumbers(deltaMs: number): void {
    const duration = 780;
    const fadeIn = 150;
    const fadeOutStart = 430;
    for (let i = this.activeDamageNumbers.length - 1; i >= 0; i--) {
      const item = this.activeDamageNumbers[i];
      item.elapsed += deltaMs;
      const progress = Math.min(1, item.elapsed / duration);
      item.text.y = item.y - progress * 12;
      item.text.alpha = item.elapsed < fadeIn
        ? item.elapsed / fadeIn
        : item.elapsed > fadeOutStart
          ? Math.max(0, 1 - (item.elapsed - fadeOutStart) / (duration - fadeOutStart))
          : 1;

      if (item.elapsed >= duration) {
        item.text.destroy();
        this.activeDamageNumbers.splice(i, 1);
      }
    }
  }
}
