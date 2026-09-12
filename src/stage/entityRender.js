// エンティティの描画（Sprint P 後半）: stage/entities/* の draw メソッドをここへ移した。領域オブジェクトは状態と更新だけを持ち、描画基盤（gfx）への依存を持たない。
// 関数は旧メソッド本文そのまま（第 1 引数 e = 旧 this。super.draw は親クラスの関数呼び出し）。振る舞いは変えない（e2e/golden.spec.js の軌跡・画素ハッシュ・画廊で検査）。
// 描くときは drawEntity(e, g, …) を使う。クラス → 関数の表を継承をたどって解決する
import { PAL } from '../gfx/palette.js';
import { HD_SCALE, blit, tint } from '../gfx/sprite.js';
import { t } from '../shared/i18n.js';
import { Boss, GutsTeddy, MirrorQueen, Noir, Ringmaster, SerpentPart, WeepingDoll } from './entities/bosses.js';
import { Enemy, MERMAID_HEAD_ABOVE, MermaidDoll, MirrorLyrica, ZombieRabbit, ZombieSpawner } from './entities/enemies.js';
import { FloatingItem, Item, TreasureBox } from './entities/items.js';
import { CHARGE_T, CUTIN_SCALE, Cortege, CutIn, FirePillar, HeartBurst, HeartGarden, Meteor, MeteorCaster, MirrorFrame, SUPER, SUPER_COLOR, SUPER_T, ShadowClone, Shard, drawSpr } from './entities/magic.js';
import { Decals, Particles } from './entities/particles.js';
import { Player } from './entities/player.js';
import { EnemyShot, Fire, PlayerShot, PoisonPool } from './entities/projectiles.js';
import { H, W } from './viewport.js';

const flashCache = new Map();
function flashImg(img) {
  let f = flashCache.get(img); if (!f) { f = tint(img, '#fdfbf7'); flashCache.set(img, f); } return f;
}

// スプライトの描画サイズ（世界単位）。生成 PNG は 1/HD_SCALE
const dims = spr => spr.hd ? [spr.r.width / HD_SCALE, spr.r.height / HD_SCALE] : [spr.r.width, spr.r.height];

const S = 1 / HD_SCALE; // 1 スクリーン px の世界単位

// 強化魔法の生成素材（assets/sprites/magicfx/*, cutin/*）。無ければ従来の弾スプライトで描く
const mfx = A => A?.generated?.magicfx ?? {};

function drawEnemy(e, g, cam, assets) {
  const name = e.spriteName(); if (!name) return;
  const spr = assets.enemies[name] ?? assets.bosses[name] ?? (e.baseSprite && (assets.enemies[e.baseSprite] ?? assets.bosses[e.baseSprite])); if (!spr) return;
  // HD スプライトは寸法がコマごとに違いうる（doll1/doll2 等）ので、底辺中央を当たり判定の底辺中央に合わせる
  const ox = spr.hd ? (spr.w - e.w) / 2 : e.facing < 0 ? (spr.w - e.w - e.spriteOff[0]) : e.spriteOff[0];
  const oy = spr.hd ? spr.h - e.h : e.spriteOff[1];
  const fs = e.flashT > 0 ? { ...spr, r: flashImg(spr.r), l: flashImg(spr.l) } : spr;
  blit(g, fs, e.facing < 0, e.x - ox - cam.x, e.y - oy - cam.y);
}

function drawZombieRabbit(e, g, cam, assets) {
  if (e.rise > 0) {
    // 地面から迫り上がる（下をクリップ）
    const groundY = e.y + e.h; const up = Math.min(e.h + 2, (0.7 - e.rise) / 0.7 * (e.h + 2));
    g.save(); g.beginPath(); g.rect(0, 0, 9999, Math.floor(groundY - cam.y)); g.clip();
    const spr = assets.enemies.zombie1;
    blit(g, spr, e.facing < 0, e.x - e.spriteOff[0] - cam.x, groundY - up - cam.y); g.restore(); return;
  }
  drawEnemy(e, g, cam, assets);
}

function drawZombieSpawner(e) {}

function drawMermaidDoll(e, g, cam, assets) {
  // 水面より下は描かない（潜っている表現）
  // 水の絵は drawBog が水面タイルの 6 px 下から描く（top 行は y+6）ので、クリップもそこに合わせる。waterY で切ると
  // スプライトの切れた縁が水面の 6 px 上に浮いて見えた（2026-09-11 ユーザー報告）
  // IMP-026（2026-09-12）: 待機コマ mermaid1 は頭〜腰〜尾まで描いた縦長版（62x66）。当たり判定は 8x15 に固定したので（enemies.js MERMAID_W/H）、
  // 待機中は「頭頂 = 当たり判定の上端 − MERMAID_HEAD_ABOVE」で上寄せに置き、伸びた分は水面下へ沈める。跳躍コマ（mermaid2）は従来どおり底辺合わせ（drawEnemy）
  const surface = Math.floor(e.waterY + 6 - cam.y);
  const draw = () => {
    if (e.state !== 'lunge') {
      const spr = assets.enemies.mermaid1;
      if (spr?.hd) { const fs = e.flashT > 0 ? { ...spr, r: flashImg(spr.r), l: flashImg(spr.l) } : spr; blit(g, fs, e.facing < 0, e.x + e.w / 2 - spr.w / 2 - cam.x, e.y - MERMAID_HEAD_ABOVE - cam.y); return; }
    }
    drawEnemy(e, g, cam, assets);
  };
  g.save(); g.beginPath(); g.rect(0, 0, 9999, surface); g.clip(); draw(); g.restore();
  // 水面下の体は水を透かして薄く見せる（腰・尾が水中に続いている表現。当たり判定には影響しない）
  g.save(); g.beginPath(); g.rect(0, surface, 9999, 9999); g.clip(); g.globalAlpha = 0.3; draw(); g.restore();
}

function drawMirrorLyrica(e, g, cam, assets) {
  // 倒された後の不在中は軸の線だけ。復活の 1.5 秒前から軸の位置に薄く現れる（gone は enemies.js MirrorLyrica、MIRROR_RESPAWN_T で復活）
  if (e.gone > 1.5) { g.fillStyle = 'rgba(232,232,244,0.25)'; g.fillRect(Math.round(e.axis - cam.x), 0, 1, 224); return; }
  const sheet = assets.player[e.hist[0]?.costume ?? 'dress'] ?? assets.player.dress; const spr = sheet[e.frame] ?? sheet.idle; if (!spr) return;
  g.save(); g.globalAlpha = e.gone > 0 ? 0.75 * (1 - e.gone / 1.5) : 0.75; g.filter = 'saturate(0.2) brightness(1.15)';
  if (e.flashT > 0) g.filter = 'brightness(3)';
  blit(g, spr, e.mirrorFacing < 0, Math.floor(e.x + e.w / 2 - spr.w / 2 - cam.x), Math.floor(e.y + e.h - spr.h - cam.y));
  g.restore();
  // 鏡の軸（薄い光の線）
  g.fillStyle = 'rgba(232,232,244,0.25)'; g.fillRect(Math.round(e.axis - cam.x), 0, 1, 224);
}

function drawBoss(e, g, cam, assets) {
  if (e.dying && Math.floor(e.dieT * 14) % 2) { e.flashT = 0.1; }
  drawEnemy(e, g, cam, assets);
}

function drawWeepingDoll(e, g, cam, assets) {
  drawBoss(e, g, cam, assets);
  if (e.dying || e.state === 'enter') return;
  // 目から流れる血/酸
  const ex = Math.floor(e.x - cam.x), ey = Math.floor(e.y - cam.y);
  g.fillStyle = e.hpRatio < 0.5 ? PAL.K : PAL.U;
  const len = 6 + Math.floor(Math.sin(e.t * 6) * 2);
  g.fillRect(ex + 6, ey + 12, 1, len); g.fillRect(ex + 17, ey + 12, 1, len + 1);
  if (e.state === 'throw' && e.thrown) { g.fillStyle = PAL.K; g.fillRect(ex + (e.facing > 0 ? 24 : -2), ey + 22, 3, 3); }
}

function drawGutsTeddy(e, g, cam, assets) {
  if (e.state === 'belly' && !e.dying) {
    const sx = Math.floor(e.x - cam.x), sy = Math.floor(e.y - cam.y);
    g.fillStyle = PAL.K; g.fillRect(sx + 10, sy + 20, 14, 8); g.fillStyle = PAL.Z; g.fillRect(sx + 13, sy + 22, 8, 4);
  }
  drawBoss(e, g, cam, assets);
}

function drawNoir(e, g, cam, assets) {
  g.globalAlpha = e.alpha;
  drawBoss(e, g, cam, assets);
  g.globalAlpha = 1;
  if (!e.dying && e.alpha > 0.9) {
    // 血の涙
    const ex = Math.floor(e.x - cam.x), ey = Math.floor(e.y - cam.y);
    g.fillStyle = PAL.K; g.fillRect(ex + (e.facing < 0 ? 4 : 10), ey + 8, 1, 5 + Math.floor(Math.sin(e.t * 5) * 2));
  }
}

function drawSerpentPart(e, g, cam, assets) {
  const spr = assets.bosses?.[e.isTail ? 'serpent_tail' : 'serpent_body']; if (!spr) { g.fillStyle = '#5a94b4'; g.fillRect(Math.round(e.x - cam.x), Math.round(e.y - cam.y), e.w, e.h); return; }
  g.save(); g.beginPath(); g.rect(0, 0, 9999, Math.floor(e.head.waterY + 4 - cam.y)); g.clip();
  blit(g, spr, e.facing < 0, Math.round(e.x + e.w / 2 - spr.w / 2 - cam.x), Math.round(e.y + e.h / 2 - spr.h / 2 - cam.y));
  g.restore();
}

function drawRingmaster(e, g, cam, assets) {
  drawBoss(e, g, cam, assets);
  if (e.whipBox) { const b = e.whipBox; g.fillStyle = '#d9262b'; g.fillRect(Math.round(b.x - cam.x), Math.round(b.y + 4 - cam.y), b.w, 2); g.fillStyle = '#fdfbf7'; g.fillRect(Math.round((e.facing > 0 ? b.x + b.w - 6 : b.x) - cam.x), Math.round(b.y + 3 - cam.y), 6, 4); } // 鞭の軌跡
}

function drawMirrorQueen(e, g, cam, assets) {
  g.save(); g.globalAlpha = Math.max(0, Math.min(1, e.alpha)); drawBoss(e, g, cam, assets); g.restore();
  if (e.mirrorX !== null) { const spr = assets.bosses[e.spriteName()]; if (spr) { g.save(); g.globalAlpha = 0.5; g.filter = 'saturate(0.2) brightness(1.3)'; blit(g, spr, e.facing > 0, Math.round(e.mirrorX - spr.w / 2 - cam.x), Math.round(e.y + e.h - spr.h - cam.y)); g.restore(); } }
}

function drawTreasureBox(e, g, cam, sheet) {
  const bob = Math.floor(e.t * 3) % 2;
  blit(g, sheet.box, false, e.x + e.w / 2 - sheet.box.w / 2 - cam.x, e.y + e.h - sheet.box.h - cam.y + bob);
}

function drawItem(e, g, cam, sheet) {
  if (e.t > e.life - 2.5 && Math.floor(e.t * 10) % 2) return;
  const spr = sheet[e.kind]; if (!spr) return;
  blit(g, spr, false, e.x + e.w / 2 - spr.w / 2 - cam.x, e.y + e.h - spr.h - cam.y);
}

function drawFloatingItem(e, g, cam, sheet) {
  const spr = sheet[e.kind]; if (!spr) return; const bob = Math.sin(e.t * 3) * 2;
  blit(g, spr, false, e.x - cam.x, e.y + bob - cam.y);
}

function drawPlayerShot(e, g, cam, sheet) {
  const spr = e.charged ? sheet.charge : sheet[e.def.sprite];
  const img = e.dir < 0 ? spr.l : spr.r;
  g.save();
  const cx = Math.floor(e.x + e.w / 2 - cam.x), cy = Math.floor(e.y + e.h / 2 - cam.y);
  g.translate(cx, cy);
  if (e.type === 'star' || e.type === 'heart' || e.charged) g.rotate(e.t * (e.charged ? 6 : 14) * e.dir);
  if (e.type === 'candle') g.rotate(e.t * 8 * e.dir);
  const [dw, dh] = dims(spr);
  g.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  g.restore();
}

function drawFire(e, g, cam, sheet) {
  const spr = Math.floor(e.t * 12) % 2 ? sheet.fire1 : sheet.fire2;
  const [dw, dh] = dims(spr);
  g.drawImage(spr.r, Math.floor(e.x - cam.x), Math.floor(e.y + e.h - dh - cam.y), dw, dh);
}

function drawEnemyShot(e, g, cam, sheet) {
  const spr = sheet[e.def.sprite];
  const img = e.vx < 0 ? spr.l : spr.r;
  const cx = Math.floor(e.x + e.w / 2 - cam.x), cy = Math.floor(e.y + e.h / 2 - cam.y);
  const [dw, dh] = dims(spr);
  if (e.def.spin) {
    g.save(); g.translate(cx, cy); g.rotate(e.t * 10); g.drawImage(img, -dw / 2, -dh / 2, dw, dh); g.restore();
  } else g.drawImage(img, cx - Math.floor(dw / 2), cy - Math.floor(dh / 2), dw, dh);
}

function drawPoisonPool(e, g, cam, sheet) {
  const a = e.t > e.life - 0.8 ? (e.life - e.t) / 0.8 : 1;
  g.globalAlpha = a;
  const x = Math.floor(e.x - cam.x), y = Math.floor(e.y - cam.y);
  const spr = sheet?.pool;
  if (spr?.hd && e.color !== 'acid') {
    // 生成済みの毒溜まりスプライト（世界単位で 1/HD_SCALE）。泡の点滅は上に重ねる
    const [dw, dh] = dims(spr); g.drawImage(spr.r, x + e.w / 2 - dw / 2, y + e.h - dh + 1, dw, dh);
    if (Math.floor(e.t * 6) % 2) { g.fillStyle = PAL['1']; g.fillRect(x + 3 + Math.floor(e.t * 7) % 8, y, 1 / HD_SCALE * 2, 1 / HD_SCALE * 2); }
    g.globalAlpha = 1; return;
  }
  g.fillStyle = e.color === 'acid' ? PAL.U : PAL.T; g.fillRect(x, y + 1, e.w, 2);
  g.fillStyle = e.color === 'acid' ? PAL.I : PAL.A; g.fillRect(x + 2, y, e.w - 4, 1); g.fillRect(x + 1, y + 3, e.w - 2, 1);
  if (Math.floor(e.t * 6) % 2) { g.fillStyle = PAL['1']; g.fillRect(x + 3 + Math.floor(e.t * 7) % 8, y, 1, 1); }
  g.globalAlpha = 1;
}

function drawParticles(e, g, cam) {
  for (const p of e.list) {
    if (p.twinkle && Math.floor(p.life * 20) % 2) continue;
    g.fillStyle = p.color;
    const sz = (p.size + 1) * S; // 粒子は 2〜4 スクリーン px
    g.fillRect(Math.round((p.x - cam.x) / S) * S, Math.round((p.y - cam.y) / S) * S, sz, sz);
  }
}

function drawDecals(e, g, cam, W, H) {
  const K = HD_SCALE; const sx = Math.max(0, Math.floor(cam.x * K)), sw = Math.min(W * K, e.canvas.width - sx);
  if (sw <= 0) return;
  g.drawImage(e.canvas, sx, 0, sw, H * K, (sx - Math.floor(cam.x * K)) / K, 0, sw / K, H);
}

// 主人公の体（コマ・帽子・ほうき・溜めの光）。Player._drawBody から移動
function drawPlayerBody(e, g, cam, assets, dy) {
  const fr = e.frame();
  const sheet = assets.player[e.costume];
  let spr = sheet[fr] ?? sheet.idle; if (!spr) return;
  if (e.state === 'dying' && e.deathReason !== 'bog' && e.costume !== 'plain' && assets.player.nohat?.[fr]) spr = assets.player.nohat[fr]; // 帽子が飛ぶ間は帽子なし原画
  // スプライト箱の底辺中央を当たり判定の底辺中央に合わせる
  const px = Math.floor(e.centerX - spr.w / 2 - cam.x), py = Math.floor(e.y + e.h - spr.h - cam.y + dy);
  blit(g, spr, e.facing < 0, px, py);
  // 帽子は各コマの原画に描き込まれている（生成時に帽子ありで描かせ、脱落したコマだけ tools/derive_variants.py が合成）。
  // 実行時の重ね描きは二重になって浮くので行わない。死亡時のみ帽子なし原画に差し替えて帽子を飛ばす
  const hat = assets.hat; const hatDy = assets.hatTopOffset !== undefined ? -assets.hatTopOffset : -(hat.h - (hat.brim ?? 2)); // 帽子上端 = 髪上端 − hatTopOffset（元デザインの実測 3）。生成前の旧式: つばが髪に少しかかる
  if (e.state === 'dying' && e.deathReason !== 'bog' && e.costume !== 'plain') {
    // 帽子が飛ぶ
    const t = e.deathT; const hx = e.centerX - hat.w / 2 - cam.x + t * 20 * -e.facing, hy = py + (spr.headY ?? 0) + hatDy - (60 * t - 90 * t * t);
    blit(g, hat, e.facing < 0, hx, Math.min(hy, py + spr.h * 0.5));
  }
  if (e.broomT > 0) blit(g, assets.broom, e.facing < 0, e.centerX - assets.broom.w / 2 - cam.x, e.y + e.h - 4 - cam.y);
  if (e.chargeT > CHARGE_T && Math.floor(e.chargeT * 20) % 2) blit(g, assets.shots.charge, false, e.centerX + (e.facing > 0 ? 12 : -22) - cam.x, e.y + 8 - cam.y);
  if (e.chargeT >= SUPER_T) { // 強化魔法が出る合図: 生成した光輪（magicfx/aura、2 コマで回る）。無ければ円で描く
    const aura = assets.generated?.magicfx, spr = aura && (Math.floor(e.chargeT * 8) % 2 ? aura.aura2 : aura.aura1);
    const cx = e.centerX - cam.x, cy = e.y + e.h / 2 - cam.y;
    if (spr) {
      const w = spr.w ?? spr.r.width / 3, h = spr.h ?? spr.r.height / 3;
      g.save(); g.globalAlpha = 0.9; g.drawImage(spr.r, cx - w / 2, cy - h / 2, w, h); g.restore();
    } else {
      const r = 18 + Math.sin(e.chargeT * 14) * 3;
      g.save(); g.globalAlpha = 0.75; g.strokeStyle = '#ffe860'; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.4; g.strokeStyle = '#ff8fc8'; g.beginPath(); g.arc(cx, cy, r + 4, 0, Math.PI * 2); g.stroke(); g.restore();
    }
  }
}

function drawPlayer(e, g, cam, assets) {
  if (e.state === 'dead') return;
  if (e.state === 'dying' && e.deathReason === 'bog') {
    // 沼に沈む
    const sink = Math.min(24, e.deathT * 30);
    g.save(); g.beginPath(); g.rect(0, 0, 999, Math.floor(e.y + e.h - cam.y - 2)); g.clip();
    drawPlayerBody(e, g, cam, assets, sink); g.restore(); return;
  }
  if (e.state === 'dying') {
    if (e.deathT > 1.0 && Math.floor(e.deathT * 16) % 2) return; // 消えかけの点滅
  } else if (e.invT > 0 && Math.floor(e.invT * 18) % 2) return; // 無敵点滅
  drawPlayerBody(e, g, cam, assets, 0);
}

function drawMeteorCaster(e) {}

function drawMeteor(e, g, cam, sheet, A) {
  // 強化魔法（burst 付き）は生成した彗星スプライトを 2 コマで、通常は従来の meteor/star を使う
  const M = mfx(A), comet = e.burst ? (Math.floor(e.t * 12) % 2 ? M.comet2 : M.comet1) : null;
  const spr = comet ?? sheet.meteor ?? sheet.star;
  const dw = spr.hd ? spr.r.width / HD_SCALE : spr.r.width, dh = spr.hd ? spr.r.height / HD_SCALE : spr.r.height;
  const k = e.big ? 1.6 : 1; // 締めの巨大流星だけ大きく描く（整数倍でないため彗星のみ、輪郭のにじみは許容）
  g.save(); g.translate(Math.floor(e.x + e.w / 2 - cam.x), Math.floor(e.y + e.h / 2 - cam.y)); g.rotate(Math.atan2(e.vy, e.vx) + Math.PI / 2);
  g.drawImage(spr.r, -dw * k / 2, -dh * k / 2, dw * k, dh * k); g.restore();
}

function drawShadowClone(e, g, cam, A) {
  const p = e.player, sheet = A.player[p.costume] ?? A.player.dress, spr = sheet[p.frame()] ?? sheet.idle; if (!spr) return;
  // 周回中は撃つ向き（外向き）に反転して「鏡像」に見せる。通常の分身は主人公と同じ向き
  const flip = e.orbit ? Math.cos(e.theta) < 0 : p.facing < 0;
  g.save(); g.globalAlpha = e.orbit ? 0.55 + 0.25 * Math.sin(e.t * 14 + e.angle) : 0.45 + 0.15 * Math.sin(e.t * 10);
  blit(g, spr, flip, Math.floor(e.x + p.w / 2 - spr.w / 2 - cam.x), Math.floor(e.y + p.h - spr.h - cam.y));
  g.restore();

}

function drawHeartBurst(e, g, cam, A) {
  const r = e.radius, a = 1 - e.t / e.life;
  const M = mfx(A);
  if (e.art === 'starburst' && M.starburst1) { // 星屑の葬列の着弾
    const s = Math.floor(e.t * 14) % 2 ? M.starburst2 : M.starburst1;
    drawSpr(g, s, e.cx - cam.x, e.cy - cam.y, Math.max(0, a), 0);
    return;
  }
  if (e.art === 'petals' && M.petal1) { // 心臓の花園の破裂: 花びらが外向きに散る
    const petals = [M.petal1, M.petal2, M.petal3, M.petal4].filter(Boolean);
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * Math.PI * 2 + e.t * 2, d = r * (0.6 + 0.4 * Math.sin(i * 1.7));
      drawSpr(g, petals[i % petals.length], e.cx - cam.x + Math.cos(th) * d, e.cy - cam.y + Math.sin(th) * d * 0.7, Math.max(0, a), th);
    }
    return;
  }
  const spr = A.shots.burst;
  if (spr) { const s = (r * 2) / (spr.r.width / HD_SCALE); g.save(); g.globalAlpha = Math.max(0, a); g.translate(e.cx - cam.x, e.cy - cam.y); g.scale(s, s); g.drawImage(spr.r, -spr.r.width / HD_SCALE / 2, -spr.r.height / HD_SCALE / 2, spr.r.width / HD_SCALE, spr.r.height / HD_SCALE); g.restore(); return; }
  g.save(); g.globalAlpha = Math.max(0, a); g.strokeStyle = e.color; g.lineWidth = 3; g.beginPath(); g.arc(e.cx - cam.x, e.cy - cam.y, r, 0, Math.PI * 2); g.stroke(); g.restore();
}

// 咲いている間の花。生成素材（magicfx/flower1 蕾 → flower2 開花）があればそれを、無ければハートの弾を置く
function drawHeartGarden(e, g, cam, A) {
  const M = mfx(A), S = SUPER.heart;
  for (const s of e.seeds) {
    if (s.burst || e.t < s.plantAt) continue;
    const age = e.t - s.plantAt, k = Math.min(1, age / 0.25);
    const bloom = age > S.delay * 0.6; // 破裂の直前に開く
    const spr = (bloom ? M.flower2 : M.flower1) ?? A.shots?.heart;
    if (!spr) continue;
    const dw = spr.hd ? spr.r.width / HD_SCALE : spr.r.width, dh = spr.hd ? spr.r.height / HD_SCALE : spr.r.height;
    g.save(); g.globalAlpha = 0.75 + 0.25 * Math.sin(e.t * 18); // 脈打つ
    g.drawImage(spr.r, s.x - dw / 2 - cam.x, s.y - dh * k - cam.y, dw, dh * k); g.restore();
  }
}

function drawFirePillar(e, g, cam, sheet, A) {
  const bottom = e.y + e.h - cam.y, x = Math.floor(e.x + e.w / 2 - cam.x);
  const M = mfx(A);
  if (e.wax && M.waxpillar1) { // 蝋の聖歌隊: 蝋柱の中央帯を縦に繰り返して e.h まで伸ばす（拡大縮小しない）
    const wp = Math.floor(e.t * 10) % 2 ? M.waxpillar2 : M.waxpillar1;
    const S = 1 / HD_SCALE, sw = wp.r.width, sh = wp.r.height, w = sw * S;
    const k = Math.min(1, e.t / 0.2), target = e.h * k;
    const topH = sh * 0.5 * S, baseH = sh * 0.18 * S; // 上 = 炎、下 = 溶けた根元
    g.save(); g.globalAlpha = e.t > e.life - 0.4 ? Math.max(0, (e.life - e.t) / 0.4) : 1;
    let y = bottom - baseH;
    g.drawImage(wp.r, 0, sh * 0.82, sw, sh * 0.18, x - w / 2, y, w, baseH);        // 根元
    const bandH = sh * 0.22 * S, fill = Math.max(0, target - topH - baseH);
    for (let d = 0; d < fill; d += bandH) {                                          // 蝋の胴を繰り返す
      const hh = Math.min(bandH, fill - d);
      g.drawImage(wp.r, 0, sh * 0.55, sw, sh * 0.22 * (hh / bandH), x - w / 2, y - d - hh, w, hh);
    }
    y -= fill;
    g.drawImage(wp.r, 0, 0, sw, sh * 0.5, x - w / 2, y - topH, w, topH);            // 炎と上部
    // 根元で歌う蝋の聖歌隊（2 体、コマ違い）
    const choir = Math.floor(e.t * 6) % 2 ? M.choir2 : M.choir1;
    if (choir) { drawSpr(g, choir, x - w * 0.9, bottom - (choir.h ?? 0) / 2 - 2, 0.9); drawSpr(g, choir, x + w * 0.9, bottom - (choir.h ?? 0) / 2 - 2, 0.9); }
    g.restore(); return;
  }
  const spr = sheet.pillar;
  if (spr) { const dw = spr.r.width / HD_SCALE, dh = spr.r.height / HD_SCALE; const k = Math.min(1, e.t / 0.2); g.save(); g.globalAlpha = e.t > e.life - 0.3 ? (e.life - e.t) / 0.3 : 1; g.drawImage(spr.r, x - dw / 2, bottom - dh * k, dw, dh * k); g.restore(); return; }
  const f = Math.floor(e.t * 12) % 2 ? sheet.fire1 : sheet.fire2; const dw = f.r.width / HD_SCALE, dh = f.r.height / HD_SCALE;
  for (let yy = bottom; yy > e.y - cam.y; yy -= dh * 0.8) g.drawImage(f.r, x - dw / 2, yy - dh, dw, dh);
}

function drawMirrorFrame(e, g, cam, A) {
  if (e.t < 0) return;
  const M = mfx(A), spr = e.broke ? M.mirror2 : M.mirror1; if (!spr) return;
  const a = e.t > 0.5 ? Math.max(0, (0.75 - e.t) / 0.25) : 1;
  const h = spr.h ?? spr.r.height / HD_SCALE;
  drawSpr(g, spr, e.cx - cam.x, e.groundY - h / 2 - cam.y, a);
}

function drawCortege(e, g, cam, A) {
  const M = mfx(A), spr = Math.floor(e.t * 5) % 2 ? M.cortege2 : M.cortege1; if (!spr) return;
  const a = e.t < 0.3 ? e.t / 0.3 : e.t > 2.8 ? (3.2 - e.t) / 0.4 : 1;
  g.save(); g.globalAlpha = Math.max(0, a);
  blit(g, spr, e.dir > 0, Math.floor(e.x - spr.w / 2 - cam.x), Math.floor(e.y - spr.h / 2 - cam.y));
  g.restore();
}

function drawCutIn(e, g, A, W, H) {
  const spr = A?.generated?.cutin?.[e.name]; if (!spr) return;
  // 4 枚を 1 リクエストで描かせたため 1 枚は 92x130 セル前後（v2 = 尊重物 scene1 の画風に揃えた版は 125〜129x112〜117。IMP-022）。整数 2 倍で表示する（1 セル = 2 画面 px。art-standard §2.1 の整数倍表示）
  const w = (spr.w ?? spr.r.width / HD_SCALE) * CUTIN_SCALE, h = (spr.h ?? spr.r.height / HD_SCALE) * CUTIN_SCALE;
  // 地表の演出（火柱・花園・鏡像）を隠さないよう、帯は画面の上寄り 28% に置く（HUD 26 単位より下）
  const k = e.slide, x = Math.round(-w + (W * 0.52 + w) * k - w * 0.02), y = Math.round(H * 0.28);
  g.save();
  // 斜めの帯（下地）。絵の左右に伸びて画面を横断する
  g.globalAlpha = 0.7 * k; g.fillStyle = '#150a22';
  g.beginPath(); g.moveTo(0, y - 6); g.lineTo(W, y - 14); g.lineTo(W, y + h + 6); g.lineTo(0, y + h + 14); g.closePath(); g.fill();
  g.globalAlpha = k; g.drawImage(spr.r, x, y, w, h);
  // 枠線（武器色）
  g.globalAlpha = k; g.strokeStyle = SUPER_COLOR[e.kind]; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.restore();
}

function drawShard(e, g, cam, A) {
  const M = mfx(A), shards = [M.shard1, M.shard2, M.shard3, M.shard4].filter(Boolean);
  if (!shards.length) return;
  drawSpr(g, shards[e.i % shards.length], e.x - cam.x, e.y - cam.y, Math.max(0, 1 - e.t / 0.7), e.t * e.spin);
}

// クラス → 描画関数。サブクラスに専用の描画が無ければ親のものを使う（継承と同じ解決順）
const RENDERERS = new Map([
  [Enemy, drawEnemy],
  [ZombieRabbit, drawZombieRabbit],
  [ZombieSpawner, drawZombieSpawner],
  [MermaidDoll, drawMermaidDoll],
  [MirrorLyrica, drawMirrorLyrica],
  [Boss, drawBoss],
  [WeepingDoll, drawWeepingDoll],
  [GutsTeddy, drawGutsTeddy],
  [Noir, drawNoir],
  [SerpentPart, drawSerpentPart],
  [Ringmaster, drawRingmaster],
  [MirrorQueen, drawMirrorQueen],
  [TreasureBox, drawTreasureBox],
  [Item, drawItem],
  [FloatingItem, drawFloatingItem],
  [PlayerShot, drawPlayerShot],
  [Fire, drawFire],
  [EnemyShot, drawEnemyShot],
  [PoisonPool, drawPoisonPool],
  [Particles, drawParticles],
  [Decals, drawDecals],
  [Player, drawPlayer],
  [MeteorCaster, drawMeteorCaster],
  [Meteor, drawMeteor],
  [ShadowClone, drawShadowClone],
  [HeartBurst, drawHeartBurst],
  [HeartGarden, drawHeartGarden],
  [FirePillar, drawFirePillar],
  [MirrorFrame, drawMirrorFrame],
  [Cortege, drawCortege],
  [CutIn, drawCutIn],
  [Shard, drawShard],
]);
export function drawEntity(e, g, ...rest) {
  for (let c = e.constructor; c && c !== Object; c = Object.getPrototypeOf(c)) { const f = RENDERERS.get(c); if (f) return f(e, g, ...rest); }
}
