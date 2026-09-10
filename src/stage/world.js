import { TILE } from './physics.js';
import { parseLevel } from './level.js';
import { renderMapLayer } from '../gfx/tiles.js';
import { Particles, Decals } from './entities/particles.js';
import { Player } from './entities/player.js';
import { createEnemy } from './entities/enemies.js';
import { createBoss } from './entities/bosses.js';
import { TreasureBox, FloatingItem } from './entities/items.js';
import { EnemyShot, WEAPONS } from './entities/projectiles.js';
import { SONGS } from '../platform/audio.js';
import { sliceTileStrip, renderMapLayerHD, TILE_BANDS, buildBogHD, buildSpikeHD } from '../gfx/hdworld.js';
import { THEMES } from '../gfx/tiles.js';
import { SAFE_SHOT_T, LOOP2 } from './balance.js';
import { Fx } from './fx.js';
import { seedGame, hashSeed } from '../shared/util.js';
import { HD_SCALE as HD } from '../gfx/sprite.js';
import { MovingPlatform, CrumbleTile, PLATFORM, makeWheel, PressMachine, SyrupDripper } from './entities/gimmicks.js';
import { resolveDecoMap } from './decomap.js';
import { updateCamera, snapCamera } from './camera.js';
import { collide } from './collision.js';
import { drawWorld } from './render.js';
import { BOSS_NAMES } from '../content/story.js';
import { t } from '../shared/i18n.js';

export { W, H, SCALE } from './viewport.js'; // 旧来の import 元（camera.js・app・catalog）のために再公開
import { W, H } from './viewport.js';

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

  // 当たり判定と描画は別モジュールへ切り出した（stage/collision.js・stage/render.js）。ここは委譲だけ
  collide() { collide(this); }
  draw(g) { drawWorld(this, g); }

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


}
