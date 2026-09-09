#!/usr/bin/env python3
"""specs.json に基づき、最新の raw 画像を後処理して assets/sprites/ に配置し、manifest を書く。

  python3 tools/build_sprites.py            # 全件
  python3 tools/build_sprites.py player-run-a enemy-zombie   # 指定のみ
"""
from __future__ import annotations
import json, subprocess, sys
from pathlib import Path
import optimize_pngs

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
    if sp.get('trim_border'): pal_arg += ['--trim-border']  # 一枚絵の額縁を落とす（エンディング）
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
    # frame_use: コマ単位で別の版を採る（例 {"player/fall": "v1"}: 2 コマ中 1 コマだけ良かった版を活かし、リクエストを節約する）
    for o, ver in sp.get('frame_use', {}).items():
        raw2 = latest(name, ver)
        if not raw2 or o not in outs: print(f'  WARN {name}: frame_use {o}={ver} not found'); continue
        tmp2 = tmp / ver; tmp2.mkdir(exist_ok=True); s = Path(o).name
        subprocess.run([PY, str(ROOT / 'tools/postprocess.py'), str(raw2), str(tmp2), '--logical', f'{w}x{h}', '--anchor', sp['anchor'], '--split', '--names', ','.join(short), *pal_arg], check=True)
        src = tmp2 / f'{s}.png'
        if src.exists():
            dst = OUT / f'{o}.png'; dst.write_bytes(src.read_bytes()); dst.with_suffix('.json').write_text(src.with_suffix('.json').read_text())
            res = [(oo, dd) for oo, dd in res if oo != o] + [(o, dst)]; print(f'  {o} <- {raw2.name}')
    return res


def measure_parts(im):
    """主人公コマの部位を色で計測する（論理 px）。帽子＝暗い藍の画素が 40% 超の行、髪＝桃色の画素。
    値は色の閾値に依存するので、specs の part_sizes（目視実測）とは直接比べず、同じ関数で測った idle と比べる"""
    import numpy as np
    a = np.asarray(im.convert('RGBA')); al = a[..., 3] > 0; h = a.shape[0]
    r, g, b = (a[..., i].astype(int) for i in range(3))
    hat = al & (b > r + 10) & (r < 120) & (g < 110)
    skin = al & (r > 220) & (g > 170) & (b > 150) & (r - b > 30)
    hair = al & (r > 200) & (b > 150) & (g < 200) & (r - g > 40) & ~skin
    out = {'total_height': h}
    hatrows = [y for y in range(int(h * 0.5)) if al[y].sum() and hat[y].sum() / al[y].sum() > 0.4]
    if hatrows: out['hat_height'] = max(hatrows) - min(hatrows) + 1; out['hat_brim_width'] = int(max(hat[y].sum() for y in hatrows))
    hw = hair.sum(axis=1)
    if hw.any(): out['hair_width'] = int(hw.max())   # 髪だけの最大幅（腕の肌色は含めない）
    return out


def qa_player_frame(key, dst, manifest):
    """主人公コマの出力チェック（合成可否の当たり）: 部位サイズ（specs part_sizes）との差、idle との高さ差、帽子の有無、髪の上端の連続性を WARN で出す。"""
    if not key.startswith('player/') or key in ('player/hat', 'player/base', 'player/base_hat'): return
    from PIL import Image
    import numpy as np
    name = key.split('/')[1]
    idle = manifest.get('player/idle_nohat' if name.endswith('_nohat') else 'player/idle'); im = Image.open(dst).convert('RGBA'); a = np.asarray(im); al = a[..., 3] > 0
    r, g, b = (a[..., i].astype(int) for i in range(3)); h = a.shape[0]
    # 部位サイズ: 帽子つばの幅・髪の幅・帽子の高さは姿勢に依らず一定のはず（±15%）。総高は直立コマだけ比べる
    if idle and name.replace('_nohat', '') not in ('dead', 'idle') and (ROOT / idle['src']).exists():
        ref = measure_parts(Image.open(ROOT / idle['src'])); got = measure_parts(im); bad = []
        # つばの幅・帽子の高さは姿勢で変わらない（±15%）。髪の幅は動きでなびくので ±30% だけ見る
        for k, tol in (('hat_brim_width', 0.15), ('hat_height', 0.15), ('hair_width', 0.30)):
            if k in ref and k in got and abs(got[k] / ref[k] - 1) > tol: bad.append(f'{k} {got[k]} vs idle {ref[k]} ({got[k] / ref[k]:.2f}x)')
        if bad: print(f'  QA {key}: 部位サイズ不一致 -> ' + '; '.join(bad) + ' -> 再生成候補（PART SIZES を守らせる）')
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
            if key in sp.get('skip_out', []): continue  # 別 spec に移した出力（例: tiles/press → gimmick-press）は manifest に載せない
            meta = json.loads(dst.with_suffix('.json').read_text())
            manifest[key] = {'src': str(dst.relative_to(ROOT)), 'w': meta['w'], 'h': meta['h'], 'fits': meta['fits'], 'colors': meta['colors'], 'anchor': sp['anchor']}
            qa_player_frame(key, dst, manifest)
    MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True)); print('manifest ->', MANIFEST.relative_to(ROOT), len(manifest), 'entries')
    optimize_pngs.main([str(OUT / '**' / '*.png')])  # 出力をパレット PNG に（可逆、転送量 -57%。IMP-019）


if __name__ == '__main__':
    main()
