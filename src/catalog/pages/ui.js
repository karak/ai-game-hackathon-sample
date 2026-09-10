// UI シート: 窓、フォント、HUD、テロップの寸法と実描画
import { h1, h2, note, table, canvas } from '../sheet.js';
import { drawWindow, text, mini, textBox, LAYOUT, UI_PX, FONT_PX } from '../../ui/index.js';
import { drawHud } from '../../ui/hud.js';
import { World } from '../../stage/world.js';
import { STAGES } from '../../content/levels/index.js';

export async function render(main, A) {
  main.appendChild(h1('UI'));
  main.appendChild(table(['要素', '仕様'], [
    ['論理座標', `${LAYOUT.W}×${LAYOUT.H}（世界単位）。UI は ${UI_PX} 倍のスクリーン解像度で描く`],
    ['本文フォント', `DotGothic16 ${LAYOUT.FONT * FONT_PX}px（${FONT_PX} 倍）、影 2px、行送り ${LAYOUT.LINE} 論理 px`],
    ['ミニフォント', '3×5 ドット、1 ドット 2px（HUD の数値・英字）'],
    ['窓', '青グラデ、外枠 2px（#e8e8f4）、中間 1px（#8f8fb0）、内側の暗線 1px、四隅の飾り 4px'],
    ['セーフマージン', `${LAYOUT.MARGIN} 論理 px。1 行は 240 論理 px 以内で実測折り返し`],
    ['HUD', `上 ${LAYOUT.HUD_H} 論理 px。左: 武器窓 22×22、SCORE / TIME / LIFE（人形アイコン）/ DRESS 状態 / ST 番号`],
    ['ボス HP', '下部 160×14 の窓、バー 128px。30% 未満で赤'],
    ['テロップ', 'HUD 直下に最大 2 件、0.2 秒フェードイン、2.4 秒で消える。内容に合わせて窓幅を自動決定'],
  ]));
  main.appendChild(h2('実描画サンプル（768×672）'));
  const c = canvas(768, 672); const g = c.getContext('2d'); g.save(); g.scale(3, 3);
  const stub = { assets: A, audio: { sfx() {}, playBgm() {}, stopBgm() {}, muted: false }, score: 12340, lives: 2, stageIndex: 0 };
  const w = new World(stub, STAGES[0]); w.player.x = 600; w.cam.x = 500; w.toast('魔法のドレス！'); w.toast('祈りの十字路：ここから再開できる'); for (const t of w.toasts) t.t = 0.6; // 表示中の状態
  w.draw(g); drawHud(g, w, stub);
  textBox(g, [{ t: '第一章　花畑の墓地', color: '#ff8fc8' }, { t: '土の下から、可愛いものたちが這い出してくる' }], { y: 90, minWidth: 224 });
  textBox(g, 'これは長いテロップの折り返しテストです。実測幅で 240 論理 px 以内に収まるように改行されます。', { y: 150, pad: 4 });
  g.restore(); main.appendChild(c);
  main.appendChild(note('上: HUD（武器・スコア・時間・残機・衣装）とテロップ 2 件。中央: ステージ導入窓。下: 折り返しテスト。'));
}
