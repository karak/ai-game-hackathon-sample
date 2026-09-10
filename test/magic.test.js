import { test, expect } from 'vitest';
import { parseLevel } from '../src/stage/level.js';
import { Player } from '../src/stage/entities/player.js';
import { Enemy } from '../src/stage/entities/enemies.js';
import { castMagic, MAGIC, SUPER, CHARGE_T, SUPER_T, Meteor, ShadowClone, HeartBurst, HeartGarden, FirePillar, MirrorFrame, Shard, Cortege, CutIn, CUTIN_IN, CUTIN_HOLD, CUTIN_OUT } from '../src/stage/entities/magic.js';

const STEP = 1 / 60;
// 「その tick に存在した弾」を累積した w.seen（worldOf の tick が貯める）から種類で絞る。
// 生成した tick のうちに壁へ当たって消える弾も数えられる（w.shots は filter で作り直されるので push の差し替えでは追えない）
const shotsSeen = (w, cls) => [...w.seen].filter(s => s instanceof cls);
const inputOf = (held = [], pressed = []) => ({ down: a => held.includes(a), hit: a => pressed.includes(a) });
function worldOf() {
  const rows = ['.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '..P.............................', '#'.repeat(32), '#'.repeat(32), '#'.repeat(32)];
  const level = parseLevel({ name: 't', rows });
  const w = { level, cutscene: false, cleared: false, shots: [], fires: [], effects: [], enemies: [], boxes: [], enemyShots: [], cam: { x: 0, y: 0 }, particles: { emit() {} }, audio: { sfx() {} }, fx: { hitStop() {} }, toast() {}, shake() {}, crumbles: [], platforms: [], presses: [], assets: {}, decals: { splat() {} }, addScore() {} };
  w.player = new Player(w, level.playerStart.x, level.playerStart.y);
  w.screenFx = []; // カットイン（画面固定演出）
  w.seen = new Set(); // 消えた弾も含め、一度でも存在した弾（shotsSeen で参照する）
  w.tick = n => { for (let i = 0; i < n; i++) { for (const e of w.effects) e.update(STEP); w.effects = w.effects.filter(e => !e.dead); for (const s of w.shots) s.update(STEP); for (const s of w.shots) w.seen.add(s); w.shots = w.shots.filter(s => !s.dead); for (const f of w.fires) f.update(STEP); w.fires = w.fires.filter(f => !f.dead); } };
  return w;
}

test('star → 8 meteors fall from the top within 1 s, each dmg 2 and piercing', () => {
  const w = worldOf(); w.player.weapon = 'star';
  expect(castMagic(w, w.player)).toBe('star');
  const seen = new Set();
  for (let i = 0; i < 70; i++) { w.tick(1); for (const s of w.shots) if (s instanceof Meteor) seen.add(s); } // 地面に当たって消えるので累積で数える
  expect(seen.size).toBe(MAGIC.star.count);
  for (const m of seen) { expect(m.dmg).toBe(2); expect(m.pierce).toBe(true); expect(m.vy).toBeGreaterThan(0); expect(m.y).toBeGreaterThan(-20); }
  expect(w.effects.length).toBe(0); // 8 発出し終えた caster は消える
});

test('knife → 2 clones fire knives every 0.25 s for 3 s then vanish', () => {
  const w = worldOf(); w.player.weapon = 'knife'; castMagic(w, w.player);
  expect(w.effects.filter(e => e instanceof ShadowClone).length).toBe(2);
  w.tick(60); // 1 秒: 2 体 × 4 発
  expect(w.shots.filter(s => s.type === 'knife').length).toBeGreaterThanOrEqual(6);
  w.tick(130);
  expect(w.effects.some(e => e instanceof ShadowClone)).toBe(false);
});

test('heart → burst damages enemies inside radius 40 once, leaves distant enemies alone', () => {
  const w = worldOf(); w.player.weapon = 'heart';
  const near = new Enemy(w, w.player.centerX + 20, w.player.y, 10, 10); near.hp = 10;
  const far = new Enemy(w, w.player.centerX + 120, w.player.y, 10, 10); far.hp = 10;
  w.enemies.push(near, far);
  castMagic(w, w.player); expect(w.effects[0]).toBeInstanceOf(HeartBurst);
  w.tick(40);
  expect(near.hp).toBe(10 - MAGIC.heart.dmg); expect(far.hp).toBe(10);
  expect(w.effects.length).toBe(0);
});

test('candle → 3 fire pillars ahead, 3 tiles tall, lasting 1.5 s', () => {
  const w = worldOf(); w.player.weapon = 'candle'; w.player.facing = 1; castMagic(w, w.player);
  const pillars = w.fires.filter(f => f instanceof FirePillar);
  expect(pillars.length).toBe(3);
  for (const f of pillars) { expect(f.h).toBe(MAGIC.candle.height); expect(f.x).toBeGreaterThan(w.player.centerX); }
  expect(pillars[1].x - pillars[0].x).toBeCloseTo(MAGIC.candle.gap, 3);
  w.tick(80); expect(w.fires.filter(f => f instanceof FirePillar).length).toBe(3);
  w.tick(20); expect(w.fires.filter(f => f instanceof FirePillar).length).toBe(0);
});

test('charged shoot from a gold-costume player casts the current weapon magic (via Player.shoot)', () => {
  const w = worldOf(); const p = w.player; p.costume = 'gold'; p.weapon = 'heart';
  p.shoot(true);
  expect(w.effects.some(e => e instanceof HeartBurst)).toBe(true);
});

// ---- 強化魔法（L2、SUPER_T まで溜めたとき。docs/plan/05-systems.md 5.1） ----

test('super star (星屑の葬列): 14 meteors of dmg 3, each impact bursts, and a big finale meteor follows', () => {
  const w = worldOf(); w.player.weapon = 'star';
  expect(castMagic(w, w.player, 2)).toBe('star');
  for (let i = 0; i < 90; i++) w.tick(1);
  const seen = shotsSeen(w, Meteor);
  const big = seen.find(m => m.big) ?? null;
  expect(seen.length).toBe(SUPER.star.count + 1);          // 14 発 ＋ 締めの巨大流星
  expect(big).not.toBeNull(); expect(big.dmg).toBe(SUPER.star.finale.dmg); expect(big.w).toBeGreaterThan(8);
  expect(seen.filter(m => m.big).length).toBe(1);
  for (const m of seen) { expect(m.dmg).toBeGreaterThanOrEqual(SUPER.star.dmg); expect(m.burst).toBeGreaterThan(0); }
  expect(w.effects.some(e => e instanceof HeartBurst)).toBe(true); // 着弾の小爆発
  expect(w.effects.length).toBeGreaterThan(0);
});

test('super knife (鏡像の舞踏会): 4 clones orbit the player at radius 28 and fire outward for 4 s', () => {
  const w = worldOf(); w.player.weapon = 'knife'; castMagic(w, w.player, 2);
  const clones = w.effects.filter(e => e instanceof ShadowClone);
  expect(clones.length).toBe(SUPER.knife.clones);
  for (const c of clones) expect(c.orbit).toBe(true);
  w.tick(30); // 0.5 秒: 中心からの距離が半径どおり、向きは左右に分かれる
  const p = w.player, dists = clones.map(c => Math.abs(c.x + p.w / 2 - p.centerX));
  expect(Math.max(...dists)).toBeLessThanOrEqual(SUPER.knife.radius + 1);
  expect(new Set(clones.map(c => Math.cos(c.theta) >= 0 ? 'r' : 'l')).size).toBe(2);
  const knives = shotsSeen(w, Object).filter(s => s.type === 'knife');
  expect(knives.length).toBeGreaterThanOrEqual(8); // 4 体 × 0.15 秒毎 ≈ 12
  expect(new Set(knives.map(s => Math.sign(s.vx)))).toEqual(new Set([1, -1])); // 外向き = 左右両方へ飛ぶ
  w.tick(60 * 4); expect(w.effects.some(e => e instanceof ShadowClone)).toBe(false);
});

test('super heart (心臓の花園): 3 flowers bloom then burst, damaging an enemy for SUPER.heart.dmg', () => {
  const w = worldOf(); w.player.weapon = 'heart'; w.player.facing = 1;
  const near = new Enemy(w, w.player.centerX + 26, w.player.y, 10, 10); near.hp = 20; w.enemies.push(near);
  castMagic(w, w.player, 2);
  const garden = w.effects.find(e => e instanceof HeartGarden);
  expect(garden).toBeInstanceOf(HeartGarden); expect(garden.seeds.length).toBe(SUPER.heart.seeds);
  expect(garden.seeds.every(s => !s.burst)).toBe(true);   // 植えた直後は咲いているだけ
  w.tick(Math.ceil(60 * (SUPER.heart.delay + 0.05)));
  expect(garden.seeds[0].burst).toBe(true);               // 1 つ目が破裂（爆発の輪はここから広がる）
  expect(w.effects.some(e => e instanceof HeartBurst)).toBe(true);
  w.tick(Math.ceil(60 * SUPER.heart.life * 0.7));         // 輪が敵に届くまで
  expect(near.hp).toBe(20 - SUPER.heart.dmg);             // 花 1 つで 1 回だけ
  w.tick(120);
  expect(w.effects.some(e => e instanceof HeartGarden)).toBe(false);
  expect(w.effects.some(e => e instanceof HeartBurst)).toBe(false); // 3 つ全部が破裂して片付く
});

test('super candle (蝋の聖歌隊): 5 pillars 4 tiles tall for 2.5 s, burning enemy shots that touch them', () => {
  const w = worldOf(); w.player.weapon = 'candle'; w.player.facing = 1; castMagic(w, w.player, 2);
  const pillars = w.fires.filter(f => f instanceof FirePillar);
  expect(pillars.length).toBe(SUPER.candle.count);
  for (const f of pillars) { expect(f.h).toBe(SUPER.candle.height); expect(f.wax).toBe(true); }
  expect(pillars[1].x - pillars[0].x).toBeCloseTo(SUPER.candle.gap, 3);
  // 柱に重なる敵弾は消え、離れた弾は残る。ブーメランは戻るので焼かない
  const shot = { x: pillars[0].x, y: pillars[0].y + 10, w: 6, h: 6, dead: false, def: {} };
  const away = { x: pillars[0].x + 400, y: pillars[0].y, w: 6, h: 6, dead: false, def: {} };
  const boomerang = { x: pillars[0].x, y: pillars[0].y + 20, w: 6, h: 6, dead: false, def: { boomerang: true } };
  w.enemyShots.push(shot, away, boomerang);
  w.tick(2);
  expect(shot.dead).toBe(true); expect(away.dead).toBe(false); expect(boomerang.dead).toBe(false);
  w.tick(60 * 2); expect(w.fires.filter(f => f instanceof FirePillar).length).toBe(SUPER.candle.count);
  w.tick(60); expect(w.fires.filter(f => f instanceof FirePillar).length).toBe(0);
});

test('charge tiers: releasing after CHARGE_T casts L1, holding past SUPER_T casts L2, plain costume casts nothing', () => {
  const w = worldOf(); const p = w.player; p.costume = 'gold'; p.weapon = 'heart'; p.facing = 1;
  const hold = n => { for (let i = 0; i < n; i++) { p.update(STEP, inputOf(['shoot'])); } };
  const release = () => p.update(STEP, inputOf([]));
  // 0.9 秒 → L1（大爆発 1 個）
  hold(Math.ceil(60 * (CHARGE_T + 0.05))); expect(p.superReady).toBe(false); release();
  expect(w.effects.filter(e => e instanceof HeartBurst).length).toBe(1);
  expect(w.effects.some(e => e instanceof HeartGarden)).toBe(false);
  w.effects = []; w.shots = []; p.chargeT = 0;
  // 1.8 秒 → L2（心臓の花園）。到達時に superReady が立つ
  hold(Math.ceil(60 * (SUPER_T + 0.05))); expect(p.superReady).toBe(true); release();
  expect(w.effects.some(e => e instanceof HeartGarden)).toBe(true);
  expect(p.superReady).toBe(false); expect(p.chargeT).toBe(0);
  w.effects = [];
  // 私服では溜まらない（chargeT が伸びない → 魔法も出ない）
  p.costume = 'plain'; hold(Math.ceil(60 * (SUPER_T + 0.5))); expect(p.chargeT).toBe(0); release();
  expect(w.effects.length).toBe(0);
});

test('super magic shakes the screen and flashes; L1 does not flash', () => {
  const w = worldOf(); let flashes = 0, shakes = [];
  w.fx.flash = () => flashes++; w.shake = a => shakes.push(a);
  w.player.weapon = 'candle'; castMagic(w, w.player, 1);
  expect(flashes).toBe(0);
  castMagic(w, w.player, 2);
  expect(flashes).toBe(1); expect(Math.max(...shakes)).toBeGreaterThanOrEqual(7);
});

// ---- 強化魔法の演出（カットイン・鏡の枠・破片・葬列） ----

test('super cast pushes one screen-space cut-in per weapon, sliding in, holding, then leaving', () => {
  const w = worldOf(); w.player.weapon = 'candle';
  castMagic(w, w.player, 2);
  expect(w.screenFx.length).toBe(1);
  const ci = w.screenFx[0];
  expect(ci).toBeInstanceOf(CutIn); expect(ci.name).toBe('wax'); expect(ci.slide).toBe(0);
  ci.update(CUTIN_IN); expect(ci.phase).toBe('hold'); expect(ci.slide).toBe(1);   // 滑り込み完了
  ci.update(CUTIN_HOLD); expect(ci.phase).toBe('out');
  ci.update(CUTIN_OUT * 0.5); expect(ci.slide).toBeGreaterThan(0); expect(ci.slide).toBeLessThan(1);
  ci.update(CUTIN_OUT); expect(ci.dead).toBe(true);
  const kinds = ['star', 'knife', 'heart'].map(k => { const ww = worldOf(); ww.player.weapon = k; castMagic(ww, ww.player, 2); return ww.screenFx[0].name; });
  expect(kinds).toEqual(['stardust', 'mirror', 'heart']);
});

test('mirror waltz breaks four mirrors after 0.25 s, each throwing four shards that fall and fade', () => {
  const w = worldOf(); w.player.weapon = 'knife'; castMagic(w, w.player, 2);
  const frames = w.effects.filter(e => e instanceof MirrorFrame);
  expect(frames.length).toBe(SUPER.knife.clones);
  expect(frames.every(f => !f.broke)).toBe(true);
  w.tick(Math.ceil(60 * 0.5)); // 鏡は 0.06 秒ずつ遅れて出るので、最後の 1 枚が割れるのは 0.25 + 0.18 秒
  expect(frames.every(f => f.broke)).toBe(true);
  const shards = w.effects.filter(e => e instanceof Shard);
  expect(shards.length).toBe(SUPER.knife.clones * 4);
  const y0 = shards[0].y; w.tick(20);
  expect(shards[0].y).not.toBe(y0);                       // 落ちる
  w.tick(60); expect(w.effects.some(e => e instanceof Shard)).toBe(false);
  w.tick(60); expect(w.effects.some(e => e instanceof MirrorFrame)).toBe(false);
});

test('stardust cortege sends one ghost procession across the sky for about 3 s', () => {
  const w = worldOf(); w.player.weapon = 'star'; w.player.facing = 1; castMagic(w, w.player, 2);
  const c = w.effects.find(e => e instanceof Cortege);
  expect(c).toBeInstanceOf(Cortege);
  const x0 = c.x; w.tick(60);
  expect(c.x).toBeGreaterThan(x0);                        // 進行方向へ渡る
  w.tick(60 * 3); expect(w.effects.some(e => e instanceof Cortege)).toBe(false);
  const back = worldOf(); back.player.weapon = 'star'; back.player.facing = -1; castMagic(back, back.player, 2);
  const c2 = back.effects.find(e => e instanceof Cortege); const bx = c2.x; back.tick(60);
  expect(c2.x).toBeLessThan(bx);
});

test('L1 magic adds no cut-in, no mirrors and no cortege', () => {
  for (const weapon of ['star', 'knife', 'heart', 'candle']) {
    const w = worldOf(); w.player.weapon = weapon; castMagic(w, w.player, 1);
    expect(w.screenFx.length, weapon).toBe(0);
    expect(w.effects.some(e => e instanceof MirrorFrame || e instanceof Cortege), weapon).toBe(false);
  }
});
