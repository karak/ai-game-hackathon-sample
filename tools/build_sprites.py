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


def main():
    targets = sys.argv[1:] or [k for k, v in SPECS['sprites'].items() if not v.get('skip')]
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    manifest = {k: v for k, v in manifest.items() if (ROOT / v['src']).exists()}  # 削除済みスプライトの残留エントリを落とす
    for name in targets:
        sp = SPECS['sprites'][name]; print(f'[{name}]')
        for key, dst in build(name, sp):
            meta = json.loads(dst.with_suffix('.json').read_text())
            manifest[key] = {'src': str(dst.relative_to(ROOT)), 'w': meta['w'], 'h': meta['h'], 'fits': meta['fits'], 'colors': meta['colors'], 'anchor': sp['anchor']}
    MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True)); print('manifest ->', MANIFEST.relative_to(ROOT), len(manifest), 'entries')


if __name__ == '__main__':
    main()
