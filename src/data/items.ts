import type { ItemType } from '@/game/state';

export interface ItemDef {
  type: ItemType;
  label: string;
}

export const ITEM_DEFS: Record<ItemType, ItemDef> = {
  hiPotion: { type: 'hiPotion', label: '高级恢复药' },
  scrollOfMight: { type: 'scrollOfMight', label: '力量卷轴' },
  gridanianRation: { type: 'gridanianRation', label: '格里达尼亚干粮' },
};

export const ITEM_TYPES: ItemType[] = ['hiPotion', 'scrollOfMight', 'gridanianRation'];
