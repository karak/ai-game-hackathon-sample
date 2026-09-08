#!/usr/bin/env python3
"""生成画像（1 セル = 16px の格子で描かれたドット絵）→ 論理ピクセル PNG。

縮小フィルタは使わない。グリッド周期を実測し、各セルの中心領域の最頻色をそのまま 1 画素にする。
docs/gen-pipeline.md §2 の I/F。

  postprocess.py RAW.png OUT.png --logical WxH [--cell 16] [--palette BASE.png] [--anchor bottom|center]
  postprocess.py RAW.png OUTDIR/ --logical WxH --split --names a,b [--palette BASE.png]
"""
from __future__ import annotations
import argparse, json, collections
from pathlib import Path
import numpy as np
from PIL import Image


def bg_color(im):
    w, h = im.size; px = im.convert('RGB').load()
    pts = [px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3], px[w // 2, 2], px[2, h // 2], px[w - 3, h // 2]]
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


def split_frames(logical, min_gap=2, min_width=8):
    a = logical.split()[3]; w, h = logical.size; px = a.load()
    occ = [any(px[x, y] for y in range(h)) for x in range(w)]
    frames, start, gap = [], None, 0
    for x, o in enumerate(occ + [False]):
        if o: start = x if start is None else start; gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap or x == w: frames.append((start, x - gap + 1)); start = None; gap = 0
    return [f for f in frames if f[1] - f[0] >= min_width]  # ゴミ片を除外


def crop_alpha(im):
    bb = im.split()[3].getbbox(); return im.crop(bb) if bb else im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('--logical', required=True, help='最大 WxH（検査用）')
    ap.add_argument('--palette'); ap.add_argument('--colors', type=int, default=15); ap.add_argument('--anchor', default='bottom')
    ap.add_argument('--split', action='store_true'); ap.add_argument('--names', default=''); ap.add_argument('--tol', type=int, default=60)
    ap.add_argument('--nokey', action='store_true', help='クロマキーしない（空などキャンバス全面の絵）')
    ap.add_argument('--keep-bottom', type=float, default=0, help='論理画像の下側この比率だけ残す（背景中景の月などを除く）')
    a = ap.parse_args()
    bw, bh = (int(v) for v in a.logical.split('x'))
    im = Image.open(a.src).convert('RGBA') if a.nokey else key_out(Image.open(a.src), a.tol)
    logical, px, py = extract_cells(im)
    if a.keep_bottom: logical = logical.crop((0, int(logical.height * (1 - a.keep_bottom)), logical.width, logical.height))
    if not a.nokey and not a.keep_bottom: logical = strip_shadow(logical)
    logical = quantize_shared(logical, a.colors, a.palette)
    meta = {'source': a.src, 'pitch': [px, py], 'max_box': [bw, bh]}
    def info(img):
        return {'w': img.width, 'h': img.height, 'fits': img.width <= bw and img.height <= bh, 'colors': len([c for c in img.getcolors(99999) if c[1][3] > 0])}
    if not a.split:
        fr = split_frames(logical, min_gap=2, min_width=8)
        if len(fr) >= 2: logical = logical.crop((fr[0][0], 0, fr[0][1], logical.height))  # 複数体描かれた場合は最初の 1 体
        out = crop_alpha(logical); out.save(a.dst); meta.update(info(out))
        Path(a.dst).with_suffix('.json').write_text(json.dumps(meta, indent=1)); print(json.dumps(meta)); return
    frames = split_frames(logical, min_gap=2, min_width=8); names = a.names.split(',') if a.names else [f'f{i}' for i in range(len(frames))]
    Path(a.dst).mkdir(parents=True, exist_ok=True); meta['frames'] = []
    for i, (x0, x1) in enumerate(frames[:len(names)]):
        out = crop_alpha(logical.crop((x0, 0, x1, logical.height)))
        out.save(Path(a.dst) / f'{names[i]}.png'); fi = info(out); fi['name'] = names[i]; meta['frames'].append(fi)
        (Path(a.dst) / f'{names[i]}.json').write_text(json.dumps({**meta, **fi, 'frames': None}, indent=1))
    (Path(a.dst) / '_meta.json').write_text(json.dumps(meta, indent=1)); print(json.dumps(meta))


if __name__ == '__main__':
    main()
