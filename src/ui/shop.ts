import { h, sfx, toast } from '../kit';
import { SHOP, SHOP_LABEL, type ShopCategory, type ShopItem } from '../data/shop';
import { drawBait, drawBobber, drawFisher, drawRodPreview, type Gear } from '../game/fisher';
import { buyItem, equipItem } from '../game/rewards';
import type { World } from '../game/world';
import type { Save } from '../store/save';
import { fmtNum } from './common';
import { COIN_SVG, coinHTML } from './icons';
import { openSheet, tabButton } from './sheet';

function preview(cat: ShopCategory, item: ShopItem, save: Save): HTMLCanvasElement {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = 120 * dpr;
  c.height = 90 * dpr;
  c.setAttribute('aria-hidden', 'true');
  const x = c.getContext('2d');
  if (!x) return c;
  x.scale(dpr, dpr);
  const world: World = { w: 120, h: 90, dpr, scale: 0.8, fs: 0.8, portrait: false, surfaceY: 50, bottomY: 90, depth: 40, fisherX: 42, fisherY: 49.5, wallTop: 0, wallBottom: 0 };
  const gear: Gear = { ...save.equipped, [cat]: item.id } as Gear;
  if (cat === 'rod') {
    drawRodPreview(x, item.id, 120, 90);
  } else if (cat === 'hat') {
    world.fs = 1.3;
    world.fisherX = 56;
    world.fisherY = 122;
    drawFisher(x, world, { rodAngle: -0.6, bend: 0, bendDir: 0, cheer: 0, blink: false, bob: 0 }, gear, 0.5);
  } else if (cat === 'bobber') {
    x.strokeStyle = 'rgba(255,255,255,0.8)';
    x.beginPath();
    x.moveTo(60, 0);
    x.quadraticCurveTo(62, 30, 60, 42);
    x.stroke();
    drawBobber(x, item.id, 60, 50, 2.2, 0);
  } else {
    drawBait(x, item.id as Gear['bait'], 60, 40, 2.4, 0.3);
  }
  return c;
}

export function openShop(save: Save, onChange: () => void, start: ShopCategory = 'rod'): Promise<void> {
  let cat: ShopCategory = start;
  const coins = h('span', { class: 'coins-badge', 'aria-live': 'polite' });
  const sheet = openSheet({ title: 'Obchod', icon: '🛒', sub: 'Za mince z úlovků a misí', right: coins });

  function renderCoins(): void {
    coins.innerHTML = `${coinHTML} ${fmtNum(save.coins)}`;
    coins.setAttribute('aria-label', `${fmtNum(save.coins)} mincí`);
  }

  function render(): void {
    renderCoins();
    sheet.tabs.textContent = '';
    for (const c of Object.keys(SHOP) as ShopCategory[]) {
      sheet.tabs.append(
        tabButton(`${SHOP_LABEL[c].icon} ${SHOP_LABEL[c].name}`, c === cat, () => {
          cat = c;
          render();
        }),
      );
    }
    const grid = h('div', { class: 'shop-grid' });
    for (const item of SHOP[cat]) {
      const owned = (save.owned[cat] as string[]).includes(item.id);
      const equipped = save.equipped[cat] === item.id;
      const card = h('div', { class: `shop-card${equipped ? ' is-equipped' : ''}` });
      card.append(preview(cat, item, save), h('b', null, `${item.icon} ${item.name}`));
      if (item.hint) card.append(h('small', null, item.hint));
      let btn: HTMLButtonElement;
      if (equipped) {
        btn = h('button', { type: 'button', class: 'g92-btn g92-btn--success', disabled: true }, '✓ Nasazeno') as HTMLButtonElement;
      } else if (owned) {
        btn = h('button', { type: 'button', class: 'g92-btn g92-btn--secondary' }, 'Nasadit') as HTMLButtonElement;
        btn.addEventListener('click', () => {
          equipItem(save, cat, item.id);
          sfx.pop();
          onChange();
          render();
        });
      } else {
        const poor = save.coins < item.price;
        btn = h('button', { type: 'button', class: `g92-btn${poor ? ' g92-btn--soft' : ''}`, 'aria-label': `Koupit za ${item.price} mincí`, html: `${coinHTML}<span>${item.price}</span>` }) as HTMLButtonElement;
        btn.addEventListener('click', () => {
          const r = buyItem(save, cat, item.id);
          if (r === 'bought') {
            sfx.coin();
            toast(`Máš nový předmět: ${item.name}!`, { variant: 'success' });
            onChange();
            render();
          } else if (r === 'poor') {
            sfx.error();
            toast(`Chybí ti ještě ${item.price - save.coins} mincí. Chytej ryby a plň mise!`, { icon: COIN_SVG });
          }
        });
      }
      card.append(btn);
      grid.append(card);
    }
    sheet.body.textContent = '';
    sheet.body.append(grid);
  }
  render();
  return sheet.closed;
}
