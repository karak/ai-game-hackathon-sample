#!/usr/bin/env python3
"""Gemini 2.5 Flash Image (nano-banana) でスプライト/背景の元画像を生成する。

- API キーは参照プロジェクトの .env から読む（本リポには置かない）
- 生成回数は tools/gen_ledger.json に記録し、BUDGET を超えたら停止する（セッション予算 200）
- 生成物は assets/gen/raw/<name>-v<N>.png、プロンプトは assets/gen/prompts/<name>-v<N>.txt に保存

使い方: python3 tools/gemini_gen.py <name> --prompt-file p.txt [--ref image.png ...] [--n 1]
"""
from __future__ import annotations
import argparse, json, os, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'assets/gen/raw'; PROMPTS = ROOT / 'assets/gen/prompts'
LEDGER = ROOT / 'tools/gen_ledger.json'
ENV_FILE = Path('/Volumes/Mac external HDD/Projects/claude-virtual-office-materialized/.env')
MODEL = 'gemini-2.5-flash-image'
BUDGET = 200


def load_key() -> str:
    k = os.environ.get('GEMINI_API_KEY')
    if k: return k
    for line in ENV_FILE.read_text().splitlines():
        if line.startswith('GEMINI_API_KEY='):
            return line.split('=', 1)[1].strip().strip('"').strip("'")
    sys.exit('GEMINI_API_KEY not found')


def ledger() -> dict:
    return json.loads(LEDGER.read_text()) if LEDGER.exists() else {'requests': 0, 'entries': []}


def next_version(name: str) -> int:
    vs = [int(p.stem.rsplit('-v', 1)[1]) for p in RAW.glob(f'{name}-v*.png')]
    return max(vs, default=0) + 1


def generate(name: str, prompt: str, refs: list[Path], n: int = 1) -> list[Path]:
    from google import genai
    from google.genai import types
    led = ledger()
    if led['requests'] + n > BUDGET:
        sys.exit(f'BUDGET EXCEEDED: used {led["requests"]}, requested {n}, budget {BUDGET}')
    client = genai.Client(api_key=load_key())
    parts = [types.Part.from_bytes(data=r.read_bytes(), mime_type='image/png') for r in refs] + [prompt]
    out = []
    for i in range(n):
        v = next_version(name)
        t0 = time.time()
        try:
            resp = client.models.generate_content(model=MODEL, contents=parts)
        except Exception as e:  # noqa: BLE001
            led['requests'] += 1; led['entries'].append({'name': name, 'v': v, 'ok': False, 'err': str(e)[:200], 'ts': time.time()})
            LEDGER.write_text(json.dumps(led, indent=1, ensure_ascii=False)); print('ERROR', e, file=sys.stderr); continue
        led['requests'] += 1
        saved = None
        for cand in resp.candidates or []:
            for part in cand.content.parts:
                inline = getattr(part, 'inline_data', None)
                if inline is not None and inline.data:
                    saved = RAW / f'{name}-v{v}.png'; saved.write_bytes(inline.data)
                    (PROMPTS / f'{name}-v{v}.txt').write_text(prompt + ('\n\n[refs] ' + ', '.join(str(r) for r in refs) if refs else ''))
                    break
            if saved: break
        txt = ''.join(getattr(p, 'text', '') or '' for c in (resp.candidates or []) for p in c.content.parts)
        led['entries'].append({'name': name, 'v': v, 'ok': bool(saved), 'secs': round(time.time() - t0, 1), 'text': txt[:200], 'ts': time.time()})
        LEDGER.write_text(json.dumps(led, indent=1, ensure_ascii=False))
        print(f'[{led["requests"]}/{BUDGET}] {name}-v{v}: {"saved " + str(saved.relative_to(ROOT)) if saved else "NO IMAGE: " + txt[:200]}')
        if saved: out.append(saved)
    return out


SPECS = ROOT / 'assets/gen/specs.json'


def size_block(name: str) -> tuple[str, dict]:
    """specs.json からサイズ契約ブロックを組み立てる。"""
    spec = json.loads(SPECS.read_text()); sp = spec['sprites'][name]
    cell = spec['cell']; w, h = sp['box']; frames = sp['frames']; canvas = spec['canvas']; base = spec['baseline_px']
    lines = [f"SIZE CONTRACT for this sprite:",
             f"- Logical box: {w} cells wide x {h} cells tall (= {w*cell} x {h*cell} screen px at {cell} px per cell).",
             f"- The drawing must fit inside that box and should use most of it (at least {max(1, int(h*0.85))} cells of the {h}-cell height)."]
    if frames == 1:
        lines.append(f"- Exactly ONE sprite, horizontally centered on the canvas.")
    else:
        lines.append(f"- Exactly {frames} figures side by side in one row, separated by clear gaps of green, the group centered horizontally. Same scale and same palette for every figure.")
    if sp['anchor'] == 'bottom':
        lines.append(f"- Feet rest on the baseline y = {base} px (that is {(canvas - base)//cell} cells above the bottom edge). Nothing below the baseline.")
    else:
        lines.append(f"- Vertically centered on the canvas.")
    return '\n'.join(lines), sp


def latest_raw(name: str) -> Path:
    vs = sorted(RAW.glob(f'{name}-v*.png'), key=lambda p: int(p.stem.rsplit('-v', 1)[1]))
    if not vs: sys.exit(f'no raw image for ref {name}')
    return vs[-1]


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('name', help='specs.json のキー')
    ap.add_argument('--ref', action='append', default=[], help='追加参照画像（specs の ref は自動）')
    ap.add_argument('--n', type=int, default=1); ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    size, sp = size_block(a.name)
    style = (PROMPTS / '_style.txt').read_text(); subject = (PROMPTS / sp['subject']).read_text()
    prompt = f"{style}\n\n{size}\n\n{subject}"
    refs = [Path(r) for r in a.ref]
    if sp.get('skip'): sys.exit(f'{a.name} is marked skip')
    if sp.get('ref'): refs.insert(0, latest_raw(sp['ref'])); prompt += "\n\nREFERENCE: the attached image is the canonical design of this character (same pixel grid). Keep design, colors and proportions identical."
    if a.dry_run: print(prompt); print('refs:', refs); sys.exit(0)
    generate(a.name, prompt, refs, a.n)
