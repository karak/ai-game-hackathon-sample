#!/usr/bin/env python3
"""specs.json に基づき、最新の raw 画像を後処理して assets/sprites/ に配置し、manifest を書く。

  python3 tools/build_sprites.py            # 全件
  python3 tools/build_sprites.py player-run-a enemy-zombie   # 指定のみ
"""
from __future__ import annotations
import json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPECS = json.loads((ROOT / 'assets/gen/specs.json').read_text())
RAW = ROOT / 'assets/gen/raw'; OUT = ROOT / 'assets/sprites'; MANIFEST = ROOT / 'src/gfx/manifest.json'
PY = sys.executable


def latest(name, use=None):
    if use: p = RAW / f'{name}-{use}.png'; return p if p.exists() else None
    vs = sorted(RAW.glob(f'{name}-v*.png'), key=lambda p: int(p.stem.rsplit('-v', 1)[1]))
    return vs[-1] if vs else None


def build(name, sp):
    raw = latest(name, sp.get('use'))
    if not raw: print(f'  skip {name}: no raw'); return []
    w, h = sp['box']; outs = sp['out']
    pal = (OUT / f"{sp['palette']}.png") if sp.get('palette') else None
    pal_arg = ['--palette', str(pal)] if pal and pal.exists() else []
    pal_arg += ['--colors', str(sp.get('colors', 15))]
    if sp.get('nokey'): pal_arg += ['--nokey']
    if sp.get('tol'): pal_arg += ['--tol', str(sp['tol'])]  # クロマキー許容差（格子模様の緑が残るときに上げる）
    if sp.get('strip_caption'): pal_arg += ['--strip-caption']
    if sp.get('fill_holes'): pal_arg += ['--fill-holes']
    if sp.get('trim_thin_bottom'): pal_arg += ['--trim-thin-bottom']
    if sp.get('kind') in ('bg', 'tiles'): pal_arg += ['--nosplit']
    if sp.get('keep_bottom'): pal_arg += ['--keep-bottom', str(sp['keep_bottom'])]
    if sp['frames'] == 1:
        dst = OUT / f'{outs[0]}.png'; dst.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([PY, str(ROOT / 'tools/postprocess.py'), str(raw), str(dst), '--logical', f'{w}x{h}', '--anchor', sp['anchor'], *pal_arg], check=True)
        return [(outs[0], dst)]
    tmp = ROOT / 'assets/gen/out' / name; tmp.mkdir(parents=True, exist_ok=True)
    short = [Path(o).name for o in outs]
    subprocess.run([PY, str(ROOT / 'tools/postprocess.py'), str(raw), str(tmp), '--logical', f'{w}x{h}', '--anchor', sp['anchor'], '--split', '--names', ','.join(short), *pal_arg], check=True)
    res = []
    for o, s in zip(outs, short):
        src = tmp / f'{s}.png'
        if src.exists():
            dst = OUT / f'{o}.png'; dst.parent.mkdir(parents=True, exist_ok=True); dst.write_bytes(src.read_bytes())
            dst.with_suffix('.json').write_text(src.with_suffix('.json').read_text()); res.append((o, dst))
        else: print(f'  WARN {name}: frame {s} not produced')
    return res


def qa_player_frame(key, dst, manifest):
    """主人公コマの出力チェック（合成可否の当たり）: idle との高さ差、帽子の有無、髪の上端の連続性を WARN で出す。"""
    if not key.startswith('player/') or key in ('player/hat', 'player/base', 'player/base_hat'): return
    from PIL import Image
    import numpy as np
    name = key.split('/')[1]
    idle = manifest.get('player/idle_nohat' if name.endswith('_nohat') else 'player/idle'); im = Image.open(dst).convert('RGBA'); a = np.asarray(im); al = a[..., 3] > 0
    r, g, b = (a[..., i].astype(int) for i in range(3)); h = a.shape[0]
    if idle and name.replace('_nohat', '') not in ('dead', 'crouch', 'jump', 'hurt2', 'idle'):
        ratio = im.height / idle['h']
        if abs(ratio - 1) > 0.12: print(f'  QA {key}: height {im.height} vs idle {idle["h"]} ({ratio:.2f}x) -> 再生成候補（同じ大きさで描かせる）')
    if not name.endswith('_nohat') and name != 'dead':
        top = slice(0, max(1, int(h * 0.15))); ind = (b > r + 10) & (r < 120) & (g < 110)
        has_hat = al[top].sum() and (ind & al)[top].sum() / al[top].sum() > 0.5
        if not has_hat:
            pink = al & (r > 180) & (b > 120) & (g < r - 30); rows = pink.sum(axis=1)
            ys = np.nonzero(rows)[0]; spread = int(rows[ys[0]:ys[0] + 12].max()) if ys.size else 0
            verdict = '合成可（髪の上端が水平）' if spread >= 8 else '合成不向き（髪が散っている／細い）→ 再生成'
            print(f'  QA {key}: 帽子なし。{verdict}')

def main():
    targets = sys.argv[1:] or [k for k, v in SPECS['sprites'].items() if not v.get('skip')]
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    manifest = {k: v for k, v in manifest.items() if (ROOT / v['src']).exists()}  # 削除済みスプライトの残留エントリを落とす
    for name in targets:
        sp = SPECS['sprites'][name]; print(f'[{name}]')
        for key, dst in build(name, sp):
            meta = json.loads(dst.with_suffix('.json').read_text())
            manifest[key] = {'src': str(dst.relative_to(ROOT)), 'w': meta['w'], 'h': meta['h'], 'fits': meta['fits'], 'colors': meta['colors'], 'anchor': sp['anchor']}
            qa_player_frame(key, dst, manifest)
    MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True)); print('manifest ->', MANIFEST.relative_to(ROOT), len(manifest), 'entries')


if __name__ == '__main__':
    main()
