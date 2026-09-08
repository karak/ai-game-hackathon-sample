// 背景レイヤー分解: 層ごとの寸法・画素密度・スクロール係数・繰り返し幅、合成結果
import { h1, h2, h3, note, table, canvas, drawRaw, rawSize } from '../sheet.js';
import { THEMES } from '../../gfx/tiles.js';
import { drawBackgroundHD } from '../../gfx/hdworld.js';

const LAYERS = [['sky', '空', 3, 0], ['far', '遠景', 2, 0.2], ['mid', '中景', 1, 0.5], ['mid2', '中景 B', 1, 0.5], ['mid3', '中景 C', 1, 0.5]];

export async function render(main, A) {
  main.appendChild(h1('背景レイヤー'));
  main.appendChild(note('描画順: 空（固定） → 遠景（カメラ×0.2） → 中景（×0.5、A/B/C を連結して繰り返し） → 地形・装飾 → キャラ。中景はスプライトと同じ 1 px/セル。遠景 2、空 3 px/セルは 1 リクエストの横幅制約による妥協。'));
  const gen = A.generated ?? {};
  for (const th of Object.keys(THEMES)) {
    main.appendChild(h2(`テーマ: ${th}`));
    const rows = [];
    for (const [key, jp, px, speed] of LAYERS) {
      const L = gen.bg?.[`${th}_${key}`]; if (!L) continue;
      const [w, h] = rawSize(L);
      rows.push([jp, key, `${w}x${h}`, `${px}`, `${w * px}x${h * px}`, speed, key === 'sky' ? '固定' : `${w * px} px`]);
      main.appendChild(h3(`${jp}（${key}）`));
      const c = canvas(Math.min(w, 1024), h); drawRaw(c.getContext('2d'), L, 0, 0); main.appendChild(c);
    }
    main.appendChild(table(['層', 'キー', 'セル数', 'px/セル', '画面 px', 'スクロール係数', '繰り返し幅'], rows));
    // 合成
    main.appendChild(h3('合成（768×672、カメラ x=300）'));
    const cc = canvas(768, 672); const g = cc.getContext('2d'); g.save(); g.scale(3, 3);
    const mids = ['mid', 'mid2', 'mid3'].map(k => gen.bg?.[`${th}_${k}`]).filter(Boolean);
    const midOk = mids.filter((L, i) => i === 0 || L.r.height >= mids[0].r.height * 0.5);
    drawBackgroundHD(g, { sky: gen.bg?.[`${th}_sky`], far: [gen.bg?.[`${th}_far`]].filter(Boolean), mid: midOk }, 300, 256, 224);
    g.restore(); main.appendChild(cc);
  }
}
