// デモ（アトラクト）入力ログの収録ボット（IMP-015）。人の収録の代わりに「無敵なし・残機 2」のボットを各面で走らせ、
// Game.startRecording / stopRecording で得た入力ログを assets/demo/<面名>.json に書く。
// 使い方: node tools/record_demos.mjs [--stages stage1,stage-river] [--url http://127.0.0.1:5173] [--secs 60] [--no-verify]
//   調整: node tools/record_demos.mjs --trace <面名> [--bot '{"shoot":12,...}'] [--step フレーム] [--from 秒 --to 秒] [--simdump 秒]（採用された変種の JSON を --bot に渡す）
// 収録は再生と同じ条件（World の seed は面の seed、lives 2、score 0、無敵なし）で行い、ボットの変種（撃つ間隔・跳ぶ判断の間隔・
// 足元を見る距離）をいくつか走らせて「死なずに最も遠くまで進んだ」ものを採る。収録後にページを読み直し、Game.startDemo(k) で
// 再生した軌跡（60 フレームごとの主人公座標）が収録時と一致することを確かめる（一致しなければ終了コード 1）。
// 前提: Vite（--url）が起きていること。ボットの操作は 6 操作（左右上下・撃つ・跳ぶ）だけで、デバッグキーや直接の状態操作はしない。
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('--url', 'http://127.0.0.1:5173'), SECS = +arg('--secs', 60), ONLY = arg('--stages', '').split(',').filter(Boolean), VERIFY = !process.argv.includes('--no-verify');
const SAMPLE = 60; // 軌跡の間引き（フレーム）
const TRACE = arg('--trace', ''), TSTEP = +arg('--step', 60), TFROM = +arg('--from', 0), TTO = +arg('--to', 999), SIMDUMP = +arg('--simdump', -1); // --step フレーム間隔、--from/--to 秒、--simdump 秒（その時点の先読み軌道を出す） // 面名を渡すと、その面を先頭の変種だけで走らせ 1 秒ごとの判断を出力する（ボットの調整用）

// ボットの変種。shoot: 撃つ間隔、stuck: 進みが止まったか見る間隔、look: 足元を見る距離（世界単位）、
// see: 敵を警戒する距離、jumpAt: これより近い敵は跳び越える、wait: 敵を待ち撃ちする上限フレーム（超えたら跳んで抜ける）、predict: 敵弾を先読みするフレーム数
const VARIANTS = [];
for (const shoot of [12, 18]) for (const see of [56, 80]) for (const jumpAt of [20, 30]) for (const wait of [60, 150]) VARIANTS.push({ shoot, stuck: 30, look: 12, see, jumpAt, wait, predict: 30 });
VARIANTS.push({ shoot: 12, stuck: 45, look: 12, see: 96, jumpAt: 24, wait: 90, predict: 40 }, { shoot: 15, stuck: 30, look: 12, see: 64, jumpAt: 36, wait: 180, predict: 24 });
for (const look of [10, 14, 20]) VARIANTS.push({ simple: true, shoot: 15, stuck: 30, look }); // 素朴なボット（保険。賢いボットが待ちで進めない面ではこちらが選ばれる）

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
const boot = async () => { await page.goto(`${URL}/index.html`); await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 }); };
await boot();
const names = await page.evaluate(async () => (await import('/src/content/levels/index.js')).STAGES.map(s => s.name));
const targets = ONLY.length ? ONLY : names;
for (const n of targets) if (!names.includes(n)) { console.error(`unknown stage: ${n}`); process.exit(2); }

// 1 面 × 1 変種を同期で回す（rAF のループが割り込まないよう、途中で await しない）。
// ボットは世界の状態（敵・敵弾・地形）を読むが、出す操作は 6 操作だけ。乱数は使わない（同じ世界 → 同じ入力 → 再生が一致する）
const runOne = ({ si, v, SECS, SAMPLE }) => {
  const g = window.__game, STEP = 1 / 60;
  g.input.held.clear(); g.startGame(0); g.stageIndex = si; g.startStage(); g.setState('play'); g.irisT = 99;
  const w = g.world, p = w.player, map = w.level.map; let frames = 0, lastX = p.x, best = w.level.vertical ? p.y : p.x, waitF = 0;
  const traj = [], deathsAt = g.deathLog.length, hits = [], trace = []; let wasHurt = false, fleeFrom = null, retreats = 0, holdF = 0, farX = p.x, movingF = 0, backoffF = 0, backDir = 1, plan = null, behindF = 0;
  const held = a => g.input.held.add(a), press = a => g.input.pressed.add(a);
  const ladderX = () => { const fy = Math.floor((p.y + p.h - 1) / 16); for (const ty of [fy, fy - 1]) for (let tx = 0; tx < map.width; tx++) if (map.at(tx, ty) === 'L') return tx * 16 + 8; return null; };
  const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  // 足元の先が「立てない」（穴・沼・棘）か。fty = 足の下の行、fy = 足のある行（棘は地表行を置き換える）
  const unsafeAhead = (dir, dist) => {
    const ftx = Math.floor((p.centerX + dir * dist) / 16), fty = Math.floor((p.y + p.h + 1) / 16), fy = Math.floor((p.y + p.h - 1) / 16);
    return (!map.isSolid(ftx, fty) && !map.isOneWay(ftx, fty)) || map.isHazard(ftx, fty) || map.isHazard(ftx, fy);
  };
  // 進行方向で接触する敵（同じ高さの帯）。最も近いものと、その隙間
  const blocker = dir => {
    let best = null, bestGap = Infinity;
    for (const e of w.enemies) {
      if (e.dead || !e.contact || e.state === 'enter' || e.hp === undefined) continue;
      const gap = dir > 0 ? e.x - (p.x + p.w) : p.x - (e.x + e.w);
      const sameBand = e.y < p.y + p.h && e.y + e.h > p.y - 8; // 足元〜頭の少し上
      if (gap > -6 && gap < v.see && sameBand && gap < bestGap) { best = e; bestGap = gap; }
    }
    return best ? { e: best, gap: bestGap } : null;
  };
  // 回避候補の評価用: k フレーム後の全ての敵弾・突進敵の箱が (x,y,w,h) と重なるか（跳ねる弾は高さ固定で横だけ進める）
  const shotHook = (k, x, y, h) => {
    if (k > Math.max(v.predict, 36)) return false; // 先の弾は次の判断に任せる（遠い将来まで見ると全候補が「当たる」になり、動けなくなる）。突進敵は遅れて届くので最低 36
    const t = k * STEP;
    for (const s of w.enemyShots) {
      if (s.dead) continue;
      const grav = s.def?.bounce ? 0 : (s.def?.gravity ?? 0), sx = s.x + s.vx * t;
      if (s.def?.bounce) { // 跳ねる弾: 直近 6 フレームは今の高さから足元までの帯、それ以降は床すれすれの箱（跳び越えの判断ができる）
        const floor = p.y + p.h, top = k <= 6 ? Math.min(s.y, floor - 14) : floor - 8;
        if (overlap(sx - 1, top, s.w + 2, floor - top, x, y, p.w, h)) return true; continue;
      }
      const sy = s.y + s.vy * t + 0.5 * grav * t * t;
      if (overlap(sx - 1, sy - 1, s.w + 2, s.h + 2, x, y, p.w, h)) return true;
    }
    for (const e of w.enemies) {
      if (e.dead || !e.contact || Math.hypot(e.vx, e.vy) < 120) continue;
      if (overlap(e.x + e.vx * t - 1, e.y + e.vy * t - 1, e.w + 2, e.h + 2, x, y, p.w, h)) return true;
    }
    return false;
  };
  // 敵弾の先読み: 今の速度（＋重力）で predict フレーム以内に主人公の箱へ入るか。入るなら着弾高さを返す
  const incoming = () => {
    let hit = null;
    for (const s of w.enemyShots) {
      if (s.dead) continue;
      const grav = s.def?.gravity ?? 0;
      if (s.def?.bounce) { // 地面を跳ねる弾（蛆）: 放物線では追えないので、向かってくるものは低い弾として扱い跳び越える
        const dx = p.centerX - (s.x + s.w / 2); if (Math.sign(dx) === Math.sign(s.vx) && Math.abs(dx) / Math.max(1, Math.abs(s.vx)) * 60 <= v.predict) { const k = Math.abs(dx) / Math.max(1, Math.abs(s.vx)) * 60; if (!hit || k < hit.k) hit = { k, cy: p.y + p.h - 2, bottom: p.y + p.h, grav: 1, bounce: true }; }
        continue;
      }
      for (let k = 1; k <= v.predict; k += 2) {
        const t = k * STEP, sx = s.x + s.vx * t, sy = s.y + s.vy * t + 0.5 * grav * t * t;
        if (overlap(sx, sy, s.w, s.h, p.x - 1, p.y - 1, p.w + 2, p.h + 2)) { if (!hit || k < hit.k) hit = { k, cy: sy + s.h / 2, bottom: sy + s.h, grav }; break; }
      }
    }
    // 突進する敵（針の群れなど）も弾と同じに扱う: 速いものだけ
    for (const e of w.enemies) {
      if (e.dead || !e.contact || Math.hypot(e.vx, e.vy) < 120) continue;
      for (let k = 1; k <= v.predict; k += 2) {
        const t = k * STEP, ex = e.x + e.vx * t, ey = e.y + e.vy * t;
        if (overlap(ex, ey, e.w, e.h, p.x - 1, p.y - 1, p.w + 2, p.h + 2)) { if (!hit || k < hit.k) hit = { k, cy: ey + e.h / 2, bottom: ey + e.h, grav: 0, dash: true }; break; }
      }
    }
    return hit;
  };
  // 進行方向の先の「立てない」区間の幅（タイル数。0 = 安全）。穴・沼・棘を数え、8 タイル先まで見る
  const gapWidth = dir => {
    const fty = Math.floor((p.y + p.h + 1) / 16), fy = Math.floor((p.y + p.h - 1) / 16);
    let tx = Math.floor((p.centerX + dir * 4) / 16), n = 0;
    const bad = tx => (!map.isSolid(tx, fty) && !map.isOneWay(tx, fty)) || map.isHazard(tx, fty) || map.isHazard(tx, fy);
    while (n < 8 && bad(tx)) { n++; tx += dir; }
    return n;
  };
  // 進行方向 1〜6 タイル先に、足元より上（4 段以内）で乗れる床や足場があるか（穴の上の足場に跳び乗る判断）
  const landingAhead = dir => {
    const fty = Math.floor((p.y + p.h + 1) / 16), tx0 = Math.floor(p.centerX / 16);
    for (let k = 1; k <= 6; k++) { const tx = tx0 + dir * k; for (let ty = fty; ty >= fty - 4; ty--) if ((map.isSolid(tx, ty) || map.isOneWay(tx, ty)) && !map.isHazard(tx, ty) && !map.isHazard(tx, ty - 1)) return true; }
    return false;
  };
  // 落ちてくる敵（頭上の繭など）: 自分の上にいて落下中なら、その反対へ逃げる
  const falling = () => {
    for (const e of w.enemies) {
      if (e.dead || !e.contact || e.y + e.h > p.y) continue;
      const dropping = e.state === 'drop' || (e.vy >= 60 && Math.abs(e.vx) < 40 && (p.y - (e.y + e.h)) / e.vy < 1.0); // ほぼ真下に、1 秒以内に届く
      if (dropping && e.x + e.w > p.x - 14 && e.x < p.x + p.w + 14) return e;
    }
    return null;
  };
  // プレス機: 進行方向 48 px 以内のものについて、下を通り切るまでの安全時間があるか
  const pressAhead = dir => {
    for (const q of w.presses ?? []) {
      const gap = dir > 0 ? q.x - (p.x + p.w) : p.x - (q.x + q.w);
      if (gap < -(q.w + p.w) || gap > 48) continue;
      if (gap < 0) return { q, gap }; // すでに真下（走り抜ける）
      const tm = q.t % 3.0, safeLeft = q.crushing ? 0 : 3.0 - tm, need = (q.w + p.w + 10) / 66 + 0.1; // 3.0 秒周期: 落下 0.15 → 下 0.5 → 上昇 0.6 → 待機
      if (safeLeft < need) return { q, gap };
    }
    return null;
  };
  // 放物線の先読み: 今の位置から「今跳ぶか／二段ジャンプをいつ入れるか／右を押し続けるか」を決めて物理を簡略に進め、
  // 着地が安全（床・すり抜け足場・動く足場・トランポリン経由）か、死ぬ（沼・棘・落下）かを返す。プレイヤー物理の定数と同じ
  // （SPEED 66・GRAV 560・落下上限 320・JUMP_V -218・DJUMP_V -196・TRAMPOLINE_V -330）。壁は横移動を止めるだけ、天井は無視
  let curDir = 1; // 今フレームの進行方向（sim の既定）
  let simPath = null; // simdump 用
  const poolAt = (x, y, h) => (w.pools ?? []).some(q => !q.dead && overlap(q.x, q.y, q.w, q.h, x, y, p.w, h)); // 毒溜まり（妖精の毒が地面に残る）は沼と同じ扱い
  const sim = (jumpNow, dbl, hold, d = curDir, dblHold = hold, opts = {}) => { // dblHold: 二段ジャンプの瞬間に進行方向を押しているか（離すと真下へ落ちる）。opts.hook(k,x,y,h) が true を返すと 'hit'、opts.crouch で伏せた箱
    let x = p.x, y = p.y, vy = p.vy, jumps = p.jumps, onG = p.onGround; let h = p.h; const w0 = p.w;
    if (opts.crouch && onG && !p.crouch) { y += 10; h = 18; } else if (!opts.crouch && p.crouch) { y -= 10; h = 28; }
    let vx = onG ? (hold ? d * 66 : 0) : p.vx; // 空中では横速度を変えられない（二段ジャンプの瞬間だけ入力方向に変わる）
    if (jumpNow && onG) { vy = -218; jumps = 1; onG = false; }
    if (dbl === 'now' && !onG && jumps === 1) { vy = -196; jumps = 2; vx = dblHold ? d * 66 : 0; }
    const plAt = (pl, k) => pl.positionAt ? pl.positionAt(pl.t + k / 60) : [pl.x, pl.y]; // 動く足場は k フレーム後の位置で当てる
    let pendingDbl = dbl === 'apex';
    const supported = () => { // 足の下に床・足場があるか（歩いて縁から落ちる瞬間を見る）
      const fty = Math.floor((y + h + 0.5) / 16), tx0 = Math.floor(x / 16), tx1 = Math.floor((x + w0 - 0.001) / 16);
      for (let tx = tx0; tx <= tx1; tx++) if (map.isSolid(tx, fty) || map.isOneWay(tx, fty)) return true;
      for (const pl of w.platforms ?? []) { if (pl.dead) continue; const [px, py] = plAt(pl, kk); if (Math.abs(py - (y + h)) < 1.5 && x + w0 > px && x < px + pl.w) return true; }
      return false;
    };
    let kk = 0;
    for (let k = 0; k < 180; k++) {
      kk = k; if (simPath) simPath.push(`${Math.round(x * 10) / 10},${Math.round(y * 10) / 10},${Math.round(vy)}${onG ? 'G' : ''}`);
      if (opts.hook && opts.hook(k, x, y, h)) return { r: 'hit', x, k };
      if (onG) { // 歩き: 支えが無くなったら落下へ。歩いている間に沼・棘へ入れば死
        let nx = x + vx / 60;
        if (vx !== 0) { const etx = Math.floor((vx > 0 ? nx + w0 - 0.001 : nx) / 16); if (map.isSolid(etx, Math.floor(y / 16)) || map.isSolid(etx, Math.floor((y + h - 0.001) / 16))) return { r: 'safe', x }; } // 壁で止まる = 落ちない
        x = nx;
        const cx = Math.floor((x + w0 / 2) / 16); if (map.isHazard(cx, Math.floor((y + h - 1) / 16)) || map.isHazard(cx, Math.floor(y / 16)) || poolAt(x, y, h)) return { r: 'death', x };
        if (supported()) { if (vx === 0 && k >= (opts.hook ? 60 : 0)) return { r: 'safe', x }; continue; } // 止まっている候補は弾を見る間（60 フレーム）だけ進める
        onG = false; vy = 0; jumps = 0; // 縁から落ちた（ジャンプ権なし）
      }
      if (pendingDbl && !onG && vy > 0 && jumps === 1) { vy = -196; jumps = 2; pendingDbl = false; vx = dblHold ? d * 66 : 0; dblHold = hold; } // 2 度目以降（トランポリン後）は進行方向へ
      vy = Math.min(320, vy + 560 / 60);
      let nx = x + vx / 60;
      if (vx !== 0) { const etx = Math.floor((vx > 0 ? nx + w0 - 0.001 : nx) / 16); if (map.isSolid(etx, Math.floor(y / 16)) || map.isSolid(etx, Math.floor((y + h - 0.001) / 16))) { nx = vx > 0 ? etx * 16 - w0 : (etx + 1) * 16; vx = 0; } } // 壁: タイル境界に押し戻し横速度 0（本物と同じ。y の範囲は moveBody と同じ h−ε）
      x = nx;
      const prevBottom = y + h; let ny = y + vy / 60;
      if (vy > 0) {
        const fty = Math.floor((ny + h) / 16), tx0 = Math.floor(x / 16), tx1 = Math.floor((x + w0 - 0.001) / 16);
        let landed = false, tramp = false;
        if (prevBottom <= fty * 16 + 0.01) for (let tx = tx0; tx <= tx1; tx++) if (map.isSolid(tx, fty) || map.isOneWay(tx, fty)) { landed = true; if (map.at(tx, fty) === 'W') tramp = true; }
        const standing = yTop => { const cx = Math.floor((x + w0 / 2) / 16); return map.isHazard(cx, Math.floor((yTop + h - 1) / 16)) || map.isHazard(cx, Math.floor(yTop / 16)) ? 'death' : 'safe'; }; // 着地しても胴体が沼・棘の中なら死
        if (landed) { ny = fty * 16 - h; if (tramp) { vy = -330; jumps = 1; onG = false; pendingDbl = !!dbl; dblHold = hold; } else return { r: standing(ny), x }; } // トランポリンで跳ね返ると二段ジャンプ権が戻る（本物と同じ）
        for (const pl of w.platforms ?? []) { if (pl.dead) continue; const [px, py] = plAt(pl, k + 1); if (prevBottom <= py + 0.01 && ny + h >= py && x + w0 > px && x < px + pl.w) return { r: standing(py - h), x }; }
      }
      y = ny;
      const cx = Math.floor((x + w0 / 2) / 16), fy = Math.floor((y + h - 1) / 16), hy = Math.floor(y / 16);
      if (map.isHazard(cx, fy) || map.isHazard(cx, hy) || y > map.pixelHeight + 8 || poolAt(x, y, h)) return { r: 'death', x };
    }
    return { r: 'none', x };
  };
  const safe = (...a) => sim(...a).r === 'safe';
  const good = (jumpNow, dbl, hold, d = curDir, dblHold = hold) => { const r = sim(jumpNow, dbl, hold, d, dblHold); return r.r === 'safe' && (r.x - p.x) * d >= 24; }; // 安全で、かつ進行方向に 1.5 タイル以上進む着地（その場で跳ねるだけの選択を除く）
  // 地上からの跳び方 3 通り（単発／頂点で前へ二段／頂点で真下へ二段）を先読みし、安全で最も遠くへ進むものを返す（無ければ null）
  const bestJump = fwd => {
    let best = null;
    for (const [dbl, dblHold] of [[null, true], ['apex', true], ['apex', false]]) {
      const r = sim(true, dbl, true, fwd, dblHold);
      if (r.r === 'safe' && (r.x - p.x) * fwd >= 24 && (!best || (r.x - p.x) * fwd > (best.x - p.x) * fwd)) best = { x: r.x, dbl, dblHold };
    }
    return best;
  };
  const platformAhead = dir => (w.platforms ?? []).some(pl => !pl.dead && (dir > 0 ? pl.x - p.x : p.x - pl.x) > -pl.w && (dir > 0 ? pl.x - p.x : p.x - pl.x) < 160);
  // 接触する敵（同じ高さの帯）で最も近いもの。沈んでいるシロップの腕は contact=false だが、間もなく立ち上がるので含める
  const blockerAt = dir => {
    let best = null, bestGap = Infinity;
    for (const e of w.enemies) {
      if (e.dead || e.state === 'enter' || e.hp === undefined) continue;
      const arm = e.baseY !== undefined && e.state !== undefined && 'stateT' in e && e.contact === false; // SyrupArm の沈み
      if (!e.contact && !arm) continue;
      const gap = dir > 0 ? e.x - (p.x + p.w) : p.x - (e.x + e.w);
      const top = arm ? e.baseY - e.h : e.y, bottom = arm ? e.baseY : e.y + e.h;
      const sameBand = top < p.y + p.h && bottom > p.y - 8;
      if (gap > -6 && gap < v.see && sameBand && gap < bestGap) { best = e; bestGap = gap; }
    }
    if (!best) return null;
    const isArm = best.baseY !== undefined && 'stateT' in best && best.spriteName && String(best.spriteName()).startsWith('syruparm');
    const passable = isArm && best.state === 'sunk' && best.stateT > (Math.max(0, bestGap) + best.w + 6) / 66 + 0.05; // 沈んでいる残り時間で「今の位置から」通り切れる（距離で見るので途中で判断が翻らない）
    return { e: best, gap: bestGap, isArm, passable };
  };
  g.startRecording();
  while (g.state === 'play' && frames < 60 * SECS) {
    g.input.held.clear();
    if (p.state === 'normal' && v.simple) {
      // 素朴なボット（比較用・保険）: 右へ走る、足元の先が立てなければ跳ぶ、落下に入ったら二段ジャンプ、進みが止まったら跳ぶ、定期的に撃つ。縦面ははしごへ
      if (w.level.vertical) {
        if (p.climbing) held('up');
        else { const lx = ladderX(); let dir = 1; if (lx !== null) { const dx = lx - p.centerX; if (Math.abs(dx) < 3) held('up'); else { dir = dx > 0 ? 1 : -1; held(dir > 0 ? 'right' : 'left'); } } else held('right');
          if (p.onGround && unsafeAhead(dir, v.look)) press('jump');
          if (!p.onGround && p.jumps === 1 && p.vy > 0 && frames % 7 === 0) press('jump'); }
      } else {
        held('right');
        if (p.onGround && unsafeAhead(1, v.look)) press('jump');
        if (frames % v.stuck === 0) { if (p.x - lastX < 6) press('jump'); lastX = p.x; }
        if (!p.onGround && p.jumps === 1 && p.vy > 0 && frames % 7 === 0) press('jump');
      }
      if (frames % v.shoot === 0) press('shoot');
      best = w.level.vertical ? Math.min(best, p.y) : Math.max(best, p.x);
    } else if (p.state === 'normal') {
      // 進行方向: 横スクロールは右、縦スクロールは足元の上にあるはしごへ
      let dir = 1, climbTo = false;
      if (w.level.vertical) { if (p.climbing) dir = 0; else { const lx = ladderX(); if (lx !== null) { const dx = lx - p.centerX; if (Math.abs(dx) < 3) { climbTo = true; dir = 0; } else dir = dx > 0 ? 1 : -1; } } }
      curDir = dir || 1;
      if (p.x > farX + 24) { farX = p.x; retreats = 0; holdF = 0; } // 前に進めたら引き返し回数を忘れる
      if (p.onGround) plan = null;
      const enemyAhead = w.enemies.some(e => !e.dead && e.hp !== undefined && e.state !== 'enter' && (e.x - p.x) * (dir || 1) > -8 && Math.abs(e.x - p.x) < 128 && e.y < p.y + p.h + 8 && e.y + e.h > p.y - 24);
      let move = dir !== 0, jump = false, shoot = frames % (enemyAhead ? Math.min(v.shoot, 6) : v.shoot) === 0, crouch = false, underPress = false; // 敵が前に居るときは連射
      if (p.climbing) held('up');
      else if (climbTo) held('up');
      else {
        // 逃げる対象は着地するまで固定（毎フレーム判定し直すと範囲の境で左右に振れて動けない）
        if (fleeFrom && (fleeFrom.dead || (fleeFrom.state !== 'drop' && fleeFrom.vy < 60) || fleeFrom.y + fleeFrom.h > p.y || Math.abs(fleeFrom.x - p.x) > 60)) fleeFrom = null;
        const b = blockerAt(dir), shot = incoming(), fall = fleeFrom ?? falling(), pr = pressAhead(dir); if (fall) fleeFrom = fall;
        if (fall) { const fd = fall.x + fall.w / 2 >= p.centerX ? -1 : 1; if (gapWidth(fd) === 0) { move = true; dir = fd; curDir = fd; } else move = false; waitF = 0; } // 落下物の反対へ（そちらが穴なら止まる）
        else if (b && (b.e.isBoss || b.e.hp >= 20)) { shoot = frames % 6 === 0; waitF = 0; }                    // ボスは塞ぐ相手として扱わず、撃ちながら素朴に進む（跳び越えられず、待つと接触される）
        else if (b) {
          const standHit = b.e.y < p.y + 15 && b.e.y + b.e.h > p.y + 9, crouchHit = b.e.y < p.y + 19 && b.e.y + b.e.h > p.y + 13; // 立ち撃ち y+12 / しゃがみ撃ち y+16 が当たる高さか
          const low = b.e.y >= p.y + p.h - 22; // 上端が足元から 22 px 以内の低い敵だけ跳び越えられる（頭の高さに浮く敵は跳ぶと当たる）
          if (b.isArm) { if (b.passable) { waitF = 0; } else { move = false; shoot = frames % 8 === 0; } }          // 腕: 沈んだら通る、立っていれば撃つ
          else if (low && b.gap < v.jumpAt) { if (p.onGround) jump = true; waitF = 0; }                          // 低くて近い: 跳び越える
          else if (!low && b.gap < 28) { if (gapWidth(-dir) === 0) { dir = -dir; curDir = dir; move = true; } else move = false; shoot = frames % 6 === 0; } // 高い敵が迫る: 下がって距離を取る（撃ち続ける）
          else if (!standHit && !crouchHit) { if (!low) move = false; waitF = 0; }                                // 撃っても当たらない高さ: 低い敵なら進む、高い敵なら止まって様子を見る
          else if (waitF < v.wait || !low) { move = false; shoot = frames % Math.min(v.shoot, 12) === 0; waitF++; crouch = !standHit; } // 止まって撃つ（立ち撃ちで当たらなければしゃがみ撃ち）。高い敵は待ち切る
          else if (p.onGround) jump = true;                                                                      // 待ちすぎ（低い敵）: 跳んで抜ける
        } else waitF = 0;
        const behind = !fall && !b && dir !== 0 ? blockerAt(-dir) : null; // 後ろから迫る敵: 振り向いて撃つ（向きは動いた瞬間に変わるので 1 フレームだけ寄る）
        if (behind && behind.gap < 36 && !behind.passable && !(behind.e.isBoss || behind.e.hp >= 20) && behindF < 45) { behindF++; if (p.facing !== -dir && p.onGround) { dir = -dir; curDir = dir; move = true; } else move = false; shoot = frames % 6 === 0; }
        else if (!behind) behindF = 0;
        if (pr && !fall) { if (pr.gap < 0) { underPress = true; move = true; } else if (pr.gap < 24) move = false; } // プレスの下に居るなら止まらず走り抜ける。手前なら安全時間を待つ
        if (shot && shot.bounce && p.onGround && !underPress) {
          // 跳ねる弾（蛆）: 近づいたら跳び越える（前へ跳んで安全ならそのまま、だめならその場で跳ぶ）。遠ければそのまま
          if (shot.k <= 14) { if (move && (safe(true, null, true) || safe(true, 'apex', true))) { jump = true; move = true; } else { jump = true; move = false; } }
        } else if (shot && p.onGround && !underPress) {
          // 回避: 候補行動（走り続ける／伏せる／下がる／跳ぶ／跳んで止まる／止まる）ごとに自分の箱を進め、全ての弾・突進敵の予測位置と重ならず着地も安全なものを最初に採る
          const blocked = !move; // 敵待ちなどで止まっているときは、前へ走る・前へ跳ぶ候補を使わない
          const cands = [{ n: 'run', hold: true, d: dir, only: !blocked }, { n: 'crouch', crouch: true }, { n: 'back', hold: true, d: -dir, only: gapWidth(-dir) === 0 }, { n: 'jump', j: true, hold: true, d: dir, only: !blocked }, { n: 'jumpStop', j: true, hold: false, d: dir }, { n: 'stop', hold: false, d: dir }];
          let pick = null;
          for (const c of cands) { if (c.only === false) continue; const r = sim(!!c.j, null, !!c.hold, c.d ?? dir, !!c.hold, { hook: shotHook, crouch: !!c.crouch }); if (r.r === 'safe') { pick = c; break; } }
          if (pick) {
            if (pick.n === 'run') { move = true; }
            else if (pick.n === 'crouch') { move = false; crouch = true; shoot = frames % 6 === 0; }
            else if (pick.n === 'back') { dir = -dir; curDir = dir; move = true; }
            else if (pick.n === 'jump') { jump = true; move = true; }
            else if (pick.n === 'jumpStop') { jump = true; move = false; }
            else move = false;
          } else if ((shot.grav || shot.dash) && !blocked) move = true; // 全部だめ: 落下弾・突進は走り抜ける（敵待ちで止まっているときは動かない）、直進弾は元の判断のまま
        }
        const ridingMover = p.platform && (p.platform.axis === 'x' || p.platform.axis === 'rail' || p.platform.axis === 'circle'); // 横に運んでくれる足場
        const wallAhead = dir !== 0 && p.onGround && (() => { const etx = Math.floor((dir > 0 ? p.x + p.w + 1 : p.x - 1) / 16), fy = Math.floor((p.y + p.h - 1) / 16); return map.isSolid(etx, fy) && !map.isSolid(etx, fy - 2); })(); // 1〜2 段の壁（トランポリンや段差）
        if (move && !b && !fall && !shot && dir !== 0 && (wallAhead || backoffF > 0)) {
          // 壁に接して跳ぶと横速度 0 の垂直ジャンプになる。少し下がりながら、前へ跳んで乗れる位置を毎フレーム探す
          const fwd = backoffF > 0 ? backDir : dir, bj = bestJump(fwd);
          if (bj) { jump = true; plan = bj.dbl ? { hold: bj.dblHold } : null; backoffF = 0; dir = fwd; curDir = fwd; }
          else if (backoffF < 45) { if (backoffF === 0) backDir = dir; backoffF++; dir = -backDir; curDir = backDir; move = true; }
          else { jump = true; backoffF = 0; dir = backDir; curDir = backDir; } // 見つからなければ跳ぶ（垂直でも段差なら乗れる）
        }
        if (!p.onGround && dir !== 0) {
          // 空中: このまま落ちて安全ならそのまま。危なければ「二段ジャンプ（今）」→「二段は頂点で（待つ）」→「止まる」→「止まって二段」の順。全部だめなら落下に入ったら二段
          // 空中は横速度を変えられないので、選べるのは二段ジャンプの時機と、その瞬間の向き（押す＝進行方向へ 66、離す＝真下へ）だけ
          if (plan && p.jumps === 1) {
            if (p.vy > 0) { if (safe(false, 'now', true, dir, plan.hold)) { jump = true; move = plan.hold; plan = null; } else plan = null; } // 計画どおり頂点で二段（この瞬間だけ向きを離すことがある。先読みが崩れていれば捨てて一般則へ）
          }
          if (!plan && !safe(false, null, move) && p.jumps === 1) {
            if (safe(false, 'now', true)) { jump = true; move = true; }
            else if (safe(false, 'apex', true)) {}                       // 頂点で前へ二段（待つ）
            else if (safe(false, 'now', false)) { jump = true; move = false; retreats++; } // 今、真下へ（引き返す）
            else if (safe(false, 'apex', false)) {}                      // 頂点で真下へ（待つ）
            else if (p.vy > 0) jump = true;
          }
        } else if (move && p.onGround && ridingMover && gapWidth(dir) > 0) {                                     // 運ばれている間: 安全に降りられる跳び方が見つかった瞬間に跳ぶ。無ければ乗ったまま待つ
          const bj = bestJump(dir); if (bj) { jump = true; plan = bj.dbl ? { hold: bj.dblHold } : null; } else move = false;
        }
        else if (move && p.onGround && backoffF === 0 && !wallAhead) {
          // 地上: 歩き続けた先読みが死（穴・沼・棘）なら、単発で届くなら跳ぶ、二段で届くなら跳ぶ（空中で二段を判断）。
          // どれも届かなければ縁まで歩いて再判断し、縁では最善（跳んで二段）
          const wk = sim(false, null, true).r;
          if (wk === 'death') {
            const bj = bestJump(dir);
            if (bj) { jump = true; plan = bj.dbl ? { hold: bj.dblHold } : null; } // 二段が要る計画なら空中で頂点に実行する
            else if (platformAhead(dir)) move = false;                    // 動く足場が来るのを待つ
            else if (retreats >= 2 && holdF < 90) { move = false; holdF++; } // 引き返しが続いたら少し待って状況（敵・足場）が変わるのを見る
            else if (unsafeAhead(dir, 6)) { jump = true; holdF = 0; }
          }
        }
        if (!move) { lastX = p.x; movingF = 0; }                                                                 // 待ちは「詰まり」に数えない
        else if (dir === 1 && ++movingF >= v.stuck && frames % v.stuck === 0) { if (p.x - lastX < 6 && p.onGround && (safe(true, null, true) || safe(true, 'apex', true) || safe(true, 'apex', true, dir, false))) jump = true; lastX = p.x; } // 進みが止まったら（安全に着地できるなら）跳ぶ
        if (v.trace && v.simdump >= 0 && frames === Math.round(v.simdump * 60)) {
          for (const [label, a] of [['continue', [false, null, move]], ['jump', [true, null, true]], ['jump+apex', [true, 'apex', true]], ['jump+apex nohold', [true, 'apex', true, curDir, false]], ['dbl now', [false, 'now', true]], ['dbl apex', [false, 'apex', true]]]) { simPath = []; const r = sim(...a); trace.push(`  SIM ${label}: ${r.r} x=${Math.round(r.x)} path=${simPath.slice(0, 40).join(' ')}`); simPath = null; }
          if (shot) { // 回避候補ごとの結果と、弾の予測位置
            const res = [['run', [true, null, true, dir, true, { hook: shotHook }]], ['crouch', [false, null, false, dir, false, { hook: shotHook, crouch: true }]], ['back', [false, null, true, -dir, true, { hook: shotHook }]], ['jump', [true, null, true, dir, true, { hook: shotHook }]], ['jumpStop', [true, null, false, dir, false, { hook: shotHook }]], ['stop', [false, null, false, dir, false, { hook: shotHook }]]].map(([n, a]) => { const r = sim(...a); return `${n}=${r.r}${r.k !== undefined ? '@' + r.k : ''}`; });
            const shots = w.enemyShots.filter(q => !q.dead).map(q => `${q.kind}(${Math.round(q.x)},${Math.round(q.y)} v${Math.round(q.vx)},${Math.round(q.vy)})`).join(' ');
            trace.push(`  DODGE shot k=${shot.k} cy-y=${Math.round(shot.cy - p.y)} : ${res.join(' ')} | shots: ${shots} | p=(${Math.round(p.x)},${Math.round(p.y)})`);
          }
        }
        if (v.trace && frames % v.tstep === 0 && frames >= v.tfrom * 60 && frames <= v.tto * 60) {
          const ne = w.enemies.filter(e => !e.dead && e.contact !== undefined).map(e => ({ e, d: e.x - p.x })).filter(o => o.d > -40 && o.d < 120).sort((a, b) => Math.abs(a.d) - Math.abs(b.d))[0];
          trace.push(`${(frames / 60).toFixed(2)}s x=${Math.round(p.x)} y=${Math.round(p.y)} v=${Math.round(p.vx)},${Math.round(p.vy)} jn=${p.jumps} g=${p.onGround ? 1 : 0} pf=${p.platform ? 1 : 0} mv=${move ? dir : 0} j=${jump ? 1 : 0} cr=${crouch ? 1 : 0} held=[${[...g.input.held].join(',')}] gw=${gapWidth(dir)} air(n/now/apex)=${sim(false, null, move).r[0]}${sim(false, 'now', move).r[0]}${sim(false, 'apex', move).r[0]} sim(w/j/jd/jdn)=${sim(false, null, true).r[0]}${sim(true, null, true).r[0]}${sim(true, 'apex', true).r[0]}${sim(true, 'apex', true, curDir, false).r[0]} bj=${(() => { const q = bestJump(curDir); return q ? `${q.dbl ?? 'single'}${q.dbl ? (q.dblHold ? '+' : '-') : ''}@${Math.round(q.x)}` : '-'; })()} b=${b ? `${b.e.constructor.name}/${Math.round(b.gap)}${b.isArm ? (b.passable ? '/pass' : '/wait') : ''}` : '-'} sh=${shot ? Math.round(shot.cy - p.y) : '-'} fall=${fall ? 1 : 0} pr=${pr ? Math.round(pr.gap) : '-'} w=${waitF} near=${ne ? `${ne.e.constructor.name}(${ne.e.state ?? ''},vy${Math.round(ne.e.vy)})@${Math.round(ne.d)}` : '-'}`);
        }
      }
      if (underPress) { jump = false; crouch = false; move = true; } // プレスの真下では跳ばない・伏せない（ブロックは床まで降りる）
      if (crouch) held('down');
      if (move && dir !== 0) held(dir > 0 ? 'right' : 'left');
      if (jump) press('jump');
      if (shoot) press('shoot');
      best = w.level.vertical ? Math.min(best, p.y) : Math.max(best, p.x);
    }
    if (frames % SAMPLE === 0) traj.push([frames, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, p.state, g.lives]);
    g.update(STEP); g.input.endFrame(); frames++;
    // 診断: 被弾（変身解除）の瞬間に、いちばん近い敵と敵弾を記録する（ボット改善の材料。再生には影響しない）
    if (v.trace && p.state === 'dying' && p.deathT < STEP * 1.5) trace.push(`  DIED ${p.deathReason} at x=${Math.round(p.x)} y=${Math.round(p.y)} frame=${frames}`);
    const hurt = p.hurtT > 0; if (hurt && !wasHurt) {
      const near = arr => arr.filter(o => !o.dead).map(o => ({ o, d: Math.hypot(o.x + o.w / 2 - p.centerX, o.y + o.h / 2 - (p.y + p.h / 2)) })).sort((a, b) => a.d - b.d)[0];
      const e = near(w.enemies), sh = near(w.enemyShots);
      hits.push(`${Math.round(p.x)}:${e ? `${e.o.constructor.name}@${Math.round(e.d)}` : '-'}/${sh ? `${sh.o.kind}@${Math.round(sh.d)}` : '-'}`);
    } wasHurt = hurt;
  }
  const json = g.stopRecording(); g.input.held.clear();
  const progress = w.level.vertical ? (map.height * 16 - best) : best;
  const reasons = g.deathLog.slice(deathsAt).map(d => `${d.r}@${Math.round(d.x)}`);
  return { json, traj, frames, deaths: w.deaths, reasons, hits, trace, endState: g.state, progress: Math.round(progress) };
};

if (TRACE) {
  const si = names.indexOf(TRACE); const r = await page.evaluate(runOne, { si, v: { ...VARIANTS[0], ...JSON.parse(arg('--bot', '{}')), trace: true, tstep: TSTEP, tfrom: TFROM, tto: TTO, simdump: SIMDUMP }, SECS, SAMPLE });
  console.log(r.trace.join('\n')); console.log(`end=${r.endState} deaths=${r.deaths} [${r.reasons.join(' ')}] hits=[${r.hits.join(' ')}] progress=${r.progress}`);
  await browser.close(); process.exit(0);
}
mkdirSync('assets/demo', { recursive: true });
const picked = {};
for (const name of targets) {
  const si = names.indexOf(name);
  const runs = [];
  for (const v of VARIANTS) { const r = await page.evaluate(runOne, { si, v, SECS, SAMPLE }); runs.push({ v, ...r }); }
  // 採用基準: 進んだ距離 − 死亡 1 回あたり 250 − ゲームオーバーなら 400（デモが途中で終わる）。死なずに止まっているだけの変種を採らない
  const score = r => r.progress - 250 * r.deaths - (r.endState === 'gameover' ? 400 : 0);
  runs.sort((a, b) => score(b) - score(a));
  const b = runs[0];
  picked[name] = b;
  console.log(`${name}: ${b.frames} frames (${(b.frames / 60).toFixed(1)}s), end=${b.endState}, deaths=${b.deaths} [${b.reasons.join(' ')}] hits=[${b.hits.join(' ')}], progress=${b.progress}, bot=${JSON.stringify(b.v)}\n  variants(score deaths/progress): ${runs.map(r => `${score(r)}:${r.deaths}d/${r.progress}${r.v.simple ? 's' : ''}`).join(' ')}`);
}

// 書き出しは全面の収録が終わってから（JSON を書くと Vite が HMR でページを読み直し、収録中の実行コンテキストが壊れる）
for (const [name, b] of Object.entries(picked)) {
  const out = { ...b.json, recorded: new Date().toISOString().slice(0, 10), bot: `record_demos.mjs ${JSON.stringify(b.v)}`, deaths: b.deaths, deathReasons: b.reasons, progress: b.progress, end: b.endState };
  writeFileSync(`assets/demo/${name}.json`, JSON.stringify(out) + '\n');
}

let failed = 0;
if (VERIFY) {
  // ページを読み直して新しい JSON を読み込み、startDemo で再生した軌跡を収録時と比べる
  await new Promise(r => setTimeout(r, 1500)); await boot();
  mkdirSync('test-results/shots', { recursive: true });
  for (const name of targets) {
    const si = names.indexOf(name), want = picked[name].traj;
    const got = await page.evaluate(({ si, SAMPLE, n }) => {
      const g = window.__game, STEP = 1 / 60; g.input.held.clear();
      if (!g.startDemo(si) || g.demoIdx !== si) return { error: `startDemo(${si}) did not start this stage (demoIdx=${g.demoIdx})` };
      const p = g.world.player, traj = [], level = g.world.level.name;
      for (let f = 0; f < n; f++) { if (g.state !== 'demo' || g.demoIdx !== si) break; if (f % SAMPLE === 0) traj.push([f, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, p.state, g.lives]); g.update(STEP); g.input.endFrame(); }
      // 証跡の撮影用に、もう一度この面のデモを頭から 10 秒ぶん進めておく（rAF のループが続きを再生する）
      const state = g.state; if (g.startDemo(si)) for (let f = 0; f < 600; f++) { g.update(STEP); g.input.endFrame(); }
      return { traj, level, state };
    }, { si, SAMPLE, n: picked[name].frames });
    await page.screenshot({ path: `test-results/shots/demo_${name}.png` });
    const ok = !got.error && JSON.stringify(got.traj) === JSON.stringify(want);
    if (!ok) { failed++; const i = got.traj ? got.traj.findIndex((t, k) => JSON.stringify(t) !== JSON.stringify(want[k])) : -1; console.error(`VERIFY FAIL ${name}: ${got.error ?? `first diff at sample ${i}: got ${JSON.stringify(got.traj?.[i])} want ${JSON.stringify(want[i])}`}`); }
    else console.log(`verify ${name}: replay matches ${want.length} samples (level=${got.level})`);
  }
}
await browser.close();
if (errors.length) { console.error('page errors:', errors); failed++; }
process.exit(failed ? 1 : 0);
