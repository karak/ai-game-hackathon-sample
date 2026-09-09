#!/usr/bin/env python3
"""生成画像（1 セル = 16px の格子で描かれたドット絵）→ 論理ピクセル PNG。

縮小フィルタは使わない。グリッド周期を実測し、各セルの中心領域の最頻色をそのまま 1 画素にする。
docs/gen-pipeline.md §2 の I/F。

  postprocess.py RAW.png OUT.png --logical WxH [--cell 16] [--palette BASE.png] [--anchor bottom|center]
  postprocess.py RAW.png OUTDIR/ --logical WxH --split --names a,b [--palette BASE.png]
"""
from __future__ import annotations
import argparse, json, collections, sys
from pathlib import Path
import numpy as np
from PIL import Image


def bg_color(im):
    w, h = im.size; px = im.convert('RGB').load()
    # 上端の 3 点と左右中段を使う。下の角は地形帯や 4 体並びで絵が届くことがあるため使わない（帯の上 1/3 がキー残りになった実績）
    pts = [px[2, 2], px[w - 3, 2], px[w // 2, 2], px[w // 4, 2], px[3 * w // 4, 2], px[2, h // 3], px[w - 3, h // 3]]
    pts = [p for p in pts if p[1] > p[0] + 20 and p[1] > p[2] + 20] or pts  # 緑らしい点だけで平均
    return tuple(sum(p[i] for p in pts) // len(pts) for i in range(3))


def key_out(im, tol=60):
    im = im.convert('RGBA'); w, h = im.size; px = im.load(); bg = bg_color(im)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < tol or (g > 140 and g > r + 50 and g > b + 50):
                px[x, y] = (0, 0, 0, 0)
    return im


def _boundaries(profile, min_gap):
    """投影プロファイルの極大 = セル境界。近接する極大は強い方を残す。"""
    pos = profile[profile > 0]
    if pos.size == 0: return []
    thr = np.percentile(pos, 60) * 0.5
    idx = [i for i in range(1, len(profile) - 1) if profile[i] >= thr and profile[i] >= profile[i - 1] and profile[i] >= profile[i + 1]]
    out = []
    for i in idx:
        if out and i - out[-1] < min_gap:
            if profile[i] > profile[out[-1]]: out[-1] = i
        else: out.append(i)
    return out


def _snap_grid(detected, pitch, start, end):
    """start から pitch 刻みで格子線を置き、近く(±40%)に検出境界があればそこへスナップする。"""
    lines = [start]; det = np.array(detected, dtype=float) if detected else np.array([])
    x = start
    while True:
        nx = x + pitch
        if nx >= end - pitch * 0.5: break
        if det.size:
            d = np.abs(det - nx); j = int(np.argmin(d))
            if d[j] <= pitch * 0.4: nx = float(det[j])
        lines.append(int(round(nx))); x = nx
    lines.append(end)
    return lines


def extract_cells(im, min_gap=3):
    """不規則な格子のドット絵から論理画像を取り出す。
    列方向・行方向それぞれの色変化量の投影を取り、その極大位置をセル境界とみなす（格子が歪んでも追従）。
    各セルは内側 50% 領域の最頻色。縮小フィルタは使わない。戻り値: (論理画像, 中央値ピッチx, y)"""
    rgb = np.asarray(im.convert('RGB')).astype(int); a = np.asarray(im.split()[3]) > 0
    if not a.any(): return Image.new('RGBA', (1, 1), (0, 0, 0, 0)), 0, 0
    dx = np.abs(np.diff(rgb, axis=1)).sum(axis=2) * (a[:, 1:] | a[:, :-1])
    dy = np.abs(np.diff(rgb, axis=0)).sum(axis=2) * (a[1:, :] | a[:-1, :])
    colp = np.concatenate([[0], dx.sum(axis=0)]); rowp = np.concatenate([[0], dy.sum(axis=1)])
    ys, xs = np.nonzero(a); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rbx = [b for b in _boundaries(colp, min_gap) if x0 < b < x1]
    rby = [b for b in _boundaries(rowp, min_gap) if y0 < b < y1]
    # ピッチ = 検出境界の間隔の中央値。平坦部で境界が検出できない所は規則格子で補い、検出できた所は境界へスナップする
    pitch_x = float(np.median(np.diff([x0] + rbx + [x1]))) if len(rbx) > 3 else 8.0
    pitch_y = float(np.median(np.diff([y0] + rby + [y1]))) if len(rby) > 3 else 8.0
    bx = _snap_grid(rbx, pitch_x, x0, x1); by = _snap_grid(rby, pitch_y, y0, y1)
    gx, gy = np.diff(bx), np.diff(by)
    W, H = len(gx), len(gy)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); op = out.load()
    for j in range(H):
        ya, yb = by[j], by[j + 1]; my = max(1, (yb - ya) // 4); yl, yh = ya + my, max(ya + my + 1, yb - my)
        for i in range(W):
            xa, xb = bx[i], bx[i + 1]; mx = max(1, (xb - xa) // 4); xl, xh = xa + mx, max(xa + mx + 1, xb - mx)
            ra = a[yl:yh, xl:xh]
            if ra.size == 0 or ra.mean() < 0.5: continue
            cols = rgb[yl:yh, xl:xh][ra]
            q = cols // 16; keys, counts = np.unique(q, axis=0, return_counts=True)
            sel = cols[(q == keys[np.argmax(counts)]).all(axis=1)]
            c = sel.mean(axis=0).astype(int); op[i, j] = (int(c[0]), int(c[1]), int(c[2]), 255)
    return out, float(np.median(gx)), float(np.median(gy))


def quantize_shared(im, colors=15, palette=None):
    """不透明画素を colors 色へ。palette 指定時はその PNG の色集合へ最近傍写像（フレーム間でパレット共有）。"""
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    opaque = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] > 0]
    if not opaque: return im
    if palette and Path(palette).exists():
        pal = [c[:3] for _, c in Image.open(palette).convert('RGBA').getcolors(99999) if c[3] > 0]
        arr = np.array(pal)
        for x, y in opaque:
            r, g, b, _ = px[x, y]; d = ((arr - np.array([r, g, b])) ** 2).sum(axis=1)
            c = pal[int(np.argmin(d))]; px[x, y] = (int(c[0]), int(c[1]), int(c[2]), 255)
        return im
    src = Image.new('RGB', (len(opaque), 1)); src.putdata([px[p][:3] for p in opaque])
    q = src.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    data = list(q.get_flattened_data()) if hasattr(q, 'get_flattened_data') else list(q.getdata())
    for p, c in zip(opaque, data): px[p] = (int(c[0]), int(c[1]), int(c[2]), 255)
    return im


def strip_shadow(logical):
    """足元の落ち影（最下部の幅広い暗い横帯）を除去する。"""
    a = logical.split()[3]; w, h = logical.size; px = logical.load()
    def row_span(y):
        xs = [x for x in range(w) if px[x, y][3] > 0]
        return (min(xs), max(xs)) if xs else None
    bb = a.getbbox()
    if not bb: return logical
    bottom = bb[3] - 1
    for y in range(bottom, max(bb[1], bottom - 4), -1):
        sp = row_span(y); ref = row_span(y - 3)
        if not sp or not ref: break
        dark = sum(1 for x in range(sp[0], sp[1] + 1) if px[x, y][3] > 0 and sum(px[x, y][:3]) < 300)
        wide = (sp[1] - sp[0]) > (ref[1] - ref[0]) * 1.25
        if wide and dark > (sp[1] - sp[0]) * 0.6:
            for x in range(w): px[x, y] = (0, 0, 0, 0)
        else: break
    return logical


def split_frames(logical, min_gap=2, min_width=8, expect=0):
    return [f[:2] for f in split_frames_masked(logical, min_gap, min_width, expect)]


def split_frames_masked(logical, min_gap=2, min_width=8, expect=0):
    """フレーム分割。透明列だけでは x が重なる物体（枝が隣にかかる等）を分けられないので、
    8 近傍の連結成分を取り、bbox が min_gap 以内で重なる成分は同じフレームに併合する。左から順に返す。"""
    a = np.asarray(logical.split()[3]) > 0; h, w = a.shape
    labels = np.zeros((h, w), dtype=np.int32); comps = []
    for y in range(h):
        for x in range(w):
            if not a[y, x] or labels[y, x]: continue
            idx = len(comps) + 1; stack = [(y, x)]; labels[y, x] = idx; x0 = x1 = x; y0 = y1 = y; n = 0
            while stack:
                cy, cx = stack.pop(); n += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and a[ny, nx] and not labels[ny, nx]: labels[ny, nx] = idx; stack.append((ny, nx))
            comps.append([x0, x1 + 1, y0, y1 + 1, n, idx])
    if not comps: return []
    # 大きい成分から順に、bbox が近接する小成分を併合（血しぶきの飛沫など）。各グループは成分ラベルの集合も持つ
    comps.sort(key=lambda c: -c[4]); groups = []
    for c in comps:
        for gph in groups:
            if c[0] <= gph[1] + min_gap and c[1] >= gph[0] - min_gap and c[2] <= gph[3] + min_gap * 3 and c[3] >= gph[2] - min_gap * 3:
                gph[0], gph[1], gph[2], gph[3] = min(gph[0], c[0]), max(gph[1], c[1]), min(gph[2], c[2]), max(gph[3], c[3]); gph[4].add(c[5]); break
        else: groups.append(list(c[:4]) + [{c[5]}])
    frames = sorted([(g0, g1, ids) for g0, g1, _, _, ids in groups if g1 - g0 >= min_width], key=lambda f: f[:2])
    # 1 コマ指定なら、離れた付属物（浮遊するハート・飛沫など）も含めて 1 コマにまとめる
    if expect == 1 and len(frames) > 1: frames = [(min(f[0] for f in frames), max(f[1] for f in frames), set().union(*(f[2] for f in frames)))]
    # 期待コマ数があるとき、画素数が最大コマの 3% 未満の「コマ」は欠片（飛沫・杖の火花など）とみなし最寄りのコマに帰属させる
    if expect and len(frames) > 1:
        size = {c[5]: c[4] for c in comps}; cnt = [sum(size[i] for i in f[2]) for f in frames]; big = max(cnt)
        keep = [f for f, n in zip(frames, cnt) if n >= big * 0.03]; debris = [f for f, n in zip(frames, cnt) if n < big * 0.03]
        for f in debris:
            cx = (f[0] + f[1]) / 2; near = min(keep, key=lambda k: abs((k[0] + k[1]) / 2 - cx)); near[2].update(f[2])
        frames = keep
    # 期待フレーム数に足りない場合、最も幅の広いフレームを「列占有が最小の位置」で割る（接触した物体の分離）
    occ = a.sum(axis=0)
    while expect and len(frames) < expect and frames:
        i = max(range(len(frames)), key=lambda k: frames[k][1] - frames[k][0]); x0, x1, ids = frames[i]
        if x1 - x0 < min_width * 2: break
        cut = min(range(x0 + min_width, x1 - min_width), key=lambda x: (occ[x], abs(x - (x0 + x1) / 2)))
        frames[i:i + 1] = [(x0, cut, ids), (cut, x1, ids)]
    # 幅 min_width 未満で捨てられた小グループ（柱の先端・飛沫など）は、中心 x を含むコマに帰属させる（x 範囲切りだった頃と同じ扱い）
    used = set().union(*(f[2] for f in frames)) if frames else set()
    for g0, g1, _, _, ids in groups:
        if ids & used: continue
        cx = (g0 + g1) / 2
        for f in frames:
            if f[0] <= cx < f[1]: f[2].update(ids); break
    # マスク: そのコマに属する成分だけ（x 範囲で切っただけだと、隣コマの飛び出た部品＝balloons の目玉が carousel に混入する: BUG-013）
    out = []
    for x0, x1, ids in frames:
        m = np.isin(labels, list(ids)); m[:, :x0] = False; m[:, x1:] = False; out.append((x0, x1, m))
    return out




def crop_key(im, tol=15):
    """キー色の余白を落として、絵の矩形だけを残す（不透明パネル = カットイン向け）。
    nokey で読んだ一枚絵は緑背景が絵として残るため、緑でない画素の外接矩形に切る。
    モデルは純緑ではなく「くすんだ緑の額縁」を描くこともあるので、緑寄り（g が r と b より tol 以上大きい）を余白とみなす。
    絵の内側にある緑（草・茎）は外接矩形に影響しない。"""
    a = np.asarray(im.convert('RGB')).astype(int)
    green = (a[..., 1] - a[..., 0] > tol) & (a[..., 1] - a[..., 2] > tol) & (a[..., 1] > 90)
    keep = ~green
    ys, xs = np.nonzero(keep)
    if ys.size == 0: return im
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    if box != (0, 0, im.width, im.height): print(f'  cropped key margin to {box[2]-box[0]}x{box[3]-box[1]}')
    return im.crop(box)


def strip_top_banner(im, max_frac=0.2, flat=0.6):
    """パネル上端に焼き込まれた題名の帯を落とす。
    帯は「行の画素の 60% 以上が 2 色以内」で占められる平坦な背景＋文字なので、上端からその条件が続く行数を切る。
    絵（ディザの空・格子模様）は色数が多いので条件を満たさない。"""
    a = np.asarray(im.convert('RGB')).astype(int); h, w = a.shape[:2]
    lim = int(h * max_frac); k = 0
    while k < lim:
        row = a[k].reshape(-1, 3)
        cnt = collections.Counter(map(tuple, row.tolist()))
        if sum(n for _, n in cnt.most_common(2)) < w * flat: break
        k += 1
    if k >= 3:
        print(f'  stripped top banner {k} rows')
        return im.crop((0, k, w, h))
    return im


def trim_border(im, max_px=8, std_max=6):
    """外周から内側へ、色がほぼ一様な行・列を縁とみなして落とす（各辺最大 max_px）。額縁を描いてしまった一枚絵に使う"""
    a = np.asarray(im.convert('RGB')).astype(int); h, w = a.shape[:2]; t = b = l = r = 0
    while t < max_px and a[t, :, :].std(axis=0).mean() < std_max: t += 1
    while b < max_px and a[h - 1 - b, :, :].std(axis=0).mean() < std_max: b += 1
    while l < max_px and a[:, l, :].std(axis=0).mean() < std_max: l += 1
    while r < max_px and a[:, w - 1 - r, :].std(axis=0).mean() < std_max: r += 1
    if t + b + l + r: print(f'  trimmed border t{t} b{b} l{l} r{r}')
    return im.crop((l, t, w - r, h - b))


def strip_caption(im, max_h=16, gap=2):
    """モデルが描き足すラベル文字（物体の下に離れて置かれた高さ max_h 以下の塊）を落とす。
    下から見て最初の空行ギャップ（gap 行以上）より下の塊が max_h 行以下なら透明にする。"""
    a = np.asarray(im.split()[3]) > 0; h = a.shape[0]
    occ = a.any(axis=1)
    rows = np.where(occ)[0]
    if rows.size == 0: return im
    # 上側のラベル（物体の上に離れて置かれた高さ max_h 以下の塊）も落とす
    top0 = rows[0]; y2 = top0
    while y2 + 1 < h and occ[y2 + 1]: y2 += 1
    blob_top_h = y2 - top0 + 1; g1 = y2 + 1; n1 = 0
    while g1 < h and not occ[g1]: g1 += 1; n1 += 1
    if n1 >= gap and g1 < h and (blob_top_h <= max_h or a[top0:y2 + 1].sum() < 12):
        px = im.load()
        for yy in range(top0, y2 + 1):
            for xx in range(im.width): px[xx, yy] = (0, 0, 0, 0)
        a = np.asarray(im.split()[3]) > 0; occ = a.any(axis=1); rows = np.where(occ)[0]
    bottom = rows[-1]
    # 下の塊の上端を探す
    y = bottom
    while y > 0 and occ[y - 1]: y -= 1
    blob_h = bottom - y + 1
    # その上に gap 行以上の空きがあり、さらに上に本体があるか
    g0 = y - 1; n = 0
    while g0 >= 0 and not occ[g0]: g0 -= 1; n += 1
    if n >= gap and g0 >= 0 and blob_h <= max_h:
        px = im.load()
        for yy in range(y, bottom + 1):
            for xx in range(im.width): px[xx, yy] = (0, 0, 0, 0)
    return im


def fill_holes(im):
    """外周に繋がらない透明領域（キーで抜けた内部の穴。墓石の灰緑の石面など）を、隣接する不透明色で埋める。"""
    a = np.asarray(im.split()[3]) > 0; h, w = a.shape
    outside = np.zeros_like(a); stack = [(y, x) for y in range(h) for x in (0, w - 1) if not a[y, x]] + [(y, x) for x in range(w) for y in (0, h - 1) if not a[y, x]]
    for y, x in stack: outside[y, x] = True
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not a[ny, nx] and not outside[ny, nx]: outside[ny, nx] = True; stack.append((ny, nx))
    holes = (~a) & (~outside)
    if not holes.any(): return im, 0
    px = im.load(); n = int(holes.sum())
    # 穴の縁から内側へ、隣の不透明色をコピーして埋める（数回繰り返す）
    for _ in range(max(h, w)):
        ys, xs = np.nonzero(holes)
        if ys.size == 0: break
        filled = False
        for y, x in zip(ys, xs):
            for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and not holes[ny, nx] and px[nx, ny][3] > 0: px[x, y] = px[nx, ny]; holes[y, x] = False; filled = True; break
        if not filled: break
    return im, n


def trim_thin_bottom(im, frac=0.12):
    """下端の細い行（最大幅の frac 未満の不透明数: 血の滴など）を落として、接地面を幅の広い部分にする。"""
    a = np.asarray(im.split()[3]) > 0; rows = a.sum(axis=1); mx = rows.max() if rows.size else 0
    y = im.height
    while y > 1 and rows[y - 1] < mx * frac: y -= 1
    return im.crop((0, 0, im.width, y)) if y < im.height else im


def crop_alpha(im):
    bb = im.split()[3].getbbox(); return im.crop(bb) if bb else im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('--logical', required=True, help='最大 WxH（検査用）')
    ap.add_argument('--palette'); ap.add_argument('--colors', type=int, default=15); ap.add_argument('--anchor', default='bottom')
    ap.add_argument('--split', action='store_true'); ap.add_argument('--names', default=''); ap.add_argument('--tol', type=int, default=60)
    ap.add_argument('--nokey', action='store_true', help='クロマキーしない（空などキャンバス全面の絵）')
    ap.add_argument('--keep-bottom', type=float, default=0, help='論理画像の下側この比率だけ残す（背景中景の月などを除く）')
    ap.add_argument('--nosplit', action='store_true', help='複数物体でも 1 枚として扱う（背景層・タイル帯）')
    ap.add_argument('--strip-caption', action='store_true', help='物体の下に描き足されたラベル文字を落とす')
    ap.add_argument('--fill-holes', action='store_true', help='キーで抜けた内部の穴を隣接色で埋める（装飾・キャラ）')
    ap.add_argument('--trim-border', action='store_true', help='外周の一様色の縁（額縁）を最大 8 px 落とす（nokey の一枚絵向け）')
    ap.add_argument('--crop-key', action='store_true', help='キー色（純緑）の余白を落として絵の矩形だけ残す（nokey の不透明パネル = カットイン）')
    ap.add_argument('--grid', help='RxC の格子に並んだ不透明パネルを、緑の隙間で切って個別に処理する（1 リクエストで 4 枚のカットインを同じ画風で描かせる用）')
    ap.add_argument('--crop-top', type=int, default=0, help='各パネルの上端をこのセル数だけ切る（モデルが焼き込んだ題名の帯を落とす。実測 11〜12 セル）')
    ap.add_argument('--trim-thin-bottom', action='store_true', help='下端の細い滴などを落として接地面を広い部分にする（血溜まり）')
    a = ap.parse_args()
    bw, bh = (int(v) for v in a.logical.split('x'))
    if a.grid:
        sys.exit(grid_main(a, bw, bh))
    im = Image.open(a.src).convert('RGBA') if a.nokey else key_out(Image.open(a.src), a.tol)
    logical, px, py = extract_cells(im)
    if a.crop_key: logical = trim_border(crop_key(logical), max_px=28, std_max=10)  # 純緑の余白を落としてから、モデルが描いた一様色の縁（くすんだ緑など）も落とす
    if a.trim_border: logical = trim_border(logical)
    if a.keep_bottom: logical = logical.crop((0, int(logical.height * (1 - a.keep_bottom)), logical.width, logical.height))
    if not a.nokey and not a.keep_bottom: logical = strip_shadow(logical)
    logical = quantize_shared(logical, a.colors, a.palette)
    meta = {'source': a.src, 'pitch': [px, py], 'max_box': [bw, bh]}
    def info(img):
        return {'w': img.width, 'h': img.height, 'fits': img.width <= bw and img.height <= bh, 'colors': len([c for c in img.getcolors(99999) if c[1][3] > 0])}
    if not a.split:
        fr = [] if a.nosplit else split_frames(logical, min_gap=2, min_width=8)
        if len(fr) >= 2:  # 複数物体が描かれた場合は不透明画素が最も多い 1 体（浮遊するハート等の付属物や余分な体は捨てる）
            occ = (np.asarray(logical.split()[3]) > 0).sum(axis=0)
            x0, x1 = max(fr, key=lambda f: int(occ[f[0]:f[1]].sum()))
            logical = logical.crop((x0, 0, x1, logical.height))
        if a.fill_holes: logical, nh = fill_holes(logical); nh and print(f'  filled {nh} hole cells')
        out = crop_alpha(logical)
        if a.trim_thin_bottom: out = trim_thin_bottom(out)
        out.save(a.dst); meta.update(info(out))
        Path(a.dst).with_suffix('.json').write_text(json.dumps(meta, indent=1)); print(json.dumps(meta)); return
    names = a.names.split(',') if a.names else []
    frames = split_frames_masked(logical, min_gap=2, min_width=8, expect=len(names)); names = names or [f'f{i}' for i in range(len(frames))]
    Path(a.dst).mkdir(parents=True, exist_ok=True); meta['frames'] = []
    for i, (x0, x1, mask) in enumerate(frames[:len(names)]):
        arr = np.asarray(logical).copy(); arr[~mask] = 0  # 隣コマに属する成分を消す
        out = Image.fromarray(arr, 'RGBA').crop((x0, 0, x1, logical.height))
        if a.strip_caption: out = strip_caption(out)
        if a.fill_holes: out, nh = fill_holes(out); nh and print(f'  filled {nh} hole cells in {names[i]}')
        out = crop_alpha(out)
        if a.trim_thin_bottom: out = trim_thin_bottom(out)
        out.save(Path(a.dst) / f'{names[i]}.png'); fi = info(out); fi['name'] = names[i]; meta['frames'].append(fi)
        (Path(a.dst) / f'{names[i]}.json').write_text(json.dumps({**meta, **fi, 'frames': None}, indent=1))
    (Path(a.dst) / '_meta.json').write_text(json.dumps(meta, indent=1)); print(json.dumps(meta))


def grid_bands(mask, min_gap=8, min_size=40):
    """不透明マスクの投影から、内容が続く帯（開始, 終了）を返す。帯の間に min_gap 以上の空白があれば別の帯。"""
    occ = mask.any(axis=1) if mask.ndim == 2 else mask
    bands = []; start = None; gap = 0
    for i, v in enumerate(occ):
        if v:
            if start is None: start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                if i - gap - start >= min_size: bands.append((start, i - gap))
                start = None; gap = 0
    if start is not None and len(occ) - start >= min_size: bands.append((start, len(occ)))
    return bands


def grid_main(a, bw, bh):
    """格子に並んだ不透明パネル（カットイン 4 枚など）を緑の隙間で切り、パネルごとにセル抽出・量子化して保存する。
    1 リクエストで全パネルを描かせられるので、パネル間で画風が揃う（ユーザー指示 2026-09-10）。"""
    rows, cols = (int(v) for v in a.grid.lower().split('x'))
    keyed = key_out(Image.open(a.src), a.tol)
    al = np.asarray(keyed.split()[3]) > 0
    ybands = grid_bands(al, min_gap=6, min_size=60)
    names = (a.names or '').split(',') if a.names else []
    Path(a.dst).mkdir(parents=True, exist_ok=True)
    meta = {'source': a.src, 'grid': [rows, cols], 'frames': []}
    if len(ybands) != rows:
        print(f'  WARN grid: 行の帯が {len(ybands)} 本（期待 {rows}）: {ybands}')
    panels = []
    for (y0, y1) in ybands[:rows]:
        band = al[y0:y1]
        xbands = grid_bands(band.T, min_gap=6, min_size=60)
        if len(xbands) != cols: print(f'  WARN grid: 行 {y0}-{y1} の列の帯が {len(xbands)} 本（期待 {cols}）: {xbands}')
        for (x0, x1) in xbands[:cols]: panels.append((x0, y0, x1, y1))
    for i, (x0, y0, x1, y1) in enumerate(panels):
        name = names[i] if i < len(names) else f'p{i}'
        sub = Image.open(a.src).convert('RGBA').crop((x0, y0, x1, y1))
        logical, px, py = extract_cells(sub)
        logical = trim_border(crop_key(logical), max_px=28, std_max=10)   # パネルの外に残った緑・一様色の縁を落とす
        if a.crop_top and logical.height > a.crop_top * 2: logical = logical.crop((0, a.crop_top, logical.width, logical.height))  # 焼き込まれた題名の帯（実測 11〜12 セル）を落とす。名前はゲーム側のテロップで出す
        logical = quantize_shared(logical, a.colors, a.palette)
        dst = Path(a.dst) / f'{name}.png'
        logical.save(dst)
        info = {'name': name, 'w': logical.width, 'h': logical.height, 'fits': logical.width <= bw and logical.height <= bh,
                'colors': len([c for c in logical.getcolors(99999) if c[1][3] > 0]), 'pitch': [px, py], 'box': [x0, y0, x1, y1]}
        dst.with_suffix('.json').write_text(json.dumps({**meta, **info}, indent=1))
        meta['frames'].append(info)
        print(f'  panel {name}: {logical.width}x{logical.height} colors {info["colors"]} pitch {px}x{py}')
    print(json.dumps(meta))
    return 0 if len(meta['frames']) == rows * cols else 1


if __name__ == '__main__':
    main()
