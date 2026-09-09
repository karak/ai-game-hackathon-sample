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
import { SAFE_SHOT_T, LOOP2 } from './balance.js';
import { Fx } from './fx.js';
import { seedGame, hashSeed } from './util.js';
import { HD_SCALE as HD } from './gfx/sprite.js';
import { MovingPlatform, CrumbleTile, PLATFORM, makeWheel, PressMachine, SyrupDripper, isTrampoline } from './entities/gimmicks.js';
import { resolveDecoMap } from './decomap.js';
import { updateCamera, snapCamera } from './camera.js';
import { BOSS_NAMES } from './story.js';
import { t } from './i18n.js';

export const W = 256, H = 224; // 論理座標（世界単位）。実キャンバスは SCALE 倍
export const SCALE = 3; // 内部解像度 768x672（docs/art-standard.md §2.1）。HD スプライトは 1 画面画素 = 1/3 世界単位

const NO_INPUT = { down: () => false, hit: () => false };

// 1ステージ分のランタイム
export class World {
  constructor(game, stageDef) {
    this.game = game; this.assets = game.assets; this.audio = game.audio;
    seedGame(stageDef.seed ?? hashSeed(stageDef.name)); // ステージ開始で乱数を固定（同じ入力 → 同じ結果）
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
      const decoMap = resolveDecoMap(this.level.theme, D); // 記号→装飾名は src/decomap.js（カタログと共通）
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
    this.platforms = []; this.crumbles = []; this.presses = []; this.drippers = []; // ギミック（spawnAll で配置）
    this.effects = []; // 溜め魔法などの一時エンティティ（update/draw/dead）
    this.screenFx = []; // 画面に固定して最後に描く演出（強化魔法のカットイン）。update/draw(g)/dead
    this.cam = { x: 0, y: 0 }; this.arena = null; this.boss = null; this.bossState = 'none'; this.bossIdx = 0; // 連戦の何体目か
    this.time = this.level.timeLimit; this.t = 0; this.cutscene = false; this.cleared = false; this.kills = 0; this.deaths = 0; // クリア画面の集計（撃破数・ミス数）
    // 2 周目（game.loop > 0）: 敵弾 1.5 倍（弾速）・湧き間隔 0.8 倍（05-systems 5.1「真の結末」ルート）
    this.loop = game.loop ?? 0; this.hard = this.loop > 0 ? LOOP2 : { shotSpeed: 1, spawnGap: 1 };
    this.shakeT = 0; this.shakeAmp = 0; this.toasts = []; this.tickT = 0; this.safeT = 0; // safeT > 0 の間は敵弾なし
    this.checkpoint = { ...this.level.playerStart };
    this.player = new Player(this, this.level.playerStart.x, this.level.playerStart.y);
    this.spawnAll();
    snapCamera(this.cam, this.player, map, null);
  }
  get lives() { return this.game.lives; } set lives(v) { this.game.lives = v; }
  addScore(n) { this.game.score += n; }
  onEnemyKilled() { this.kills++; }
  weaponName(k) { return WEAPONS[k]?.name ?? k; }
  toast(msg) { this.toasts.push({ msg, t: 0 }); if (this.toasts.length > 2) this.toasts.shift(); }
  shake(a) { this.shakeT = 0.25; this.shakeAmp = Math.max(this.shakeAmp, a); }

  spawnAll() {
    this.enemies = []; this.boxes = []; this.items = []; this.enemyShots = []; this.shots = []; this.fires = []; this.pools = []; this.effects = []; this.screenFx = [];
    this.platforms = []; this.presses = []; this.crumbles = this.level.crumbles.map(c => new CrumbleTile(this, c.tx, c.ty));
    // 糖蜜のしずく（第二章）: マップの 'D' タイルごとにノズルを置く
    this.drippers = [];
    for (let ty = 0; ty < this.level.map.height; ty++) for (let tx = 0; tx < this.level.map.width; tx++) if (this.level.map.at(tx, ty) === 'D') this.drippers.push(new SyrupDripper(this, tx, ty));
    for (const c of this.crumbles) this.level.map.set(c.tx, c.ty, '!'); // 消えていた足場を戻す
    for (const s of this.level.spawns) {
      if (s.type === 'wheel') { this.platforms.push(...makeWheel(this, s.tx, s.ty)); continue; }
      if (s.type === 'press') { this.presses.push(new PressMachine(this, s.tx, s.ty)); continue; }
      if (PLATFORM[s.type]) { this.platforms.push(new MovingPlatform(this, s.type, s.tx, s.ty)); continue; }
      if (s.type === 'treasure') this.boxes.push(new TreasureBox(this, s.x, s.y));
      else if (s.type === 'heartitem') this.items.push(new FloatingItem(this, 'potion', s.x, s.y));
      else { const e = createEnemy(this, s); if (e) { e.spawnX = s.x; this.enemies.push(e); } }
    }
  }

  // プレイヤー死亡→復活まわり
  onPlayerDying() { this.audio.playJingle(SONGS.jDeath); } // 死亡ジングル（BGM は止まる。復活時に onPlayerDeath がテーマ曲を再開）
  onPlayerDeath() {
    this.game.logDeath?.(this.player.deathReason); // 死亡地点ログ（IMP-007）
    this.deaths++; this.game.lives--;
    if (this.game.lives < 0) { this.game.gameOver(); return; }
    // チェックポイントから再開。敵は再配置、ボス戦中ならボス戦をリセット
    if (this.boss) { this.boss = null; this.arena = null; this.bossState = 'none'; this.cutscene = false; } // 死亡: 連戦の何体目かは維持（倒したボスは戻らない）
    this.spawnAll();
    this.player.respawn(this.checkpoint.x, this.checkpoint.y); this.safeT = SAFE_SHOT_T;
    snapCamera(this.cam, this.player, this.level.map, this.arena);
    this.time = Math.max(this.time, 60);
    this.audio.playBgm(SONGS[this.level.theme]);
  }
  onBossDying() { this.cutscene = true; this.audio.stopBgm(); this.fx.bossDefeat(); }
  onBossDefeated() {
    if (this.bossIdx + 1 < this.level.bosses.length) { // 連戦: 次のボスへ（部屋を開放して先へ進ませる）
      this.bossIdx++; this.boss = null; this.arena = null; this.bossState = 'none'; this.cutscene = false; this.enemies = this.enemies.filter(e => !e.isBoss && !e.head);
      this.player.invT = Math.max(this.player.invT, 1.5); this.time = Math.max(this.time, 90); this.toast(t('先へ進め')); this.audio.playBgm(SONGS[this.level.theme]); return;
    }
    this.cleared = true; this.cutscene = true; this.player.vx = 0; this.game.stageClear();
  }

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
    for (const q of this.platforms) q.update(dt);   // 足場は主人公より先に動かす（乗り物処理のため）
    for (const c of this.crumbles) c.update(dt);
    for (const q of this.presses) q.update(dt);
    for (const q of this.drippers) if (q.x > this.cam.x - 64 && q.x < this.cam.x + W + 64) q.update(dt); // 画面内のノズルだけ滴らせる
    p.update(dt, input);

    // チェックポイント
    for (const c of this.level.checkpoints) if (p.centerX > c.x && this.checkpoint.x < c.x) { this.checkpoint = { ...c }; this.toast(t('祈りの十字路：ここから再開できる')); this.audio.sfx('select'); }

    // ボス戦開始
    const trig0 = this.level.bossTriggers[this.bossIdx];
    if (this.bossState === 'none' && trig0 && p.alive && (this.level.vertical ? p.y + p.h <= trig0.y + TILE : p.centerX > trig0.x)) this.startBoss(); // 縦マップはトリガー行より上に立ったら開始

    for (const e of this.enemies) e.update(dt);
    for (const s of this.shots) s.update(dt);
    for (const s of this.enemyShots) s.update(dt);
    for (const f of this.fires) f.update(dt);
    for (const q of this.pools) q.update(dt);
    for (const i of this.items) i.update(dt);
    for (const b of this.boxes) b.update(dt);
    for (const e of this.effects) e.update(dt);
    this.effects = this.effects.filter(e => !e.dead);
    for (const e of this.screenFx) e.update(dt);
    this.screenFx = this.screenFx.filter(e => !e.dead);
    this.particles.update(dt);
    this.collide();
    // 掃除（画面外に大きく離れた敵は残す＝復帰時に再登場）
    this.enemies = this.enemies.filter(e => !e.dead);
    this.shots = this.shots.filter(s => !s.dead); this.enemyShots = this.enemyShots.filter(s => !s.dead);
    this.fires = this.fires.filter(f => !f.dead); this.pools = this.pools.filter(q => !q.dead);
    this.items = this.items.filter(i => !i.dead); this.boxes = this.boxes.filter(b => !b.dead);

    // カメラ（2 軸。縦は高さ > H のマップだけ動く）
    updateCamera(this.cam, p, map, this.arena, dt);
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmp = 0; }
    for (const t of this.toasts) t.t += dt; this.toasts = this.toasts.filter(t => t.t < 2.4);
  }

  startBoss() {
    const trig = this.level.bossTriggers[this.bossIdx]; const map = this.level.map; const kind = this.level.bosses[this.bossIdx] ?? this.level.boss;
    const x0 = this.level.vertical ? 0 : Math.max(0, Math.min(trig.x - 24, map.pixelWidth - W)); const x1 = Math.min(map.pixelWidth, x0 + W);
    this.arena = { x0, x1 }; this.bossState = 'fight'; this.audio.sfx('boss'); this.shake(3);
    if (map.pixelHeight > H) { const y1 = Math.min(map.pixelHeight, Math.max(H, trig.y + 2 * TILE)); this.arena.y0 = y1 - H; this.arena.y1 = y1; } // 縦マップ: トリガー行を下端近くに含む 1 画面
    // 地面高さを探す
    const tx = Math.floor((x1 - 40) / TILE); let gy = map.pixelHeight;
    const startTy = Math.max(0, Math.floor((this.player.y + this.player.h) / TILE) - 1);
    for (let ty = startTy; ty < map.height; ty++) if (map.isSolid(tx, ty)) { gy = ty * TILE; break; }
    if (kind === 'serpent') { // 大蛇は川に棲む: 部屋の中央列で最初の '~' の上端を水面にする
      const cx = Math.floor((x0 + x1) / 2 / TILE);
      for (let ty = 0; ty < map.height; ty++) if (map.at(cx, ty) === '~') { gy = ty * TILE; break; }
    }
    this.boss = createBoss(this, kind, x1 - 48, gy);
    if (this.level.bossHpMul !== 1) { this.boss.hpMax = Math.round(this.boss.hpMax * this.level.bossHpMul); this.boss.hp = this.boss.hpMax; } // 連戦強化
    if (this.boss.parts) this.enemies.push(...this.boss.parts); // 胴体（接触判定のみ）
    this.enemies = this.enemies.filter(e => !(e.spawnX >= x0 - 200)); // 周辺の雑魚は消す
    this.enemies.push(this.boss);
    this.audio.playBgm(SONGS[this.level.bossSong ?? 'boss']); // 最終章は bossFinal
    this.fx.bossIntro(this.bossName());
  }
  bossName(kind = this.level.bosses[this.bossIdx] ?? this.level.boss) { const n = BOSS_NAMES[kind]; return n ? t(n) : 'BOSS'; }

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
    const cam = { x: Math.floor(this.cam.x), y: Math.floor(this.cam.y) };
    if (this.shakeAmp > 0) { cam.x += Math.floor((Math.random() - 0.5) * this.shakeAmp * 2); cam.y += Math.floor((Math.random() - 0.5) * this.shakeAmp); }
    if (this.bgHD) { if (!this.bgHD.sky) drawBackground(g, [this.bg[0]], this.cam.x, W, H); drawBackgroundHD(g, this.bgHD, this.cam.x, W, H, this.cam.y, this.level.map.pixelHeight); }
    else drawBackground(g, this.bg, this.cam.x, W, H);
    // マップ
    if (this.chunksHD) for (const c of this.chunksHD) { const sx = c.x - cam.x; const cw = c.canvas.width / 3; if (sx > W || sx + cw < 0) continue; g.drawImage(c.canvas, sx, -cam.y, cw, c.canvas.height / 3); }
    else for (const c of this.chunks) { const sx = c.x - cam.x; if (sx > W || sx + c.canvas.width < 0) continue; g.drawImage(c.canvas, sx, -cam.y); }
    // 毒沼アニメ（'~' タイル）
    this.drawBog(g, cam);
    this.decals.draw(g, cam, W, H);
    this.drawGimmicks(g, cam);
    const A = this.assets;
    for (const b of this.boxes) b.draw(g, cam, A.items);
    for (const q of this.pools) q.draw(g, cam, A.shots);
    for (const i of this.items) i.draw(g, cam, A.pickups);
    for (const e of this.enemies) e.draw(g, cam, A);
    this.player.draw(g, cam, A);
    for (const f of this.fires) f.draw(g, cam, A.shots, A);   // 第 4 引数: 強化魔法の生成素材（magicfx）を引くため
    for (const s of this.shots) s.draw(g, cam, A.shots, A);
    for (const s of this.enemyShots) s.draw(g, cam, A.shots);
    for (const e of this.effects) e.draw(g, cam, A);
    this.particles.draw(g, cam);
    this.drawWeather(g, cam);
    // 毒の画面効果（変身解除中にうっすら）
    if (this.player.costume === 'plain' && this.player.alive) { g.fillStyle = 'rgba(180,92,245,0.06)'; g.fillRect(0, 0, W, H); }
    // 撃破フラッシュ / ボス撃破の白飛び
    const fa = this.fx.flashAlpha; if (fa > 0) { g.globalAlpha = fa; g.fillStyle = this.fx.flashColor; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    // 画面固定の演出（カットイン）は最後に、カメラを無視して描く
    for (const e of this.screenFx) e.draw(g, this.assets, W, H);
  }
  // 動く足場・崩れる足場・はしご（足場画像はテーマの足場タイルを流用。はしごは暫定の幾何描画: 第四章の地形生成で置換予定）
  drawGimmicks(g, cam) {
    const G = this.assets.generated?.tiles ?? {};
    // 生成済みのギミック絵（tiles/ladder, island, plank）があれば使う。無ければ足場タイル／幾何描画
    const drawGen = (spr, x, y, w, h) => { const sw = spr.r.width / HD, sh = spr.r.height / HD; g.drawImage(spr.r, Math.round(x + w / 2 - sw / 2), Math.round(y + h - sh), sw, sh); };
    const plat = (x, y, w, shake = 0, kind = 'plat') => {
      const sx = x - cam.x + shake, sy = y - cam.y;
      if (kind === 'island' && G.island) return drawGen(G.island, sx, sy - 2, w, TILE);
      if (kind === 'plank' && G.plank) return drawGen(G.plank, sx, sy, w, TILE);
      if (kind === 'candyplank' && G.candyplank) return drawGen(G.candyplank, sx, sy, w, TILE); // 第二章の飴の板（IMP-020）
      const n = Math.round(w / TILE);
      for (let i = 0; i < n; i++) {
        if (this.hdTiles) { const v = (i * 7) % this.hdTiles.cols; g.drawImage(this.hdTiles.plat[v], Math.round(sx + i * TILE), Math.round(sy), TILE, TILE); }
        else g.drawImage(this.tiles.plat, Math.round(sx + i * TILE), Math.round(sy));
      }
    };
    for (const p of this.platforms) {
      if (p.x + p.w <= cam.x || p.x >= cam.x + W) continue;
      if (p.kind === 'wheel' && G.gondola) { const sw = G.gondola.r.width / HD, sh = G.gondola.r.height / HD; g.drawImage(G.gondola.r, Math.round(p.x + p.w / 2 - sw / 2 - cam.x), Math.round(p.y - cam.y), sw, sh); continue; }
      if (p.kind === 'cart' && G.cart) { const sw = G.cart.r.width / HD, sh = G.cart.r.height / HD; g.drawImage(G.cart.r, Math.round(p.x + p.w / 2 - sw / 2 - cam.x), Math.round(p.y + p.h - sh - cam.y), sw, sh); continue; }
      plat(p.x, p.y, p.w, 0, p.kind === 'island' ? 'island' : 'plat');
    }
    // 観覧車の軸（中心）とスポーク
    for (const c of this.platforms.filter(p => p.kind === 'wheel' && p.phase === 0)) {
      if (c.cx + 60 < cam.x || c.cx - 60 > cam.x + W) continue;
      g.strokeStyle = '#c0b8a8'; g.lineWidth = 1; for (const q of this.platforms) if (q.kind === 'wheel' && q.cx === c.cx && q.cy === c.cy) { g.beginPath(); g.moveTo(Math.round(c.cx - cam.x), Math.round(c.cy - cam.y)); g.lineTo(Math.round(q.x + q.w / 2 - cam.x), Math.round(q.y + q.h / 2 - cam.y)); g.stroke(); }
      if (G.hub) { const sw = G.hub.r.width / HD, sh = G.hub.r.height / HD; g.drawImage(G.hub.r, Math.round(c.cx - sw / 2 - cam.x), Math.round(c.cy - sh / 2 - cam.y), sw, sh); }
      else { g.fillStyle = '#d9262b'; g.fillRect(Math.round(c.cx - 3 - cam.x), Math.round(c.cy - 3 - cam.y), 6, 6); }
    }
    for (const c of this.crumbles) if (c.state !== 'gone' && c.x + TILE > cam.x && c.x < cam.x + W) plat(c.x, c.y, TILE, c.shake, this.level.theme === 'candyforest' && G.candyplank ? 'candyplank' : 'plank');
    // 綿あめのトランポリン 'W' と糖蜜のノズル 'D'（第二章）
    { const map3 = this.level.map, tx0 = Math.floor(cam.x / TILE), tx1 = tx0 + W / TILE + 1;
      for (let ty = 0; ty < map3.height; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const c = map3.at(tx, ty);
        if (c !== 'W' && c !== 'D') continue;
        const spr = c === 'W' ? G.trampoline : G.dripper; const x = tx * TILE - cam.x, y = ty * TILE - cam.y;
        if (spr) { const sw = spr.r.width / HD, sh = spr.r.height / HD; g.drawImage(spr.r, Math.round(x + (TILE - sw) / 2), Math.round(c === 'W' ? y + TILE - sh : y), sw, sh); }
        else { g.fillStyle = c === 'W' ? '#f7b8d8' : '#7a0f1f'; g.fillRect(x, y + (c === 'W' ? TILE - 6 : 0), TILE, 6); }
      }
    }
    // プレス機: 吊り鎖 + ブロック（生成絵 tiles/press があれば使う）
    for (const q of this.presses) {
      if (q.x + q.w < cam.x || q.x > cam.x + W) continue;
      const x = q.x - cam.x, y = q.y - cam.y, cx = q.tx * TILE + TILE / 2 - cam.x;
      g.fillStyle = '#5d5d70'; for (let cy = q.topY - cam.y - 4; cy < y; cy += 4) g.fillRect(cx - 1, cy, 2, 3); // 鎖
      if (G.press) { const sw = G.press.r.width / HD, sh = G.press.r.height / HD; g.drawImage(G.press.r, Math.round(cx - sw / 2), Math.round(y), sw, sh); }
      else { g.fillStyle = '#4e4e60'; g.fillRect(x - 2, y, TILE + 4, q.hBlock); g.fillStyle = '#a5a5b8'; g.fillRect(x - 2, y, TILE + 4, 2); g.fillStyle = '#d9262b'; g.fillRect(x, y + q.hBlock - 3, TILE, 3); }
    }
    // ベルトコンベア: 地面タイルの上に動くストライプ
    { const map2 = this.level.map, bx0 = Math.floor(cam.x / TILE), bx1 = bx0 + W / TILE + 1;
      for (let ty = 0; ty < map2.height; ty++) for (let tx = bx0; tx <= bx1; tx++) {
        const c = map2.at(tx, ty); if (c !== ')' && c !== '(') continue;
        const x = tx * TILE - cam.x, y = ty * TILE - cam.y, dir = c === ')' ? 1 : -1, off = ((this.t * 30 * dir) % 8 + 8) % 8;
        if (G.belt) { const B = G.belt.r, bw = B.width / HD, bh = B.height / HD, sx = ((tx * TILE) % Math.max(1, Math.round(bw))) ; g.save(); g.beginPath(); g.rect(x, y - 2, TILE, bh + 2); g.clip(); g.drawImage(B, Math.round(x - sx), Math.round(y + TILE - bh), bw, bh); g.restore(); }
        else { g.fillStyle = '#2d1f4c'; g.fillRect(x, y, TILE, 4); }
        g.fillStyle = '#a5a5b8'; for (let s = -8; s < TILE; s += 8) { const sx = x + s + off; const w = Math.min(3, x + TILE - sx); if (sx >= x && w > 0) g.fillRect(sx, y + 1, w, 2); }
      }
    }
    // はしご（1 タイル 1 段。生成絵は 2 段分なので上半分／下半分を交互に使う）
    const map = this.level.map, tx0 = Math.floor(cam.x / TILE), tx1 = tx0 + W / TILE + 1;
    const th = THEMES[this.level.theme];
    for (let ty = 0; ty < map.height; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (map.at(tx, ty) !== 'L') continue;
      const x = tx * TILE - cam.x, y = ty * TILE - cam.y;
      if (G.ladder) { // 生成絵（2 段分、高さ ≈ 74 セル）を縦方向のテクスチャとして 1 タイル分ずつ切り出す（継ぎ目は横桟の周期でほぼ隠れる）
        const L = G.ladder.r, th16 = TILE * HD, srcY = (ty * th16) % L.height, h1 = Math.min(th16, L.height - srcY), dx = Math.round(x + TILE / 2 - L.width / HD / 2);
        g.drawImage(L, 0, srcY, L.width, h1, dx, Math.round(y), L.width / HD, h1 / HD);
        if (h1 < th16) g.drawImage(L, 0, 0, L.width, th16 - h1, dx, Math.round(y) + h1 / HD, L.width / HD, (th16 - h1) / HD);
        continue;
      }
      g.fillStyle = th.plat[0]; g.fillRect(x + 3, y, 2, TILE); g.fillRect(x + 11, y, 2, TILE);
      g.fillStyle = th.plat[1]; g.fillRect(x + 4, y + 3, 8, 2); g.fillRect(x + 4, y + 11, 8, 2);
    }
  }
  // 天候: 川面は雨（斜めの雨筋＋薄い霧で視界低下）
  drawWeather(g, cam) {
    if (this.level.theme === 'workshop') { // 綿雪: ゆっくり降る白い粒（決定論的）
      const t = this.t; g.save(); g.fillStyle = 'rgba(253,251,247,0.8)';
      for (let i = 0; i < 40; i++) { const s1 = (i * 7919) % 997 / 997, s2 = (i * 104729) % 991 / 991; const x = ((s1 * 300 + Math.sin(t * 0.7 + i) * 12 - cam.x * 0.2) % 300 + 300) % 300 - 20, y = ((s2 * 240 + t * 22) % 240); const sz = 1 + (i % 3) / 2; g.fillRect(Math.round(x), Math.round(y), sz, sz); }
      g.restore(); return;
    }
    if (this.level.theme !== 'river') return;
    const t = this.t; g.save(); g.globalAlpha = 0.35; g.strokeStyle = '#cbe8f0'; g.lineWidth = 1 / HD;
    g.beginPath();
    for (let i = 0; i < 70; i++) { // 決定論的な雨筋（i ごとの擬似乱数）: 落下速度 220/s、風で左へ 40/s
      const seed = (i * 7919) % 997 / 997, seed2 = (i * 104729) % 991 / 991;
      const x = ((seed * 320 - (t * 40 + cam.x * 0.3) % 320) % 320 + 320) % 320 - 32, y = ((seed2 * 260 + t * 220) % 260) - 20;
      g.moveTo(x, y); g.lineTo(x - 2, y + 9);
    }
    g.stroke(); g.restore();
    g.fillStyle = 'rgba(120,150,170,0.14)'; g.fillRect(0, 0, W, H); // 霧
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
