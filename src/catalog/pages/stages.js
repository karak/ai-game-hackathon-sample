// ステージ構成: 俯瞰マップ（記号付き）、セグメント構成表、難易度曲線
import { h1, h2, h3, note, table, canvas, el } from '../sheet.js';
import { STAGES } from '../../levels/index.js';
import { parseLevel, MARKERS } from '../../level.js';
import { World } from '../../world.js';

const COLORS = { solid: '#6c6c80', oneway: '#c8a060', hazard: '#b45cf5', spike: '#d9262b', player: '#7cff70', checkpoint: '#ffe860', boss: '#ff6a6a', goal: '#ffffff', treasure: '#ff8fc8', enemy: '#ff9040', deco: '#3a3a52' };
const ENEMY_JP = { zombie: 'ゾンビ湧き', mushroom: 'キノコ妖精', unicorn: 'ユニコーン', cake: 'ケーキ', angel: '天使骸骨', bear: 'テディ', eye: '目玉', heartitem: 'ポーション', treasure: '宝箱' };

export async function render(main, A) {
  main.appendChild(h1('ステージ構成'));
  main.appendChild(note('俯瞰マップは 1 タイル = 4 px。記号: 緑=開始、黄=中間地点、赤=ボス開始、桃=宝箱、橙=敵、紫=毒沼、赤線=棘。セグメント表は 32 タイル（2 画面）単位。'));
  main.appendChild(el('div', { class: 'legend', html: Object.entries(COLORS).map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join('') }));
  for (const [idx, st] of STAGES.entries()) {
    const lvl = parseLevel(st); const map = lvl.map; const S = 4;
    main.appendChild(h2(`${st.title}（${st.theme}、${map.width} タイル = ${map.width * 16} 世界単位 ≈ ${Math.round(map.width / 16)} 画面、制限 ${st.timeLimit} 秒、ボス ${st.boss}）`));
    main.appendChild(note(st.subtitle));
    const c = canvas(map.width * S, map.height * S + 14); const g = c.getContext('2d');
    g.fillStyle = '#1a1230'; g.fillRect(0, 0, c.width, c.height);
    for (let ty = 0; ty < map.height; ty++) for (let tx = 0; tx < map.width; tx++) {
      const ch = map.at(tx, ty); let col = null;
      if (map.isSolid(tx, ty)) col = COLORS.solid; else if (map.isOneWay(tx, ty)) col = COLORS.oneway; else if (ch === '~') col = COLORS.hazard; else if (ch === '^') col = COLORS.spike; else if (ch !== '.') col = COLORS.deco;
      if (col) { g.fillStyle = col; g.fillRect(tx * S, ty * S, S, S); }
    }
    const mark = (x, y, col, r = 3) => { g.fillStyle = col; g.beginPath(); g.arc(x / 16 * S + S / 2, y / 16 * S + S / 2, r, 0, 7); g.fill(); };
    for (const s of lvl.spawns) mark(s.x, s.y, s.type === 'treasure' || s.type === 'heartitem' ? COLORS.treasure : COLORS.enemy, 2.5);
    mark(lvl.playerStart.x, lvl.playerStart.y, COLORS.player, 4); for (const cp of lvl.checkpoints) mark(cp.x, cp.y, COLORS.checkpoint, 4);
    if (lvl.bossTrigger) mark(lvl.bossTrigger.x, lvl.bossTrigger.y, COLORS.boss, 4);
    // 画面幅の目盛り
    g.fillStyle = '#8f8fb0'; g.font = '9px DotGothic16'; for (let tx = 0; tx <= map.width; tx += 16) { g.fillRect(tx * S, map.height * S, 1, 4); g.fillText(String(tx), tx * S + 2, c.height - 2); }
    main.appendChild(c);
    // セグメント表
    const seg = 32; const rows = [];
    for (let s0 = 0; s0 < map.width; s0 += seg) {
      const s1 = Math.min(map.width, s0 + seg);
      const en = lvl.spawns.filter(s => s.tx >= s0 && s.tx < s1); const counts = {};
      for (const s of en) counts[s.type] = (counts[s.type] ?? 0) + 1;
      let gaps = 0, plats = 0, hazards = 0;
      for (let tx = s0; tx < s1; tx++) { let solid = false; for (let ty = 0; ty < map.height; ty++) { if (map.isSolid(tx, ty)) solid = true; if (map.isOneWay(tx, ty)) plats++; if (map.isHazard(tx, ty)) hazards++; } if (!solid) gaps++; }
      const has = t => lvl[t] && lvl[t].x / 16 >= s0 && lvl[t].x / 16 < s1;
      const events = [lvl.playerStart.x / 16 >= s0 && lvl.playerStart.x / 16 < s1 && '開始', lvl.checkpoints.some(cp => cp.x / 16 >= s0 && cp.x / 16 < s1) && '中間地点', has('bossTrigger') && 'ボス', has('goal') && 'ゴール'].filter(Boolean).join('・');
      const danger = en.filter(s => s.type !== 'treasure' && s.type !== 'heartitem').length + Math.min(3, Math.round(hazards / 8)) + Math.round(gaps / 4);
      rows.push([`${s0}〜${s1 - 1}`, events || '-', Object.entries(counts).map(([k, n]) => `${ENEMY_JP[k] ?? k}×${n}`).join(' ') || '-', gaps, plats, hazards, danger]);
    }
    main.appendChild(table(['タイル範囲', 'イベント', '配置', '穴(列)', '足場(枚)', '危険(枚)', '難度*'], rows));
    // 難度曲線
    const dc = canvas(rows.length * 24 + 8, 60); const dg = dc.getContext('2d'); const mx = Math.max(1, ...rows.map(r => r[6]));
    rows.forEach((r, i) => { const hgt = Math.round(r[6] / mx * 48); dg.fillStyle = r[1].includes('ボス') ? '#ff6a6a' : '#d84f9c'; dg.fillRect(8 + i * 24, 56 - hgt, 18, hgt); });
    main.appendChild(dc);
    main.appendChild(note('*難度 = 敵数 + 危険タイル/8（上限 3）+ 穴の列数/4。相対比較用の目安。'));
    // 開始・中間・ボス部屋の実描画
    main.appendChild(h3('要所の実描画（開始 / 中間地点 / ボス部屋）'));
    const stub = { assets: A, audio: { sfx() {}, playBgm() {}, stopBgm() {} }, score: 0, lives: 2, stageIndex: idx };
    const spots = [['開始', lvl.playerStart.x], ...lvl.checkpoints.map(cp => ['中間地点', cp.x]), lvl.bossTrigger && ['ボス部屋', lvl.bossTrigger.x + 100]].filter(Boolean);
    const rowEl = el('div', { class: 'row' });
    for (const [label, x] of spots) {
      const w = new World(stub, st); w.player.x = x; w.cam.x = Math.max(0, Math.min(map.pixelWidth - 256, x - 100)); w.player.invT = 0;
      const sc = canvas(384, 336); const sg = sc.getContext('2d'); sg.save(); sg.scale(1.5, 1.5); w.draw(sg); sg.restore();
      sg.fillStyle = '#ffe860'; sg.font = '11px DotGothic16'; sg.fillText(label, 6, 12);
      rowEl.appendChild(sc);
    }
    main.appendChild(rowEl);
  }
}
