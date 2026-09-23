export type ShopCategory = 'rod' | 'bobber' | 'bait' | 'hat';
export type BaitId = 'worm' | 'corn' | 'spinner' | 'fly';

export interface ShopItem {
  id: string;
  category: ShopCategory;
  name: string;
  icon: string;
  price: number;
  /** krátká nápověda, co předmět dělá (návnady) */
  hint?: string;
  /** barvy pro kreslení (prut: [spodek, špička]; splávek: [horní, dolní]) */
  colors?: [string, string];
}

export const RODS: ShopItem[] = [
  { id: 'wood', category: 'rod', name: 'Dřevěný', icon: '🪵', price: 0, colors: ['#7a4a22', '#d69a5c'] },
  { id: 'blue', category: 'rod', name: 'Modrý', icon: '💙', price: 10, colors: ['#1565c0', '#7cc8ff'] },
  { id: 'green', category: 'rod', name: 'Zelený', icon: '💚', price: 10, colors: ['#2e7d32', '#9be27a'] },
  { id: 'gold', category: 'rod', name: 'Zlatý', icon: '💛', price: 15, colors: ['#b8860b', '#ffe066'] },
  { id: 'bamboo', category: 'rod', name: 'Bambusový', icon: '🎋', price: 30, colors: ['#8a9a3b', '#e8e2a0'] },
  { id: 'candy', category: 'rod', name: 'Lízátkový', icon: '🍭', price: 45, colors: ['#e91e63', '#ffffff'] },
  { id: 'rainbow', category: 'rod', name: 'Duhový', icon: '🌈', price: 70, colors: ['#ff5252', '#40c4ff'] },
  { id: 'glow', category: 'rod', name: 'Svítící', icon: '✨', price: 90, colors: ['#00e5ff', '#e0ffff'] },
];

export const BOBBERS: ShopItem[] = [
  { id: 'classic', category: 'bobber', name: 'Klasický', icon: '🔴', price: 0, colors: ['#e53935', '#fafafa'] },
  { id: 'green', category: 'bobber', name: 'Zelený', icon: '🟢', price: 10, colors: ['#43a047', '#fafafa'] },
  { id: 'duck', category: 'bobber', name: 'Kachnička', icon: '🦆', price: 25 },
  { id: 'star', category: 'bobber', name: 'Hvězdička', icon: '⭐', price: 30 },
  { id: 'strawberry', category: 'bobber', name: 'Jahoda', icon: '🍓', price: 30 },
  { id: 'ball', category: 'bobber', name: 'Míč', icon: '⚽', price: 35 },
];

export const BAITS: ShopItem[] = [
  { id: 'worm', category: 'bait', name: 'Žížala', icon: '🪱', price: 0, hint: 'Na ni bere skoro každá ryba.' },
  { id: 'corn', category: 'bait', name: 'Kukuřice', icon: '🌽', price: 20, hint: 'Milují ji kapři, amuři, líni a cejni.' },
  { id: 'spinner', category: 'bait', name: 'Třpytka', icon: '✨', price: 40, hint: 'Láká dravce: štiky, okouny, candáty i sumce.' },
  { id: 'fly', category: 'bait', name: 'Muška', icon: '🪰', price: 40, hint: 'Pro pstruhy, lipany a ryby u hladiny.' },
];

export const HATS: ShopItem[] = [
  { id: 'fisher', category: 'hat', name: 'Rybářský klobouk', icon: '👒', price: 0 },
  { id: 'cap', category: 'hat', name: 'Kšiltovka', icon: '🧢', price: 15 },
  { id: 'beanie', category: 'hat', name: 'Kulich', icon: '🧶', price: 20 },
  { id: 'pirate', category: 'hat', name: 'Pirátský', icon: '🏴‍☠️', price: 50 },
  { id: 'crown', category: 'hat', name: 'Koruna', icon: '👑', price: 120 },
];

export const SHOP: Record<ShopCategory, ShopItem[]> = {
  rod: RODS,
  bobber: BOBBERS,
  bait: BAITS,
  hat: HATS,
};

export const SHOP_LABEL: Record<ShopCategory, { name: string; icon: string }> = {
  rod: { name: 'Pruty', icon: '🎣' },
  bobber: { name: 'Splávky', icon: '🔴' },
  bait: { name: 'Návnady', icon: '🪱' },
  hat: { name: 'Klobouky', icon: '👒' },
};

/** id skinů prutu z původní hry (index 0–3) */
export const LEGACY_ROD_IDS = ['wood', 'blue', 'gold', 'green'] as const;

export function findItem(category: ShopCategory, id: string): ShopItem | undefined {
  return SHOP[category].find((i) => i.id === id);
}
