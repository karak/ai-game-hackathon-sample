// 全素材一覧: manifest を機械的に列挙する（掲載漏れを作らないための網羅章）。他章は用途別の資料、本章は棚卸し
import { h1, h2, note, table, canvas, drawRaw, rawSize } from '../sheet.js';
import manifest from '../../gfx/manifest.json';

export const GROUP_JP = { player: '主人公', enemies: '雑魚敵', bosses: 'ボス', shots: '弾・演出', items: 'アイテム', deco: '装飾', tiles: '地形帯・ギミック小物', bg: '背景層', ending: 'エンディング場面（256×224 セル、3 px/セルで全画面）', magicfx: '強化魔法のエフェクト', cutin: '強化魔法のカットイン（不透明パネル）', props: '小物（二段ジャンプのほうき 2 コマ）' };

export async function render(main, A) {
  main.appendChild(h1('全素材一覧（manifest）'));
  const keys = Object.keys(manifest).sort();
  main.appendChild(note(`${keys.length} エントリ。寸法はセル（1 セル = 1 画面 px = 1/3 世界単位）。色数は不透明色。fits は仕様箱に収まっているか。`));
  const groups = {}; for (const k of keys) { const gname = k.split('/')[0]; (groups[gname] ??= []).push(k); }
  for (const [gname, list] of Object.entries(groups)) {
    main.appendChild(h2(`${GROUP_JP[gname] ?? gname}（${gname}、${list.length}）`));
    const rows = [];
    // サムネイル帯（1:1、横に並べる。背景層は幅が大きいので 1 枚ずつ）
    const sprOf = k => { const [g, n] = k.split('/'); return g === 'player' ? (A.player.dress[n] ?? A.player.plain?.[n.replace(/_plain$/, '')] ?? A.player.gold?.[n.replace(/_gold$/, '')] ?? A.generated?.player?.[n]) : (A.generated?.[g]?.[n] ?? A[g]?.[n]); };
    if (gname !== 'bg' && gname !== 'ending') {
      const sizes = list.map(k => { const s = sprOf(k); return s ? rawSize(s) : [32, 32]; });
      const cw = sizes.reduce((a, s) => a + Math.max(s[0], 56) + 10, 10), ch = Math.max(...sizes.map(s => s[1])) + 30;
      const c = canvas(cw, ch); const g = c.getContext('2d'); g.font = '9px DotGothic16'; g.textAlign = 'center'; g.fillStyle = '#ffe860';
      let x = 10; list.forEach((k, i) => { const s = sprOf(k); const [w, h] = sizes[i]; const cell = Math.max(w, 56); if (s) drawRaw(g, s, x + (cell - w) / 2, ch - 24 - h); g.fillText(k.split('/')[1], x + cell / 2, ch - 8); x += cell + 10; });
      main.appendChild(c);
    }
    for (const k of list) { const m = manifest[k]; rows.push([k, `${m.w}x${m.h}`, m.colors ?? '-', m.fits === undefined ? '-' : m.fits ? 'OK' : 'NG', m.anchor ?? '-', m.src]); }
    main.appendChild(table(['キー', '寸法', '色数', 'fits', 'アンカー', 'ファイル'], rows));
  }
}
