#!/usr/bin/env python3
"""生成済み主人公スプライトから派生素材を作る（リクエスト不要）。

1. 帽子: base_hat（帽子あり）と idle（帽子なし）を足元中央で重ね、idle が透明な位置にある base_hat の画素 = 帽子。
2. 衣装: idle → idle_plain / idle_gold の重ね合わせで「色→色」の写像を多数決で学習し、全フレームへ適用。
   （SNES のパレットスワップ相当。髪・肌など変化しない色はそのまま）
出力: assets/sprites/player/hat.png, <frame>_plain.png, <frame>_gold.png と manifest 更新
"""
from __future__ import annotations
import json, collections
from pathlib import Path
from PIL import Image
import numpy as np
import optimize_pngs

ROOT = Path(__file__).resolve().parent.parent
SPR = ROOT / 'assets/sprites/player'; MANIFEST = ROOT / 'src/gfx/manifest.json'


def load(name): return Image.open(SPR / f'{name}.png').convert('RGBA')


def feet_center(im):
    """足元（最下 6 行）の不透明画素の x 重心。帽子のつばで幅が変わっても体の位置合わせに使える"""
    a = np.asarray(im.split()[3]) > 0; rows = a[-6:]
    xs = np.nonzero(rows)[1]
    return float(xs.mean()) if xs.size else im.width / 2


def overlay_offsets(a, b):
    """b を a に重ねるときの b の左上オフセット（足元重心と下端で合わせる）"""
    return (int(round(feet_center(a) - feet_center(b))), a.height - b.height)


def derive_hat():
    """base_hat から帽子だけを色で抜き出す。帽子色（暗藍・白帯・金具）かつ画像上部 55% にある画素を帽子とみなし、
    その bbox 内の帽子色でない小さな穴（髪が見える所）は透明のまま残す。"""
    base = load('idle'); a = np.asarray(base); h, w = a.shape[:2]  # idle は帽子あり
    rgb = a[..., :3].astype(int); al = a[..., 3] > 0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    indigo = (b > r + 10) & (r < 120) & (g < 110)                 # 帽子本体（暗い青紫）
    white = (r > 180) & (g > 180) & (b > 180)                      # 白いリボン帯
    gold = (r > 150) & (g > 100) & (b < 110) & (r > b + 60)        # 金具
    ys = np.arange(h)[:, None]
    hatmask = al & (indigo | white | gold) & (ys < h * 0.42)  # 目より上の領域だけ（顔の誤検出を避ける）。帽子は base_hat の 0.40 まで届く（0.30 だとつばの下 10 行が欠けた）
    # 帯・金具は本体に隣接するものだけ（髪のハイライト等の誤検出を避ける）
    yy, xx = np.nonzero(hatmask)
    if yy.size == 0: raise SystemExit('hat not found')
    y0, y1, x0, x1 = yy.min(), yy.max() + 1, xx.min(), xx.max() + 1
    out = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0)); op = out.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            if hatmask[y, x]: op[x - x0, y - y0] = tuple(int(v) for v in a[y, x])
    # 髪の上端（idle 側）との重なり: base_hat で帽子直下に髪が現れる行数 ≒ つばの下 6 行を髪にかぶせる
    meta = {'w': out.width, 'h': out.height, 'colors': len([c for c in out.getcolors(9999) if c[1][3] > 0]), 'fits': True, 'brim_overlap': 6}
    out.save(SPR / 'hat.png'); (SPR / 'hat.json').write_text(json.dumps(meta, indent=1))
    return meta


def hat_mask(im):
    a = np.asarray(im); al = a[..., 3] > 0; r, g, b = (a[..., i].astype(int) for i in range(3)); h = a.shape[0]
    ys = np.arange(h)[:, None]
    return al & (b > r + 10) & (r < 120) & (g < 110) & (ys < h * 0.45)  # 帽子は base_hat の行 0〜44/111（0.40）まで。0.30 で切るとつばの下 10 行が欠けて合成が浮く


def hair_top_center(im):
    """髪（ピンク系）の最上行とその x 中心"""
    a = np.asarray(im); al = a[..., 3] > 0; r, g, b = (a[..., i].astype(int) for i in range(3))
    pink = al & (r > 180) & (b > 120) & (g < r - 30)
    ys, xs = np.nonzero(pink)
    if ys.size == 0: return None
    # 髪の上端 = 桃色が 3 画素以上あり、かつ次の 2 行も桃色が続く最初の行（頭上の残像ノイズ 1〜3 画素を無視する。run4 で 32 行ずれた）
    rows = pink.sum(axis=1); top = None
    for y in range(len(rows) - 2):
        if rows[y] >= 3 and rows[y + 1] >= 3 and rows[y + 2] >= 3: top = y; break
    if top is None: top = int(ys.min())
    head = xs[(ys >= top) & (ys <= top + 25)]  # 頭部（髪上端から 25 セル）の x 中心。最上 3 行だと前髪の偏りで 6〜10 セルずれた
    return int(top), float((head.min() + head.max()) / 2)


_HAT_OFF = None
def hat_offsets_from_base():
    """base_hat.png（帽子込みの原画）から、帽子上端と髪上端の差（セル）、帽子中心と髪中心の x 差（セル）を測る"""
    global _HAT_OFF
    if _HAT_OFF is not None: return _HAT_OFF
    _HAT_OFF = (9, 0)
    src = SPR / 'base_hat.png'
    if not src.exists(): return _HAT_OFF
    im = Image.open(src).convert('RGBA'); a = np.asarray(im); al = a[..., 3] > 0
    r, g, b = (a[..., i].astype(int) for i in range(3)); h = a.shape[0]
    hat = al & (b > r + 10) & (r < 120) & (g < 110) & (np.arange(h)[:, None] < h * 0.4)
    pink = al & (r > 180) & (b > 120) & (g < r - 30)
    if hat.sum() < 20 or pink.sum() < 20: return _HAT_OFF
    hy, hx = np.nonzero(hat)
    hat_top = int(hy.min()); hat_cx = float((hx.min() + hx.max()) / 2)
    # 頭頂は帽子なし原画（idle_nohat）で測る。base_hat の見える髪の上端は帽子に隠れた分だけ低い。足元揃え・中央揃えで座標を合わせる
    nh = SPR / 'idle_nohat.png'
    if nh.exists():
        n = np.asarray(Image.open(nh).convert('RGBA')); nal = n[..., 3] > 0; nr, ng, nb = (n[..., i].astype(int) for i in range(3))
        npink = nal & (nr > 180) & (nb > 120) & (ng < nr - 30); ny, nx = np.nonzero(npink)
        crown = int(ny.min()) + (im.height - n.shape[0]); hd = nx[ny <= ny.min() + 25]; head_cx = float((hd.min() + hd.max()) / 2) + (im.width - n.shape[1]) / 2
    else:
        py, px = np.nonzero(pink); crown = int(py.min()); hd = px[py <= crown + 25]; head_cx = float((hd.min() + hd.max()) / 2)
    _HAT_OFF = (max(0, crown - hat_top), hat_cx - head_cx)
    print('hat offsets from base_hat: up', _HAT_OFF[0], 'dx', round(_HAT_OFF[1], 1))
    return _HAT_OFF


def ensure_hat(frame_name, hat_img):
    """帽子ありセットのフレームに帽子が無ければ、抽出済み帽子を髪の上に合成する。"""
    im = load(frame_name)
    # 帽子の有無: 最上部 15% の不透明画素のうち暗い藍色が半数以上なら帽子あり（髪だけなら桃色が支配的）
    a = np.asarray(im); al = a[..., 3] > 0; h = a.shape[0]; top = slice(0, max(1, int(h * 0.15)))
    r, g, b = (a[..., i].astype(int) for i in range(3)); ind = (b > r + 10) & (r < 120) & (g < 110)
    if al[top].sum() and (ind & al)[top].sum() / al[top].sum() > 0.5: return False
    ht = hair_top_center(im)
    if not ht: return False
    top, cx = ht
    # 位置は元デザイン（base_hat: 帽子を描き込んだ原画）の実測に合わせる: 帽子の上端は髪の上端より hat_up セル上、
    # 帽子の中心 x は髪の中心 x から hat_dx セルずれる（既定 9 / 0。base_hat があれば計測で上書き）
    hat_up, hat_dx = hat_offsets_from_base()
    hx = int(round(cx + hat_dx - hat_img.width / 2)); hy = int(round(top - hat_up))
    pad_top = max(0, -hy); pad_l = max(0, -hx); pad_r = max(0, hx + hat_img.width - im.width)
    canvas = Image.new('RGBA', (im.width + pad_l + pad_r, im.height + pad_top), (0, 0, 0, 0))
    canvas.paste(im, (pad_l, pad_top), im); canvas.paste(hat_img, (hx + pad_l, hy + pad_top), hat_img)
    canvas.save(SPR / f'{frame_name}.png'); return True


def flash_frame(im, k=0.55):
    """不透明画素を白へ k だけ寄せる（輪郭は残る）。SNES の被弾点滅相当"""
    a = np.asarray(im).astype(int).copy(); al = a[..., 3] > 0
    for c in range(3): a[..., c][al] = (a[..., c][al] * (1 - k) + 255 * k).astype(int)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def rule_map(im, target):
    """衣装色を規則で置換する（生成モデルが衣装変更を守らないため）。
    髪より下（高さ 42% 以下）に主に現れる桃〜赤紫色を衣装色とみなし、
    plain: 明るい色→白系、暗い色→紺  /  gold: 色相を金色へ回し明度は維持。"""
    import colorsys
    a = np.asarray(im); al = a[..., 3] > 0; h = a.shape[0]
    cols = {}
    for y in range(h):
        for x in range(a.shape[1]):
            if not al[y, x]: continue
            c = tuple(int(v) for v in a[y, x, :3]); cols.setdefault(c, []).append(y)
    mp = {}
    for c, ys in cols.items():
        r, g, b = (v / 255 for v in c); hh, l, sat = colorsys.rgb_to_hls(r, g, b)
        deg = hh * 360
        if not (sat > 0.35 and (deg >= 300 or deg <= 5)): continue           # 桃〜赤紫（肌の暖色は除外）
        if l > 0.8 and sat < 0.5: continue                                    # 肌のハイライト等
        if np.mean(ys) < h * 0.42: continue                                    # 髪・顔の位置に多い色は除外
        if target == 'plain':
            if l > 0.62: nl = 0.90 + (l - 0.62) * 0.2; nr, ng, nb = colorsys.hls_to_rgb(0.65, min(0.97, nl), 0.15)   # 白（わずかに青み）
            else: nr, ng, nb = colorsys.hls_to_rgb(0.62, max(0.18, l * 0.55), 0.55)                              # 紺
        else:
            nr, ng, nb = colorsys.hls_to_rgb(0.11, min(0.92, l * 1.05), min(1.0, sat * 1.1))                     # 金〜クリーム
        mp[c] = (int(nr * 255), int(ng * 255), int(nb * 255))
    return mp


def hair_colors(im, frac=0.42):
    """髪・顔の位置（上から frac まで）に主に現れる色の集合。衣装写像から外すためのガード。"""
    a = np.asarray(im); al = a[..., 3] > 0; h = a.shape[0]
    pos = {}
    for y in range(h):
        for x in range(a.shape[1]):
            if not al[y, x]: continue
            pos.setdefault(tuple(int(v) for v in a[y, x, :3]), []).append(y)
    return {c for c, ys in pos.items() if np.mean(ys) < h * frac}


def costume_map(frame_names, target, guard):
    """全コマから規則で衣装写像を作って束ねる（BUG-006 / ユーザー指摘 2026-09-10「衣装がゴールドになっていない」）。
    idle 1 コマから作った写像では、他のコマにしか出ないピンクの陰影（例 cast1 の #b85170）が置換されずに残る。
    rule_map は色 → 色の決定的な関数なので、コマごとに作って束ねても矛盾しない。guard（髪・顔の色）は除く。"""
    mp = {}
    for n in frame_names:
        p = SPR / f'{n}.png'
        if not p.exists(): continue
        for c, t in rule_map(Image.open(p).convert('RGBA'), target).items():
            if c in guard: continue
            mp[c] = t
    return mp


def learn_map(src, dst):
    """src と dst を足元中央で重ね、src 色 → dst 色 の多数決写像を作る（一致率 60% 未満の色は変えない）"""
    ox, oy = overlay_offsets(src, dst)  # dst を src 座標系へ: dst(x,y) は src(x+ox, y+oy)
    sp, dp = src.load(), dst.load(); votes = collections.defaultdict(collections.Counter)
    for y in range(src.height):
        for x in range(src.width):
            c = sp[x, y]
            if c[3] == 0: continue
            dx, dy = x - ox, y - oy
            if 0 <= dx < dst.width and 0 <= dy < dst.height and dp[dx, dy][3] > 0: votes[c[:3]][dp[dx, dy][:3]] += 1
    mp = {}
    for c, cnt in votes.items():
        tgt, n = cnt.most_common(1)[0]
        if n / sum(cnt.values()) >= 0.5 and tgt != c: mp[c] = tgt
    return mp


def apply_map(im, mp):
    out = im.copy(); px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            c = px[x, y]
            if c[3] and c[:3] in mp: t = mp[c[:3]]; px[x, y] = (t[0], t[1], t[2], 255)
    return out


# ---- BUG-006（2026-09-13）: 位置で判定する衣装置換 ----------------------------------------------------------
# 色 → 色の写像（rule_map / costume_map）だけでは直せなかった 3 点を、画素ごとの分類で直す:
#  (a) 髪の陰影（209,89,134）がスカートの襞にも使われ、髪ガードで残って白いスカートに桃色の斑が出る
#  (b) 前髪のハイライトに衣装の桃色（230,122,156）が使われ、白に化ける
#  (c) 襟・袖口・裾フリルのクリーム（251,237,232 / 236,227,216）は目の白・靴下・頬と同色で、色では区別できない
# 分類: 各コマで「髪確定色」（平均 y が高さの 30% より上・20 画素以上）と「衣装確定色」（桃〜赤紫で平均 y が 45% より下、
# 彩度 0.7 超か明度 0.3 未満 = 胴着の紅・濃影）を色から決め、候補画素は 5×5 近傍の確定色の多数決で髪／衣装に振り分ける
# （2 段: まず明るい桃、次に陰影・輪郭。同数は髪 = 変えない。高さ 30% より上は常に髪／帽子）。
# 縫い取り: クリームの連結成分のうち衣装画素に接するものだけ（襟・袖口・裾）。目の白・靴下・頬は衣装に接しないので残る。
# 私服のパレット（15 色以内に収めるため 3 色だけ足す。ADR-0041）: 白 (232,232,240)、紺 (38,57,122)、赤 (217,38,43)。
# 陰影は肌影 (204,122,141)、輪郭・濃影は靴の暗紫 (48,35,69) を共有する。
import colorsys

PLAIN_WHITE = (232, 232, 240); PLAIN_NAVY = (38, 57, 122); PLAIN_TRIM = (217, 38, 43)
PLAIN_SHADE = (196, 200, 216); PLAIN_DARK = (48, 35, 69)  # 白い布の陰影。当初は肌影 (204,122,141) を共有したが襞の多いコマで薄桃のスカートになった（ユーザー判断 2026-09-13: 案 1）
# 私服パレットの設計（実機のパレット差し替えと同じ考え方）: 髪の暗い 2 色 HAIR_FOLD を 1 色に畳んで 1 枝空け、白の陰影に使う。元絵の 12 色を不変にしたまま 3 色足すと布の陰影が持てなかった
HAIR_FOLD = {(184, 81, 112): (174, 61, 106)}
CREAMS = {(251, 237, 232), (236, 227, 216)}
EYE = (71, 58, 107)  # 瞳・靴の紐の暗紫。目の白（クリーム）を縫い取りから外す目印


def _hls(c):
    h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in c)); return h * 360, l, s


def is_costume_hue(c):
    """桃〜赤紫（肌の暖色は除外）。rule_map と同じ判定"""
    deg, l, s = _hls(c)
    if l >= 0.6 and s < 0.5: return False  # 肌影（204,122,141）は色だけでは衣装と決めない（is_rose: 肌・クリームに隣接しない画素だけ候補にする）
    return s > 0.35 and (deg >= 300 or deg <= 5) and not (l > 0.8 and s < 0.5)


def is_rose(c):
    """肌影と同じ薄い桃 (204,122,141) 系。run3s ではスカートの陰影が 437 画素この色で塗られていた（量子化で肌影と同色に）"""
    deg, l, s = _hls(c)
    return l >= 0.6 and 0.35 < s < 0.5 and (deg >= 300 or deg <= 5)


REF_ROLES = None  # 帽子なし idle から取った基準の (髪確定色, 衣装確定色)。帽子つきコマでは髪が高さの 30% より下に出て髪確定色が空になるので併用する


def color_roles(im):
    """コマ内の色を 髪確定 / 衣装確定 / 候補 に分ける（位置の統計から。基準コマの確定色も併用）"""
    a = np.asarray(im); al = a[..., 3] > 0; h = a.shape[0]
    pos = {}
    for y in range(h):
        for x in range(a.shape[1]):
            if al[y, x]: pos.setdefault(tuple(int(v) for v in a[y, x, :3]), []).append(y)
    hair, costume, cand = set(), set(), set()
    for c, ys in pos.items():
        if not is_costume_hue(c): continue
        my = float(np.mean(ys)); deg, l, s = _hls(c)
        if my < h * 0.30 and len(ys) >= 20: hair.add(c)
        elif my > h * 0.45 and (s > 0.7 or l < 0.3): costume.add(c)
        else: cand.add(c)
    if REF_ROLES:
        # 基準コマがあれば確定色は基準の集合だけにする。コマ単独の統計だと、髪が大きく高いコマ（run4・run3s・jump）で
        # スカートの襞にも使う (209,89,134) の平均 y が 30% より上になり髪確定色に入って、襞が 1 画素も変わらなかった（2026-09-13 計測）
        rh, rc = REF_ROLES; cand |= hair | costume; hair = rh & set(pos); costume = (rc & set(pos)) - hair; cand -= hair | costume
    return hair, costume, cand


def classify_costume(im, head_frac=0.0):
    """衣装画素のマスク（True = 衣装）。
    種: 髪確定色（H/p）= 髪、衣装確定色（胴着の紅・濃影）= 衣装、明るい桃（明度 0.6・彩度 0.6 以上）= 5×5 近傍に髪確定色が 2 個以上なら髪、
    それ以外は衣装（前髪のハイライトは髪、袖・スカートは衣装）。陰影・輪郭（209,89,134 / 174,61,106 / 184,81,112 など）は
    両方の種からの多ソース BFS（4 近傍、候補画素の上だけ）で近い側に振り分ける。どちらにも届かなければ髪 = 変えない。
    v1（5×5 多数決）はスカートが同数 → 髪で 440 画素残り、v2（確定色だけを種にした BFS）は髪が裾に接する左半分が髪に流れた（2026-09-13 計測）"""
    from collections import deque
    a = np.asarray(im); al = a[..., 3] > 0; h, w = a.shape[:2]
    hair, costume, cand = color_roles(im)
    bright = {c for c in cand if _hls(c)[1] >= 0.6 and _hls(c)[2] >= 0.6}
    col = [[tuple(int(v) for v in a[y, x, :3]) if al[y, x] else None for x in range(w)] for y in range(h)]
    label = np.zeros((h, w), np.int8)  # 0 未定, 1 髪, 2 衣装
    SKIN = (227, 190, 182)
    rose_ok = np.zeros((h, w), bool)  # 肌影色の画素のうち、肌・クリームに 8 近傍で接しないもの = スカートの陰影として候補に入れる（2026-09-13 案 1 の続き）
    for y in range(h):
        for x in range(w):
            c = col[y][x]
            if c is None or not is_rose(c): continue
            if not any(0 <= y + dy < h and 0 <= x + dx < w and (col[y + dy][x + dx] == SKIN or col[y + dy][x + dx] in CREAMS) for dy in (-1, 0, 1) for dx in (-1, 0, 1)): rose_ok[y, x] = True
    q = deque()
    for y in range(h):
        for x in range(w):
            c = col[y][x]
            if c in hair: label[y, x] = 1; q.append((y, x))
            elif y < h * head_frac: label[y, x] = 1; q.append((y, x))  # 帽子つきコマ（金）は上 30% を髪・帽子扱い（金にしない）。飾りリボンの紅がコマにより衣装確定色になって金になり走行中に点滅した。上 30% を全部衣装にすると帽子帯と髪の陰影まで金になった（2026-09-13 計測）。飾りの紅・濃紫は apply_costume で近い髪系色へ寄せて 15 色に収める
            elif c in costume: label[y, x] = 2; q.append((y, x))
            elif c in bright:
                # 5×5 に髪確定色が 2 個以上なら髪（前髪のハイライト 1 画素が 8 近傍 3 個の条件を満たさず衣装になり、接するクリームまで縫い取り色になった）
                hv = sum(1 for dy in range(-2, 3) for dx in range(-2, 3) if (dy or dx) and 0 <= y + dy < h and 0 <= x + dx < w and col[y + dy][x + dx] in hair)
                label[y, x] = 1 if hv >= 2 else 2; q.append((y, x))
    # 明るい桃で衣装と判定された 3 画素以下の孤立成分（8 近傍）は前髪・毛先のハイライト → 髪へ戻す（金衣装で前髪に金の斑が出た）
    seen = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            if seen[y, x] or label[y, x] != 2 or col[y][x] not in bright: continue
            comp = []; st = [(y, x)]; seen[y, x] = True
            while st:
                cy, cx = st.pop(); comp.append((cy, cx))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and label[ny, nx] == 2 and col[ny][nx] in bright: seen[ny, nx] = True; st.append((ny, nx))
            if len(comp) <= 3:
                for p in comp: label[p] = 1
    # クリーム（フリル・襟）は通過できるがラベルは付けない: jump ではスカート裏の陰影がフリルと脚に囲まれて届かず 299 画素が薄桃のまま残った
    passed = np.zeros((h, w), np.int8)
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if not (0 <= ny < h and 0 <= nx < w) or label[ny, nx]: continue
            c = col[ny][nx]; lab = label[y, x] if label[y, x] else passed[y, x]
            if c in CREAMS:
                if not passed[ny, nx]: passed[ny, nx] = lab; q.append((ny, nx))
                continue
            if not (c in cand or rose_ok[ny, nx]): continue
            label[ny, nx] = lab; q.append((ny, nx))
    stray = (label != 2) & np.array([[col[y][x] in costume for x in range(w)] for y in range(h)])  # 髪・帽子側に残った衣装確定色（飾りリボンの紅・濃紫、毛先の紅）
    return label == 2, (label == 1) & np.array([[col[y][x] in bright for x in range(w)] for y in range(h)]), hair, hair | cand | {PLAIN_DARK}, stray


def trim_mask(im, costume):
    """クリームの連結成分（4 近傍）のうち、衣装画素に 8 近傍で接するもの = 襟・袖口・裾フリル"""
    a = np.asarray(im); al = a[..., 3] > 0; h, w = a.shape[:2]
    cream = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            if al[y, x] and tuple(int(v) for v in a[y, x, :3]) in CREAMS: cream[y, x] = True
    seen = np.zeros((h, w), bool); out = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            if not cream[y, x] or seen[y, x]: continue
            comp = []; stack = [(y, x)]; seen[y, x] = True; touch = set(); eye = 0
            while stack:
                cy, cx = stack.pop(); comp.append((cy, cx))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if not (0 <= ny < h and 0 <= nx < w): continue
                        if costume[ny, nx] and not is_rose(tuple(int(v) for v in a[ny, nx, :3])): touch.add((ny, nx))  # 肌影色の衣装画素は数えない（腕のハイライトが縫い取りにならないように）
                        if al[ny, nx] and tuple(int(v) for v in a[ny, nx, :3]) == EYE: eye += 1
                        if cream[ny, nx] and not seen[ny, nx] and (dy == 0 or dx == 0): seen[ny, nx] = True; stack.append((ny, nx))
            # 実測（2026-09-13、idle/fall/cast1/run3s/attack）: 襟・袖口・裾は衣装画素との隣接 4〜43、瞳の色との隣接 0。
            # 目の白は衣装隣接 0〜1・瞳隣接 11〜28、杖の星は衣装隣接 2、詠唱の光と靴下は 120 画素超か衣装隣接 0
            if len(touch) >= 3 and eye == 0 and len(comp) <= 120:
                for p in comp: out[p] = True
    return out


def plain_color(c):
    deg, l, s = _hls(c)
    if l >= 0.6 and s >= 0.6: return PLAIN_WHITE       # 袖・スカートの地
    if l >= 0.55 or (l >= 0.6 and s < 0.6): return PLAIN_SHADE  # 襞・影（白の陰影。案 1 で肌影の共有をやめた）
    if s > 0.7: return PLAIN_NAVY                       # 胴着
    return PLAIN_DARK                                    # 輪郭・濃影（靴と共有）


GOLD_LIGHT = (247, 205, 120); GOLD_MID = (222, 160, 60); GOLD_DEEP = (197, 133, 9)


def gold_color(c):
    """金衣装は 3 色の固定ランプ＋輪郭は靴の暗紫を共有（連続写像だと 20 色を超えた。15 色以内）"""
    deg, l, s = _hls(c)
    if l >= 0.6 and s >= 0.6: return GOLD_LIGHT
    if l >= 0.55 or (l >= 0.6 and s < 0.6): return GOLD_MID  # 襞・影。肌影色はここへ来るのは is_rose で衣装と判定された画素（肌に接しないスカートの陰影）だけ
    if s > 0.7: return GOLD_DEEP
    return PLAIN_DARK


def apply_costume(im, target):
    """位置分類つきの衣装置換。target = 'plain' | 'gold'"""
    costume, hair_bright, hair, hairlike, stray = classify_costume(im, 0.30 if target == 'gold' else 0.0)
    trim = trim_mask(im, costume) if target == 'plain' else None
    nearest = lambda pool, c: min(pool, key=lambda hc: sum((a - b) ** 2 for a, b in zip(hc, c))) if pool else c
    nearest_hair = lambda c: nearest(hair, c)
    out = im.copy(); px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            c = px[x, y]
            if not c[3]: continue
            if trim is not None and trim[y, x]: px[x, y] = (*PLAIN_TRIM, 255); continue
            if hair_bright[y, x]: t = nearest_hair(c[:3]); px[x, y] = (t[0], t[1], t[2], 255); continue  # 髪に残る衣装色のハイライト（十数画素）は最も近い髪色へ寄せ、15 色に収める
            if stray[y, x]: t = nearest(hairlike - {c[:3]}, c[:3]); px[x, y] = (t[0], t[1], t[2], 255); continue  # 帽子飾り・毛先に残る衣装確定色（紅・濃紫）も近い髪系色へ（色数 15 のため）
            if target == 'plain' and c[:3] in HAIR_FOLD: t = HAIR_FOLD[c[:3]]; px[x, y] = (t[0], t[1], t[2], 255); continue  # 私服: 髪の暗い 2 色を 1 色に畳む（白の陰影に枝を回す）
            if costume[y, x]:
                t = plain_color(c[:3]) if target == 'plain' else gold_color(c[:3]); px[x, y] = (t[0], t[1], t[2], 255)
    return out


def main():
    manifest = json.loads(MANIFEST.read_text())
    hm = derive_hat(); manifest['player/hat'] = {'src': 'assets/sprites/player/hat.png', 'anchor': 'center', **hm}
    print('hat', hm)
    frames = ['idle', 'run1', 'run2', 'run3', 'run4', 'run1s', 'run3s', 'jump', 'fall', 'attack', 'crouch', 'hurt', 'hurt2', 'dead', 'cast1', 'cast2']  # run1s/run3s = 走り撃ち 2 コマ（IMP-016。通過ポーズは杖が描かれず不採用）、cast1/cast2 = 強化魔法の詠唱・発動（帽子は合成）
    hat_img = load('hat')
    # 走り撃ち run*s と詠唱 cast*: 帽子ありを別リクエストで描かせると寸法が揺れるため、帽子なしコマを複製して帽子を合成する（ensure_hat が後段で載せる）
    for n in ('run1s', 'run3s', 'cast1', 'cast2'):
        src = SPR / f'{n}_nohat.png'
        if src.exists() and not (SPR / f'{n}.png').exists():
            (SPR / f'{n}.png').write_bytes(src.read_bytes()); im = load(n)
            manifest[f'player/{n}'] = {'src': f'assets/sprites/player/{n}.png', 'w': im.width, 'h': im.height, 'anchor': 'bottom', 'fits': True, 'colors': len([c for c in im.getcolors(9999) if c[1][3] > 0])}
            print('run-shoot frame', n, '<- nohat copy (hat composited below)')
    # hurt2 = 被弾の点滅コマ。生成では「白く光る」指示が白い幽霊（帽子なし・別の顔）になったので、hurt を白へ 55% 寄せて作る（リクエスト不要、寸法は hurt と同一）
    for src, dst in (('hurt', 'hurt2'), ('hurt_nohat', 'hurt2_nohat')):
        if not (SPR / f'{src}.png').exists(): continue
        out = flash_frame(load(src)); out.save(SPR / f'{dst}.png')
        manifest[f'player/{dst}'] = {'src': f'assets/sprites/player/{dst}.png', 'w': out.width, 'h': out.height, 'anchor': 'bottom', 'fits': True, 'colors': len([c for c in out.getcolors(9999) if c[1][3] > 0])}
        print('flash frame', dst, '<-', src)
    for n in frames:
        if n in ('dead', 'hurt2') or not (SPR / f'{n}.png').exists(): continue  # hurt2 は hurt から派生（白寄せで帽子色が薄まり、帽子なしと誤判定されるので合成しない）
        if ensure_hat(n, hat_img):
            out = load(n); manifest[f'player/{n}'].update({'w': out.width, 'h': out.height}); print('hat composited onto', n)
    # plain: 帽子なしフレーム(*_nohat) に、全コマから作った衣装写像を適用（コマ固有の陰影も置換する）
    if (SPR / 'idle_nohat.png').exists():
        global REF_ROLES; rh, rc, _ = color_roles(load('idle_nohat')); REF_ROLES = (rh, rc); print('reference roles from idle_nohat: hair', sorted(rh), 'costume', sorted(rc))
        guard = hair_colors(load('idle_nohat'))
        mp = costume_map([f'{n}_nohat' for n in frames], 'plain', guard); print('plain mapped colors', len(mp))  # 旧: 色→色の写像（BUG-006 で位置分類 apply_costume に置換。写像は参考出力）
        for n in frames:
            src = SPR / f'{n}_nohat.png'
            if not src.exists(): continue
            out = apply_costume(Image.open(src).convert('RGBA'), 'plain'); out.save(SPR / f'{n}_plain.png')
            manifest[f'player/{n}_plain'] = {'src': f'assets/sprites/player/{n}_plain.png', 'w': out.width, 'h': out.height, 'anchor': 'bottom', 'fits': True, 'colors': len([c for c in out.getcolors(9999) if c[1][3] > 0])}
    # gold: 帽子ありフレームに、全コマから作った衣装写像を適用（帽子と髪の色は guard で除く）
    if (SPR / 'idle.png').exists():
        guard = hair_colors(load('idle_nohat'))
        mp = costume_map(frames, 'gold', guard); print('gold mapped colors', len(mp))  # 旧: 色→色の写像（BUG-006 で位置分類 apply_costume に置換）
        for n in frames:
            src = SPR / f'{n}.png'
            if not src.exists(): continue
            out = apply_costume(Image.open(src).convert('RGBA'), 'gold'); out.save(SPR / f'{n}_gold.png')
            manifest[f'player/{n}_gold'] = {'src': f'assets/sprites/player/{n}_gold.png', 'w': out.width, 'h': out.height, 'anchor': 'bottom', 'fits': True, 'colors': len([c for c in out.getcolors(9999) if c[1][3] > 0])}
    MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True)); print('manifest updated', len(manifest))
    optimize_pngs.main([str(SPR / '*.png')])  # 派生コマもパレット PNG に（可逆。IMP-019）


if __name__ == '__main__':
    main()
