import { Application, Assets, Container, Graphics, Text, type Texture } from 'pixi.js';
import { DEFAULT_PLAYER_JOB, MAP_H, MAP_W, playerTexturePath, RENDER_SCALE, TILE_SIZE } from '@/config';
import type { DamageEvent, GameState } from '@/game/state';
import { idx, isPassable } from '@/game/state';
import { drawTile } from '@/render/tiles';
import { drawEnemy, drawHero, drawItem } from '@/render/sprites';

interface ActiveDamageNumber {
  text: Text;
  x: number;
  y: number;
  elapsed: number;
}

interface ActiveJump {
  hero: Container;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  elapsed: number;
  onComplete: () => void;
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
  private activeJump: ActiveJump | null = null;
  private seenDamageEventIds = new Set<string>();
  private canvas: HTMLCanvasElement | null = null;
  private lastState: GameState | null = null;
  private cameraX = 0;
  private cameraY = 0;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;
    const w = Math.max(1, canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, canvas.clientHeight || window.innerHeight);

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
    this.app.ticker.add((ticker) => this.updateEffects(ticker.deltaMS));
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
    this.lastState = state;
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

    if (!this.activeJump) drawHero(this.entities, state.hero.x, state.hero.y, this.playerTexture);

    for (const event of state.damageEvents) {
      if (this.seenDamageEventIds.has(event.id)) continue;
      this.seenDamageEventIds.add(event.id);
      this.addDamageNumber(event);
    }

    this.updateCamera(state);
  }

  resize(): void {
    if (!this.canvas || !this.app.renderer) return;
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.app.renderer.resize(width, height);
    if (this.lastState) this.updateCamera(this.lastState);
  }

  getCameraOffset(): { x: number; y: number } {
    return { x: this.cameraX, y: this.cameraY };
  }

  setJumpTargeting(active: boolean, state: GameState): void {
    this.tiles.removeChildren().forEach((child) => child.destroy());
    this.render(state);
    if (!active) return;
    const enemies = new Set(state.floor.enemies.map((enemy) => `${enemy.x},${enemy.y}`));
    const items = new Set(state.floor.items.map((item) => `${item.x},${item.y}`));
    for (let y = 0; y < state.floor.height; y += 1) {
      for (let x = 0; x < state.floor.width; x += 1) {
        const distance = Math.max(Math.abs(state.hero.x - x), Math.abs(state.hero.y - y));
        if (
          distance === 0 ||
          distance > 8 ||
          state.floor.visibility[idx(x, y, state.floor.width)] !== 'visible' ||
          !isPassable(state.floor, x, y) ||
          items.has(`${x},${y}`)
        ) continue;
        const marker = new Graphics();
        marker.rect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2);
        marker.fill({ color: enemies.has(`${x},${y}`) ? 0xff8c5a : 0x70b9ff, alpha: 0.28 });
        marker.position.set(x * TILE_SIZE, y * TILE_SIZE);
        this.tiles.addChild(marker);
      }
    }
  }

  playJump(from: { x: number; y: number }, to: { x: number; y: number }, onComplete: () => void): void {
    if (this.activeJump) return;
    const hero = new Container();
    drawHero(hero, 0, 0, this.playerTexture);
    hero.position.set(from.x * TILE_SIZE, from.y * TILE_SIZE);
    this.effects.addChild(hero);
    this.activeJump = {
      hero,
      fromX: hero.x,
      fromY: hero.y,
      toX: to.x * TILE_SIZE,
      toY: to.y * TILE_SIZE,
      elapsed: 0,
      onComplete,
    };
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

  private updateEffects(deltaMs: number): void {
    this.updateDamageNumbers(deltaMs);
    if (!this.activeJump) return;
    const duration = 380;
    const jump = this.activeJump;
    jump.elapsed += deltaMs;
    const progress = Math.min(1, jump.elapsed / duration);
    jump.hero.x = jump.fromX + (jump.toX - jump.fromX) * progress;
    jump.hero.y = jump.fromY + (jump.toY - jump.fromY) * progress - Math.sin(progress * Math.PI) * TILE_SIZE * 1.5;
    if (progress < 1) return;
    jump.hero.destroy();
    this.activeJump = null;
    jump.onComplete();
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

  private updateCamera(state: GameState): void {
    const viewportWidth = this.app.renderer.width / RENDER_SCALE;
    const viewportHeight = this.app.renderer.height / RENDER_SCALE;
    const worldWidth = MAP_W * TILE_SIZE;
    const worldHeight = MAP_H * TILE_SIZE;
    const heroCenterX = state.hero.x * TILE_SIZE + TILE_SIZE / 2;
    const heroCenterY = state.hero.y * TILE_SIZE + TILE_SIZE / 2;

    this.cameraX = viewportWidth >= worldWidth
      ? (viewportWidth - worldWidth) / 2
      : Math.max(viewportWidth - worldWidth, Math.min(0, viewportWidth / 2 - heroCenterX));
    this.cameraY = viewportHeight >= worldHeight
      ? (viewportHeight - worldHeight) / 2
      : Math.max(viewportHeight - worldHeight, Math.min(0, viewportHeight / 2 - heroCenterY));
    this.world.position.set(this.cameraX, this.cameraY);
  }
}
