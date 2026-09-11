// 横スクロール面の「縁から渡れない隙間」検査。各面の地表の縁（立てるタイルの右隣が立てない）に主人公を置き、
// 単発／二段ジャンプ（二段の時機を 0〜48 フレームで総当たり）／歩いて落ちる、を本物の物理で試し、どれも死ぬ縁を報告する。
// 使い方: node tools/check_gaps.mjs [--url http://127.0.0.1:5173] [--stages stage-river]。終了コード 1 = 渡れない縁がある
import { chromium } from '@playwright/test';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('--url', 'http://127.0.0.1:5173'), ONLY = arg('--stages', '').split(',').filter(Boolean);
const browser = await chromium.launch(); const page = await browser.newPage();
await page.goto(`${URL}/index.html`); await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
const report = await page.evaluate(async ({ ONLY }) => {
  const { STAGES } = await import('/src/content/levels/index.js'); const g = window.__game, STEP = 1 / 60, out = [];
  for (let si = 0; si < STAGES.length; si++) {
    const st = STAGES[si]; if (ONLY.length && !ONLY.includes(st.name)) continue; if (st.vertical) continue;
    g.input.held.clear(); g.input.pressed.clear(); g.startGame(0); g.stageIndex = si; g.startStage(); g.setState('play'); g.irisT = 99;
    const w = g.world, map = w.level.map, p = w.player;
    const standable = (tx, ty) => map.isSolid(tx, ty) || map.isOneWay(tx, ty);
    // 地表の縁: 立てる (tx,ty) の上が空いていて、(tx+1,ty) が立てない
    // ボス部屋（'B' マーカー以降）は渡る必要が無く、到達すると操作不能（ボス登場の演出）になるので対象外
    let bossTx = map.width; for (const row of st.rows) { const i = row.indexOf('B'); if (i >= 0) bossTx = Math.min(bossTx, i); } // マーカーは map から消えるので元の rows で探す
    const edges = [];
    for (let ty = 1; ty < map.height; ty++) for (let tx = 1; tx < Math.min(map.width - 1, bossTx - 4); tx++) {
      if (!standable(tx, ty) || standable(tx, ty - 1) || standable(tx, ty - 2) || map.isHazard(tx, ty) || map.isHazard(tx, ty - 1)) continue;
      if (standable(tx + 1, ty) && !map.isHazard(tx + 1, ty) && !map.isHazard(tx + 1, ty - 1)) continue;
      edges.push({ tx, ty });
    }
    // back: 縁から何 px 手前で跳ぶか（助走。足場に乗る位置合わせのため 0〜64 を試す）
    const trial = (edge, dblAt, jump = true, back = 0) => {
      g.input.held.clear(); g.input.pressed.clear(); g.startGame(0); g.stageIndex = si; g.startStage(); g.setState('play'); g.irisT = 99;
      const w = g.world, p = w.player; for (let i = 0; i < 3; i++) { g.update(STEP); g.input.endFrame(); }
      p.x = edge.tx * 16 + 16 - p.w - back; p.y = edge.ty * 16 - p.h; p.vx = 0; p.vy = 0; p.platform = null;
      for (const e of w.enemies) e.dead = true; for (const s of w.enemyShots) s.dead = true;
      for (let i = 0; i < 2; i++) { g.update(STEP); g.input.endFrame(); }
      if (!p.onGround) return 'nostand';
      let jumped = -1;
      for (let f = 0; f < 240; f++) {
        g.input.held.clear(); g.input.pressed.clear(); g.input.held.add('right');
        if (jump && jumped < 0 && p.onGround && f >= 0) { g.input.pressed.add('jump'); jumped = f; }
        if (jump && jumped >= 0 && f === jumped + dblAt) g.input.pressed.add('jump');
        g.update(STEP); g.input.endFrame();
        if (p.state !== 'normal') return 'died';
        if (f > 2 && p.onGround && p.x > edge.tx * 16 + 16) return 'ok';
        if (f > 2 && p.onGround && !jump && p.x <= edge.tx * 16 + 16 - back + 4) return 'died'; // 歩いて落ちたのに縁より前 → 進めていない
        if (jumped >= 0 && f > jumped + 3 && p.onGround && p.x <= edge.tx * 16 + 16) return 'short'; // 跳んだが縁の手前に着地
      }
      return 'timeout';
    };
    // トランポリン経路: 縁の手前 3 タイル以内に W があれば、W の上でその場跳び→跳ね返り→右へ二段（時機を総当たり）も試す
    const trampTrial = (edge, wtx, dblAt) => {
      g.input.held.clear(); g.input.pressed.clear(); g.startGame(0); g.stageIndex = si; g.startStage(); g.setState('play'); g.irisT = 99;
      const w = g.world, p = w.player; for (let i = 0; i < 3; i++) { g.update(STEP); g.input.endFrame(); }
      p.x = wtx * 16 + 2; p.y = (edge.ty - 1) * 16 - p.h; p.vx = 0; p.vy = 0; p.platform = null; for (const e of w.enemies) e.dead = true;
      let bounced = -1; // W に置くと着地の瞬間に跳ね返る（onGround にはならない）ので、そのまま跳ね返りを待つ
      for (let f = 0; f < 240; f++) {
        g.input.held.clear(); g.input.pressed.clear();
        if (bounced >= 0) { g.input.held.add('right'); if (f === bounced + dblAt) g.input.pressed.add('jump'); }
        g.update(STEP); g.input.endFrame();
        if (bounced < 0 && p.vy < -300) bounced = f;
        if (p.state !== 'normal') return 'died';
        if (bounced >= 0 && f > bounced + 3 && p.onGround && p.x > edge.tx * 16 + 16) return 'ok';
        if (f > 60 && bounced < 0) return 'nobounce';
      }
      return 'timeout';
    };
    for (const edge of edges) {
      const results = [trial(edge, 999, false)];
      const passed = () => results.some(r => r.endsWith('ok'));
      for (const back of [0, 8, 16, 24, 32, 48, 64]) for (let d = 0; d <= 48 && !passed(); d += 3) results.push(trial(edge, d, true, back));
      if (!passed()) for (let wtx = edge.tx; wtx >= edge.tx - 3 && !passed(); wtx--) if (map.at(wtx, edge.ty - 1) === 'W') for (let d = 0; d <= 60 && !passed(); d += 3) results.push('W:' + trampTrial(edge, wtx, d));
      if (results.some(r => r.endsWith('ok')) || results.every(r => r === 'nostand')) continue;
      let gap = 0; for (let tx = edge.tx + 1; tx < map.width && gap < 30; tx++) { let ok = false; for (let ty = 0; ty < map.height; ty++) if (standable(tx, ty) && !map.isHazard(tx, ty) && !map.isHazard(tx, ty - 1)) { ok = true; break; } if (ok) break; gap++; }
      out.push({ stage: st.name, tx: edge.tx, ty: edge.ty, x: edge.tx * 16 + 16, gapTiles: gap, results: [...new Set(results)].join('/') });
    }
  }
  return out;
}, { ONLY });
for (const r of report) console.log(`${r.stage}: 縁 tx=${r.tx} ty=${r.ty} (x=${r.x}) の先は幅 ${r.gapTiles} タイルまで立てる所が無く、単発・二段(0〜48f)・歩き落ちのどれも渡れない [${r.results}]`);
if (!report.length) console.log('渡れない縁はありません');
await browser.close(); process.exit(report.length ? 1 : 0);
