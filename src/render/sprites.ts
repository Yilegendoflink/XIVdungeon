import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { TILE_SIZE } from '@/config';
import type { EnemyState, ItemState } from '@/game/state';

const ENEMY_COLOR: Record<EnemyState['type'], number> = {
  bomb: 0xff6600,
  cactuar: 0x66cc33,
  morbol: 0x8b5cf6,
};

const ENEMY_LETTER: Record<EnemyState['type'], string> = {
  bomb: '炸',
  cactuar: '仙',
  morbol: '魔',
};

const ITEM_COLOR: Record<ItemState['type'], number> = {
  hiPotion: 0xff4444,
  scrollOfMight: 0xaaccff,
  gridanianRation: 0xd4a017,
};

export function drawHero(parent: Container, x: number, y: number, texture: Texture | null = null): void {
  if (texture) {
    const sprite = new Sprite(texture);
    sprite.width = TILE_SIZE;
    sprite.height = TILE_SIZE;
    sprite.position.set(x * TILE_SIZE, y * TILE_SIZE);
    parent.addChild(sprite);
    return;
  }

  const g = new Graphics();
  g.rect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2);
  g.fill(0xe74c3c);
  g.position.set(x * TILE_SIZE, y * TILE_SIZE);
  parent.addChild(g);
}

export function drawEnemy(parent: Container, enemy: EnemyState): void {
  const g = new Graphics();
  g.rect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
  g.fill(ENEMY_COLOR[enemy.type]);
  g.position.set(enemy.x * TILE_SIZE, enemy.y * TILE_SIZE);
  parent.addChild(g);

  const label = new Text({
    text: ENEMY_LETTER[enemy.type],
    style: { fill: 0xffffff, fontSize: 9, fontWeight: 'bold' },
  });
  label.anchor.set(0.5);
  label.position.set(enemy.x * TILE_SIZE + TILE_SIZE / 2, enemy.y * TILE_SIZE + TILE_SIZE / 2);
  parent.addChild(label);
}

export function drawItem(parent: Container, item: ItemState): void {
  if (item.x === undefined || item.y === undefined) return;
  const g = new Graphics();
  g.circle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE * 0.22);
  g.fill(ITEM_COLOR[item.type]);
  g.position.set(item.x * TILE_SIZE, item.y * TILE_SIZE);
  parent.addChild(g);
}
