import { TILE, aabb } from './physics.js';
import { parseLevel } from './level.js';
import { renderMapLayer } from './gfx/tiles.js';
import { drawBackground } from './gfx/background.js';
import { Particles, Decals } from './entities/particles.js';
import { Player } from './entities/player.js';
import { createEnemy } from './entities/enemies.js';
import { createBoss } from './entities/bosses.js';
import { TreasureBox, FloatingItem } from './entities/items.js';
import { EnemyShot, WEAPONS } from './entities/projectiles.js';
import { SONGS } from './audio.js';
import { sliceTileStrip, renderMapLayerHD, drawBackgroundHD, TILE_BANDS, buildBogHD, buildSpikeHD } from './gfx/hdworld.js';
import { THEMES } from './gfx/tiles.js';
import { SAFE_SHOT_T } from './balance.js';
import { Fx } from './fx.js';

export const W = 256, H = 224; // 論理座標（世界単位）。実キャンバスは SCALE 倍
export const SCALE = 3; // 内部解像度 768x672（docs/art-standard.md §2.1）。HD スプライトは 1 画面画素 = 1/3 世界単位

const NO_INPUT = { down: () => false, hit: () => false };

// 1ステージ分のランタイム
export class World {
  constructor(game, stageDef) {
    this.game = game; this.assets = game.assets; this.audio = game.audio;
    this.level = parseLevel(stageDef);
    const map = this.level.map;
    this.tiles = this.assets.tiles[this.level.theme];
    this.chunks = renderMapLayer(map, this.tiles);
    this.bg = this.assets.backgrounds[this.level.theme];
    // 生成済み HD 地形/背景があれば優先
    const gen = this.assets.generated ?? {};
    const strip = gen.tiles?.[this.level.theme];
    if (strip) {
      this.hdTiles = sliceTileStrip(strip.r, TILE_BANDS[this.level.theme]);
      // 装飾記号 → 生成装飾スプライト（テーマごとに割り当て）
      const D = gen.deco ?? {};
      const decoMap = { graveyard: { t: D.tomb, c: D.cross, f: D.flowers, v: D.candle, y: D.tree, x: D.blood, o: D.bones },
                        candyforest: { t: D.tomb, c: D.cross, f: D.flowers, v: D.candle, y: D.tree, x: D.blood, o: D.bones, k: D.lollipop },
                        castle: { n: D.pillar, w: D.window, v: D.candelabra, x: D.blood, o: D.bones, t: D.banner } }[this.level.theme] ?? {};
      for (const k of Object.keys(decoMap)) if (!decoMap[k]) delete decoMap[k];
      this.chunksHD = renderMapLayerHD(map, this.hdTiles, this.tiles, 512, decoMap, buildSpikeHD(THEMES[this.level.theme]));
      this.bogHD = buildBogHD(THEMES[this.level.theme]);
    }
    const th = this.level.theme;
    const mids = [gen.bg?.[th + '_mid'], gen.bg?.[th + '_mid2'], gen.bg?.[th + '_mid3']].filter(Boolean);
    // 主バリアントと高さが大きく違う層（壁面 vs 小物列など）は連結しない
    const midOk = mids.filter((L, i) => i === 0 || L.r.height >= mids[0].r.height * 0.5);
    const fars = [gen.bg?.[th + '_far'], gen.bg?.[th + '_far2']].filter(Boolean);
    const farOk = fars.filter((L, i) => i === 0 || (L.r.height >= fars[0].r.height * 0.5 && L.r.height <= fars[0].r.height * 2)); // 高さが極端に違う変異体は連結しない
    const SKY_PX = { castle: 2 }; // 城の空は奥壁（レンガ）なので 2 px/セルで密度差を抑える。他は空のグラデーションなので 3 のまま
    this.bgHD = { sky: gen.bg?.[th + '_sky'], skyPx: SKY_PX[th], far: farOk, mid: midOk }; // 遠景は A/B 2 変異体を連結（1 画面 px/セル）
    if (!this.bgHD.sky && !this.bgHD.far.length && !this.bgHD.mid.length) this.bgHD = null;
    this.fx = new Fx(); // ヒットストップ / フラッシュ / スロー / ボス登場（A-5）
    this.decals = new Decals(map.pixelWidth, map.pixelHeight);
    this.particles = new Particles(this);
    this.classes = { EnemyShot };

    this.enemies = []; this.shots = []; this.enemyShots = []; this.fires = []; this.pools = []; this.items = []; this.boxes = [];
    this.cam = { x: 0, y: 0 }; this.arena = null; this.boss = null; this.bossState = 'none';
    this.time = this.level.timeLimit; this.t = 0; this.cutscene = false; this.cleared = false;
    this.shakeT = 0; this.shakeAmp = 0; this.toasts = []; this.tickT = 0; this.safeT = 0; // safeT > 0 の間は敵弾なし
    this.checkpoint = { ...this.level.playerStart };
    this.player = new Player(this, this.level.playerStart.x, this.level.playerStart.y);
    this.spawnAll();
    this.cam.x = Math.max(0, this.player.centerX - W / 2);
  }
  get lives() { return this.game.lives; } set lives(v) { this.game.lives = v; }
  addScore(n) { this.game.score += n; }
  weaponName(k) { return WEAPONS[k]?.name ?? k; }
  toast(msg) { this.toasts.push({ msg, t: 0 }); if (this.toasts.length > 2) this.toasts.shift(); }
  shake(a) { this.shakeT = 0.25; this.shakeAmp = Math.max(this.shakeAmp, a); }

  spawnAll() {
    this.enemies = []; this.boxes = []; this.items = []; this.enemyShots = []; this.shots = []; this.fires = []; this.pools = [];
    for (const s of this.level.spawns) {
      if (s.type === 'treasure') this.boxes.push(new TreasureBox(this, s.x, s.y));
      else if (s.type === 'heartitem') this.items.push(new FloatingItem(this, 'potion', s.x, s.y));
      else { const e = createEnemy(this, s); if (e) { e.spawnX = s.x; this.enemies.push(e); } }
    }
  }

  // プレイヤー死亡→復活まわり
  onPlayerDying() { this.audio.stopBgm(); }
  onPlayerDeath() {
    this.game.lives--;
    if (this.game.lives < 0) { this.game.gameOver(); return; }
    // チェックポイントから再開。敵は再配置、ボス戦中ならボス戦をリセット
    if (this.boss) { this.boss = null; this.arena = null; this.bossState = 'none'; this.cutscene = false; }
    this.spawnAll();
    this.player.respawn(this.checkpoint.x, this.checkpoint.y); this.safeT = SAFE_SHOT_T;
    this.cam.x = Math.max(0, Math.min(this.level.map.pixelWidth - W, this.player.centerX - W / 2));
    this.time = Math.max(this.time, 60);
    this.audio.playBgm(SONGS[this.level.theme]);
  }
  onBossDying() { this.cutscene = true; this.audio.stopBgm(); this.fx.bossDefeat(); }
  onBossDefeated() { this.cleared = true; this.cutscene = true; this.player.vx = 0; this.game.stageClear(); }

  update(dt, input) {
    dt = this.fx.tick(dt); if (dt <= 0) return; // ヒットストップ中は世界を止める。スロー中は dt が縮む
    if (this.fx.introActive) input = NO_INPUT;  // ボス登場中は操作を受け付けない
    this.t += dt; if (this.safeT > 0) this.safeT = Math.max(0, this.safeT - dt);
    const p = this.player, map = this.level.map;
    if (!this.cutscene && p.alive) {
      this.time -= dt;
      if (this.time <= 0) { this.time = 0; p.die('time'); }
      else if (this.time < 10) { this.tickT += dt; if (this.tickT > 1) { this.tickT = 0; this.audio.sfx('tick'); } }
    }
    p.update(dt, input);

    // チェックポイント
    for (const c of this.level.checkpoints) if (p.centerX > c.x && this.checkpoint.x < c.x) { this.checkpoint = { ...c }; this.toast('祈りの十字路：ここから再開できる'); this.audio.sfx('select'); }

    // ボス戦開始
    if (this.bossState === 'none' && this.level.bossTrigger && p.centerX > this.level.bossTrigger.x && p.alive) this.startBoss();

    for (const e of this.enemies) e.update(dt);
    for (const s of this.shots) s.update(dt);
    for (const s of this.enemyShots) s.update(dt);
    for (const f of this.fires) f.update(dt);
    for (const q of this.pools) q.update(dt);
    for (const i of this.items) i.update(dt);
    for (const b of this.boxes) b.update(dt);
    this.particles.update(dt);
    this.collide();
    // 掃除（画面外に大きく離れた敵は残す＝復帰時に再登場）
    this.enemies = this.enemies.filter(e => !e.dead);
    this.shots = this.shots.filter(s => !s.dead); this.enemyShots = this.enemyShots.filter(s => !s.dead);
    this.fires = this.fires.filter(f => !f.dead); this.pools = this.pools.filter(q => !q.dead);
    this.items = this.items.filter(i => !i.dead); this.boxes = this.boxes.filter(b => !b.dead);

    // カメラ
    const target = p.centerX - W / 2 + (p.facing * 16);
    let cx = this.cam.x + (target - this.cam.x) * Math.min(1, dt * 6);
    let minX = 0, maxX = map.pixelWidth - W;
    if (this.arena) { minX = this.arena.x0; maxX = this.arena.x1 - W; }
    this.cam.x = Math.max(minX, Math.min(maxX, cx));
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmp = 0; }
    for (const t of this.toasts) t.t += dt; this.toasts = this.toasts.filter(t => t.t < 2.4);
  }

  startBoss() {
    const trig = this.level.bossTrigger; const map = this.level.map;
    const x0 = Math.max(0, Math.min(trig.x - 24, map.pixelWidth - W)); const x1 = Math.min(map.pixelWidth, x0 + W);
    this.arena = { x0, x1 }; this.bossState = 'fight'; this.audio.sfx('boss'); this.shake(3);
    // 地面高さを探す
    const tx = Math.floor((x1 - 40) / TILE); let gy = map.pixelHeight;
    const startTy = Math.max(0, Math.floor((this.player.y + this.player.h) / TILE) - 1);
    for (let ty = startTy; ty < map.height; ty++) if (map.isSolid(tx, ty)) { gy = ty * TILE; break; }
    this.boss = createBoss(this, this.level.boss, x1 - 48, gy);
    this.enemies = this.enemies.filter(e => !(e.spawnX >= x0 - 200)); // 周辺の雑魚は消す
    this.enemies.push(this.boss);
    this.audio.playBgm(SONGS.boss);
    this.fx.bossIntro(this.bossName());
  }
  bossName() { return { doll: '泣き人形 ドロシー', teddy: 'はらわたテディ', noir: '堕ちた魔法少女 ノワール' }[this.level.boss] ?? 'BOSS'; }

  collide() {
    const p = this.player;
    // 自弾 vs 敵・宝箱
    for (const s of this.shots) {
      if (s.dead) continue;
      for (const e of this.enemies) {
        if (e.dead || e.hp === undefined || s.hitIds.has(e.id)) continue;
        if (e.state === 'enter') continue;
        if (aabb(s, e)) { s.hitIds.add(e.id); e.hurt(s.dmg, s); s.onHit(); if (s.dead) break; }
      }
      if (s.dead) continue;
      for (const b of this.boxes) if (!b.dead && aabb(s, b)) { b.hurt(); s.onHit(); break; }
    }
    // 炎 vs 敵
    for (const f of this.fires) for (const e of this.enemies) {
      if (e.dead || e.hp === undefined) continue;
      if (aabb(f, e)) { const last = f.hitIds.get(e.id) ?? -1; if (f.t - last > 0.35) { f.hitIds.set(e.id, f.t); e.hurt(1, f); } }
    }
    if (!p.alive || this.cleared) return;
    const pbox = p;
    // 敵接触
    for (const e of this.enemies) if (!e.dead && e.contact && aabb(pbox, e)) { if (p.hit(e)) break; }
    // 敵弾
    for (const s of this.enemyShots) if (!s.dead && aabb(pbox, s)) { if (p.hit(s)) { if (!s.def.boomerang) s.dead = true; break; } }
    // 毒溜まり
    for (const q of this.pools) if (!q.dead && aabb(pbox, q)) { if (p.hit(q)) break; }
    // アイテム
    for (const i of this.items) if (!i.dead && aabb(pbox, i)) i.pickup(p);
  }

  draw(g) {
    const cam = { x: Math.floor(this.cam.x), y: 0 };
    if (this.shakeAmp > 0) { cam.x += Math.floor((Math.random() - 0.5) * this.shakeAmp * 2); cam.y += Math.floor((Math.random() - 0.5) * this.shakeAmp); }
    if (this.bgHD) { if (!this.bgHD.sky) drawBackground(g, [this.bg[0]], this.cam.x, W, H); drawBackgroundHD(g, this.bgHD, this.cam.x, W, H); }
    else drawBackground(g, this.bg, this.cam.x, W, H);
    // マップ
    if (this.chunksHD) for (const c of this.chunksHD) { const sx = c.x - cam.x; const cw = c.canvas.width / 3; if (sx > W || sx + cw < 0) continue; g.drawImage(c.canvas, sx, -cam.y, cw, c.canvas.height / 3); }
    else for (const c of this.chunks) { const sx = c.x - cam.x; if (sx > W || sx + c.canvas.width < 0) continue; g.drawImage(c.canvas, sx, -cam.y); }
    // 毒沼アニメ（'~' タイル）
    this.drawBog(g, cam);
    this.decals.draw(g, cam, W, H);
    const A = this.assets;
    for (const b of this.boxes) b.draw(g, cam, A.items);
    for (const q of this.pools) q.draw(g, cam, A.shots);
    for (const i of this.items) i.draw(g, cam, A.pickups);
    for (const e of this.enemies) e.draw(g, cam, A);
    this.player.draw(g, cam, A);
    for (const f of this.fires) f.draw(g, cam, A.shots);
    for (const s of this.shots) s.draw(g, cam, A.shots);
    for (const s of this.enemyShots) s.draw(g, cam, A.shots);
    this.particles.draw(g, cam);
    // 毒の画面効果（変身解除中にうっすら）
    if (this.player.costume === 'plain' && this.player.alive) { g.fillStyle = 'rgba(180,92,245,0.06)'; g.fillRect(0, 0, W, H); }
    // 撃破フラッシュ / ボス撃破の白飛び
    const fa = this.fx.flashAlpha; if (fa > 0) { g.globalAlpha = fa; g.fillStyle = this.fx.flashColor; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  }
  drawBog(g, cam) {
    const map = this.level.map; const f = Math.floor(this.t * 3) % 2;
    const tx0 = Math.floor(cam.x / TILE), tx1 = tx0 + W / TILE + 1;
    for (let ty = 0; ty < map.height; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (map.at(tx, ty) !== '~') continue;
      const top = map.at(tx, ty - 1) !== '~';
      if (this.bogHD) { const img = this.bogHD[f]; if (top) g.drawImage(img, tx * TILE - cam.x, ty * TILE - cam.y + 6, TILE, TILE - 6); else g.drawImage(img, 0, 24, 48, 24, tx * TILE - cam.x, ty * TILE - cam.y, TILE, TILE); }
      else g.drawImage(this.tiles[(top ? 'bogtop' : 'bog') + f], tx * TILE - cam.x, ty * TILE - cam.y);
    }
  }
}
