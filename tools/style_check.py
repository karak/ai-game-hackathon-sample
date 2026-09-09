#!/usr/bin/env python3
"""挿絵級の画像（カットイン・エンディング・タイトル等）を、尊重物 `assets/sprites/ending/scene1.png` / `scene6.png`
と同じ物差しで計測し、画風の乖離を数値で出す（IMP-022。ユーザー指示 2026-09-10「画風は scene1, scene6 が尊重物」）。

計測項目（すべて 1 セル = 1 画素の論理画像で測る）:
- colors   : 不透明画素の色数
- darkest  : 最暗色（輪郭色。尊重物は暗紫 #220d30 / #1e0a24）と、その色相（度）
- flat     : 横に隣り合う画素が同色である比率。低いほど粒子（ディザ・テクスチャ）が多い。尊重物 0.16 / 0.20、カットイン旧版 0.35〜0.40
- dither   : 市松ディザ率（(x,y)==(x+1,y+1) かつ !=(x+1,y)）。尊重物 0.09 / 0.10
- sat, val : 画素数で重み付けした平均彩度・明度（HSV）

頭身は色では測れないので `--grid` で 4 倍格子つき画像を書き出し、目視で読む（scene1 のリリカ: 帽子込み 156 セル・頭 32 → 帽子なし 4.3 頭身）。

使い方:
  .venv/bin/python tools/style_check.py assets/sprites/cutin/*.png            # 表で出す
  .venv/bin/python tools/style_check.py IMG.png --grid OUT.png                 # 4 倍格子つき画像（頭身の目視計測用）
  .venv/bin/python tools/style_check.py --json IMG.png                         # 1 枚を JSON で（build_sprites から呼ぶ）
"""
from __future__ import annotations
import argparse, colorsys, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
CANON = [ROOT / 'assets/sprites/ending/scene1.png', ROOT / 'assets/sprites/ending/scene6.png']
# 尊重物 2 枚の実測（2026-09-10）から置いた許容帯。docs/art-standard.md §2.6
# 輪郭の上限（hue 335 / val 0.23）は、同じ手順で描いた cutin v2 の暖色パネル（薔薇の空・蝋燭の光）が 315〜328 / 0.23 に出たので、尊重物 276/286・0.19/0.14 から広げた
COLORS = (28, 32); FLAT_MAX = 0.28; DITHER_MIN = 0.07; OUTLINE_HUE = (255, 335); OUTLINE_VAL_MAX = 0.23


def metrics(path: Path) -> dict:
    im = Image.open(path).convert('RGBA'); a = np.asarray(im); rgb = a[..., :3]; al = a[..., 3] > 0
    px = rgb[al]
    cols, cnt = np.unique(px.reshape(-1, 3), axis=0, return_counts=True)
    lum = cols @ np.array([0.299, 0.587, 0.114])
    darkest = cols[int(np.argmin(lum))]
    dh, _, dv = colorsys.rgb_to_hsv(*(darkest / 255))
    both = al[:, 1:] & al[:, :-1]
    flat = float(((rgb[:, 1:] == rgb[:, :-1]).all(-1) & both).sum() / max(1, both.sum()))
    diag = al[:-1, :-1] & al[1:, 1:]
    d = (rgb[:-1, :-1] == rgb[1:, 1:]).all(-1) & ~(rgb[:-1, :-1] == rgb[:-1, 1:]).all(-1) & diag
    dither = float(d.sum() / max(1, diag.sum()))
    hsv = np.array([colorsys.rgb_to_hsv(*(c / 255)) for c in cols])
    return {'w': im.width, 'h': im.height, 'colors': int(len(cols)), 'darkest': '#%02x%02x%02x' % tuple(int(v) for v in darkest),
            'outline_hue': round(dh * 360), 'outline_val': round(float(dv), 2), 'flat': round(flat, 2), 'dither': round(dither, 2),
            'sat': round(float(np.average(hsv[:, 1], weights=cnt)), 2), 'val': round(float(np.average(hsv[:, 2], weights=cnt)), 2)}


def verdict(m: dict) -> list[str]:
    """許容帯から外れた項目を列挙する（空なら帯内）。"""
    bad = []
    lo, hi = COLORS
    if not lo <= m['colors'] <= hi: bad.append(f"colors {m['colors']} not in {lo}-{hi}")
    if m['flat'] > FLAT_MAX: bad.append(f"flat {m['flat']} > {FLAT_MAX} (平坦塗りが多い。尊重物は粒子で満ちる)")
    if m['dither'] < DITHER_MIN: bad.append(f"dither {m['dither']} < {DITHER_MIN}")
    h0, h1 = OUTLINE_HUE
    if not h0 <= m['outline_hue'] <= h1 or m['outline_val'] > OUTLINE_VAL_MAX: bad.append(f"outline {m['darkest']} hue {m['outline_hue']} val {m['outline_val']} (尊重物は暗紫 #220d30/#1e0a24: hue 276/286, val 0.19/0.14。許容 hue 255-335, val <=0.23)")
    return bad


def grid_image(path: Path, out: Path, scale=4, step=10):
    """頭身・部位の目視計測用に、scale 倍・step セルごとの横線と目盛りを重ねた画像を書く。"""
    im = Image.open(path).convert('RGBA'); g = im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST); d = ImageDraw.Draw(g)
    for y in range(0, im.height, step):
        d.line([(0, y * scale), (g.width, y * scale)], fill=(0, 255, 0, 255) if (y // step) % 5 == 0 else (0, 255, 0, 110)); d.text((2, y * scale + 1), str(y), fill=(0, 255, 0, 255))
    g.save(out)


ILLUST_GROUPS = ('cutin', 'ending')  # 挿絵級として尊重物と比べる manifest グループ


def annotate_manifest(manifest: dict) -> dict:
    """挿絵級の項目に計測値（flat / dither / outline_hue / outline_val）を書き足す。`test/art-standard.test.js` §2.6 が読む。"""
    for key, v in manifest.items():
        if key.split('/')[0] not in ILLUST_GROUPS: continue
        p = ROOT / v['src']
        if not p.exists(): continue
        m = metrics(p); v.update({k: m[k] for k in ('flat', 'dither', 'outline_hue', 'outline_val')})
    return manifest


def main(argv=None):
    ap = argparse.ArgumentParser(); ap.add_argument('paths', nargs='*'); ap.add_argument('--json', action='store_true'); ap.add_argument('--grid', help='4 倍格子つき画像の出力先（paths の 1 枚目）')
    ap.add_argument('--manifest', action='store_true', help='src/gfx/manifest.json の cutin/ending 項目に計測値を書き足す')
    a = ap.parse_args(argv)
    if a.manifest:
        mp = ROOT / 'src/gfx/manifest.json'; man = annotate_manifest(json.loads(mp.read_text())); mp.write_text(json.dumps(man, indent=1, sort_keys=True)); print('manifest annotated'); return
    if a.grid: grid_image(Path(a.paths[0]), Path(a.grid)); print('grid ->', a.grid); return
    if a.json: print(json.dumps(metrics(Path(a.paths[0])))); return
    rows = [(p, metrics(Path(p))) for p in [str(c) for c in CANON] + a.paths]
    print(f"{'image':34s} {'size':9s} col darkest hue  val  flat dith sat  val  verdict")
    for p, m in rows:
        name = str(Path(p).relative_to(ROOT)) if str(p).startswith(str(ROOT)) else p
        tag = '尊重物' if Path(p) in CANON else ('; '.join(verdict(m)) or 'OK')
        print(f"{name.replace('assets/sprites/', ''):34s} {m['w']:3d}x{m['h']:<4d} {m['colors']:3d} {m['darkest']} {m['outline_hue']:3d} {m['outline_val']:.2f} {m['flat']:.2f} {m['dither']:.2f} {m['sat']:.2f} {m['val']:.2f}  {tag}")


if __name__ == '__main__':
    main()
