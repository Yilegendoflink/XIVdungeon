/** 地图与渲染常量 */
export const MAP_W = 32;
export const MAP_H = 32;
export const TILE_SIZE = 16;
export const RENDER_SCALE = 2;
export const VIEW_RADIUS = 6;
export const NORMAL_FLOOR_COUNT = 5;
export const BOSS_FLOOR_NUMBER = NORMAL_FLOOR_COUNT + 1;

export const INVENTORY_SIZE = 10;
export const MAX_ACTIVE_SKILLS = 5;
export const MAX_LEVEL = 30;
export const SAVE_VERSION = 12;
export const SAVE_KEY = 'xiv-dungeon-save';
export const DEFAULT_PLAYER_JOB = 'dragoon';
export const PLAYER_ASSET_DIR = `${import.meta.env.BASE_URL}assets/player/`;

export function playerTexturePath(job = DEFAULT_PLAYER_JOB): string {
  return `${PLAYER_ASSET_DIR}${job}.png`;
}

export function skillIconPath(skillId: string): string {
  return `${import.meta.env.BASE_URL}assets/skills/${skillId}.png`;
}

export type TileKind = 'wall' | 'floor' | 'entrance' | 'exit';
export type VisibilityKind = 'unseen' | 'explored' | 'visible';
