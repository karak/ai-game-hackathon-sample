// デザイン資料（カタログ）: 章ごとのページに分け、寸法・色数・フレーム時間・スクロール係数などの仕様を絵と一緒に示す
import { buildAssets } from '../gfx/assets.js';
import { state, el } from './sheet.js';
import * as characters from './pages/characters.js';
import * as enemies from './pages/enemies.js';
import * as items from './pages/items.js';
import * as tiles from './pages/tiles.js';
import * as background from './pages/background.js';
import * as stages from './pages/stages.js';
import * as ui from './pages/ui.js';
import * as assets from './pages/assets.js';

const PAGES = [
  ['chars', 'キャラクターシート', characters],
  ['enemies', '敵・ボス', enemies],
  ['items', 'アイテム・弾', items],
  ['tiles', 'タイル・装飾', tiles],
  ['bg', '背景レイヤー', background],
  ['stages', 'ステージ構成', stages],
  ['ui', 'UI', ui],
  ['assets', '全素材', assets],
];

async function boot() {
  try { const fontUrl = new URL('../../assets/fonts/DotGothic16-Regular.ttf', import.meta.url); const face = new FontFace('DotGothic16', `url(${fontUrl})`); await face.load(); document.fonts.add(face); } catch {}
  const A = await buildAssets();
  const url = new URL(location.href);
  const page = url.searchParams.get('page') ?? 'chars';
  const sel = document.getElementById('scale'); if (url.searchParams.get('scale')) sel.value = url.searchParams.get('scale');
  state.scale = Number(sel.value);
  for (const [id, key] of [['ov-hit', 'hit'], ['ov-anchor', 'anchor'], ['ov-grid', 'grid']]) {
    const cb = document.getElementById(id); if (url.searchParams.get(key) !== null) cb.checked = url.searchParams.get(key) === '1'; state[key] = cb.checked;
    cb.addEventListener('change', () => { url.searchParams.set(key, cb.checked ? '1' : '0'); location.href = url.href; });
  }
  sel.addEventListener('change', () => { url.searchParams.set('scale', sel.value); location.href = url.href; });
  const tabs = document.getElementById('tabs');
  for (const [id, title] of PAGES) { const u = new URL(url.href); u.searchParams.set('page', id); tabs.appendChild(el('a', { href: u.href, class: id === page ? 'on' : '', text: title })); }
  const main = document.getElementById('main');
  const mod = PAGES.find(p => p[0] === page)?.[2] ?? characters;
  await mod.render(main, A);
}
boot();
