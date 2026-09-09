#!/usr/bin/env python3
"""スプライト PNG をパレット形式で再保存して転送量を減らす（IMP-019）。可逆であることを検査する。

生成パイプラインの出力は RGBA 8bit（1 画素 4 バイト）で、15〜32 色しか使っていないのに 2.61 MB ある。
不透明画素の色をそのままパレットに並べ（量子化しない）、完全透明に 1 インデックスを割り当てて mode='P' で保存すると 1.11 MB になる。
アルファは生成パイプラインのクロマキーにより 0 か 255 のみ（実測）なので、透明インデックスで完全に表せる。

可逆の判定: 再保存した PNG を読み直し、(1) 不透明画素の RGB が元と完全一致、(2) アルファ > 0 の位置が完全一致。
どちらか崩れたら元のファイルを残して失敗する。既にパレット形式で色数も同じなら書き換えない（冪等）。

  .venv/bin/python tools/optimize_pngs.py [--dry-run] [<glob>…]
"""
import glob, io, os, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

def to_palette(im):
    """RGBA 画像を、色を変えずにパレット PNG のバイト列にする。255 色を超える／半透明があれば None"""
    a = np.array(im.convert('RGBA'))
    alpha = a[..., 3]
    if set(np.unique(alpha).tolist()) - {0, 255}: return None  # 半透明はパレットで表せない
    opaque = alpha > 0
    rgb = a[..., :3]
    cols, idx = np.unique(rgb[opaque].reshape(-1, 3), axis=0, return_inverse=True)
    if len(cols) > 255: return None
    out = np.full(alpha.shape, len(cols), dtype=np.uint8)  # 透明 = 最後のインデックス
    out[opaque] = idx.astype(np.uint8)
    p = Image.fromarray(out, mode='P')
    pal = cols.reshape(-1).tolist() + [0, 0, 0]
    p.putpalette(pal)
    buf = io.BytesIO()
    p.save(buf, 'PNG', optimize=True, compress_level=9, transparency=len(cols))
    return buf.getvalue()

def lossless(orig, data):
    """再保存したバイト列が元画像と画素単位で同じか（不透明画素の RGB とアルファの有無）"""
    a = np.array(orig.convert('RGBA')); b = np.array(Image.open(io.BytesIO(data)).convert('RGBA'))
    if a.shape != b.shape: return False
    ao, bo = a[..., 3] > 0, b[..., 3] > 0
    return bool(np.array_equal(ao, bo) and np.array_equal(a[..., :3][ao], b[..., :3][bo]))

def optimize(path, dry=False):
    """1 ファイルを最適化。(元バイト数, 新バイト数, 状態) を返す"""
    before = os.path.getsize(path)
    orig = Image.open(path)
    if orig.mode == 'P' and 'transparency' in orig.info: return before, before, 'already'
    data = to_palette(orig)
    if data is None: return before, before, 'skip'
    if not lossless(orig, data): return before, before, 'NOT-LOSSLESS'
    if len(data) >= before: return before, before, 'no-gain'
    if not dry: Path(path).write_bytes(data)
    return before, len(data), 'ok'

def main(argv):
    dry = '--dry-run' in argv
    pats = [a for a in argv if not a.startswith('--')] or [str(ROOT / 'assets/sprites/**/*.png')]
    files = sorted(f for p in pats for f in glob.glob(p, recursive=True))
    tot_b = tot_a = 0; counts = {}; bad = []
    for f in files:
        b, a, st = optimize(f, dry)
        tot_b += b; tot_a += a; counts[st] = counts.get(st, 0) + 1
        if st == 'NOT-LOSSLESS': bad.append(f)
    print(f'{len(files)} files: {tot_b / 1e6:.2f} MB → {tot_a / 1e6:.2f} MB ({100 * (1 - tot_a / max(1, tot_b)):.0f}% smaller){" [dry-run]" if dry else ""} {counts}')
    if bad: print('NOT LOSSLESS (left untouched):', *bad, sep='\n  '); return 1
    return 0

if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
