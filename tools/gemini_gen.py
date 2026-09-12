#!/usr/bin/env python3
"""Gemini 2.5 Flash Image (nano-banana) でスプライト/背景の元画像を生成する。

- API キーは環境変数 GEMINI_API_KEY、本リポの .env（.env.example を複製、git 管理外）、参照プロジェクトの .env の順に探す（DEBT-008）
- 生成回数は tools/gen_ledger.json に記録し、BUDGET を超えたら停止する
  セッション予算: 200（当初）＋ 50（強化魔法の素材。ユーザー指示 2026-09-10）= 250 → ＋ 30（ユーザー指示 2026-09-11）= 280
- 生成物は assets/gen/raw/<name>-v<N>.png、プロンプトは assets/gen/prompts/<name>-v<N>.txt に保存

使い方: python3 tools/gemini_gen.py <name> --prompt-file p.txt [--ref image.png ...] [--n 1]
"""
from __future__ import annotations
import argparse, json, os, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'assets/gen/raw'; PROMPTS = ROOT / 'assets/gen/prompts'
LEDGER = ROOT / 'tools/gen_ledger.json'
# .env の探索順: 本リポ → 参照プロジェクト（後者は従来の場所。外部 HDD が無くても動くようにした。DEBT-008）
ENV_FILES = [ROOT / '.env', Path('/Volumes/Mac external HDD/Projects/claude-virtual-office-materialized/.env')]
MODEL = 'gemini-2.5-flash-image'
BUDGET = 280  # 200（当初）＋ 50（強化魔法。2026-09-10 追加）＋ 30（人魚縦長・2 周目挿絵・城の中景。ユーザー指示 2026-09-11）


def load_key() -> str:
    k = os.environ.get('GEMINI_API_KEY')
    if k: return k
    for env in ENV_FILES:
        if not env.exists(): continue
        for line in env.read_text().splitlines():
            if line.startswith('GEMINI_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    sys.exit('GEMINI_API_KEY not found: 環境変数か .env（.env.example を複製）に置く')


def ledger() -> dict:
    return json.loads(LEDGER.read_text()) if LEDGER.exists() else {'requests': 0, 'entries': []}


def record(entry: dict) -> int:
    """台帳に 1 リクエストを追記する。fcntl のファイルロックで並列実行時の計数競合を防ぐ（BUG-003）。
    戻り値は更新後の requests。"""
    import fcntl
    lock = LEDGER.with_suffix('.lock')
    with open(lock, 'w') as lf:
        fcntl.flock(lf, fcntl.LOCK_EX)
        try:
            led = ledger()
            led['requests'] += 1; led['entries'].append(entry)
            tmp = LEDGER.with_suffix('.tmp'); tmp.write_text(json.dumps(led, indent=1, ensure_ascii=False)); tmp.replace(LEDGER)
            return led['requests']
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)


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
            record({'name': name, 'v': v, 'ok': False, 'err': str(e)[:200], 'ts': time.time()}); print('ERROR', e, file=sys.stderr); continue
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
        used = record({'name': name, 'v': v, 'ok': bool(saved), 'secs': round(time.time() - t0, 1), 'text': txt[:200], 'ts': time.time()})
        print(f'[{used}/{BUDGET}] {name}-v{v}: {"saved " + str(saved.relative_to(ROOT)) if saved else "NO IMAGE: " + txt[:200]}')
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
    elif sp.get('grid'):  # 格子シート（カットイン 4 枚など）: 横一列ではなく RxC で並べる
        r, c = sp['grid'].lower().split('x')
        lines.append(f"- Exactly {frames} panels arranged in a grid of {r} rows x {c} columns, separated by clear gaps of green, the group centered on the canvas. Same scale and same palette for every panel.")
    else:
        lines.append(f"- Exactly {frames} figures side by side in one row, separated by clear gaps of green, the group centered horizontally. Same scale and same palette for every figure.")
    if sp['anchor'] == 'bottom':
        lines.append(f"- Feet rest on the baseline y = {base} px (that is {(canvas - base)//cell} cells above the bottom edge). Nothing below the baseline.")
    else:
        lines.append(f"- Vertically centered on the canvas.")
    if sp.get('parts'):
        lines.append(part_block(spec['part_sizes'][sp['parts']]))
    return '\n'.join(lines), sp


PART_LABELS = {
    'total_height': 'TOTAL HEIGHT from the top of the sprite (hat tip, or hair top when hatless) to the boot sole: {v} cells when standing upright',
    'hat_height': 'witch hat: {v} cells tall from the tip to the underside of the brim',
    'hat_brim_width': 'hat brim: {v} cells wide (the widest row of the hat)',
    'hat_above_hair': 'the hat tip sits {v} cells above the top of the hair',
    'head_height': 'head: {v} cells from the top of the hair to the chin',
    'hair_width': 'hair: {v} cells wide at its widest',
    'eye_height': 'eyes: {v} cells tall',
    'eye_from_hair_top': 'the eyes start {v} cells below the top of the hair',
    'torso_height': 'torso (collar to waist): {v} cells',
    'shoulder_width': 'shoulders including the puff sleeves: {v} cells wide',
    'skirt_height': 'skirt (waist to hem): {v} cells',
    'skirt_hem_width': 'skirt hem: {v} cells wide when hanging still',
    'legs_height': 'legs (hem to sole, socks + boots): {v} cells',
    'boot_height': 'boots: {v} cells tall',
    'boot_width': 'each boot: {v} cells long',
    # 人魚人形（IMP-026）: 胴と尾の長さを部位で指定する
    'hips_height': 'hips (waist to where the fish tail begins): {v} cells',
    'tail_length': 'fish tail from the hips to the tip of the tail fin: {v} cells measured along the tail',
    'tail_fin_width': 'tail fin: {v} cells wide at its widest',
}


def part_block(parts: dict) -> str:
    """部位ごとの論理ピクセル数を列挙する契約ブロック。高さ比ではなく部位のセル数で指定する（ユーザー指示 2026-09-09）。"""
    lines = ["- PART SIZES (count them on the grid; 1 cell = 1 logical pixel). Every frame must reproduce these part sizes within 2 cells, whatever the pose:"]
    for k, v in parts.items():
        if k in PART_LABELS: lines.append(f"    * {PART_LABELS[k].format(v=v)}")
    lines.append("- A pose may fold the body (crouch, tuck, lean) and so reduce the TOTAL height, but it must never enlarge the head, hair, hat or eyes. If the drawing is coming out with a bigger head or a wider brim than the numbers above, it is wrong.")
    return '\n'.join(lines)


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
    # style: スタイル契約。既定 _style.txt（スプライト級・チビ体型）。挿絵級（カットイン・エンディング）は _illust_style.txt（IMP-022）
    style = (PROMPTS / sp.get('style', '_style.txt')).read_text(); subject = (PROMPTS / sp['subject']).read_text()
    prompt = f"{style}\n\n{size}\n\n{subject}"
    refs = [Path(r) for r in a.ref]
    if sp.get('skip'): sys.exit(f'{a.name} is marked skip')
    if sp.get('ref'): refs.insert(0, latest_raw(sp['ref'])); prompt += "\n\nREFERENCE: the attached image is the canonical design of this character (same pixel grid). Keep design, colors and proportions identical."
    # style_refs: 毎回必ず添付する参照（1 枚目 = 画風の尊重物 ending/scene1 or scene6、2 枚目 = キャラ立ち絵ベース assets/gen/ref/lyrica-illust*.png）。
    # 別リクエストで描くと画風が別人になる（Sprint L）ので、挿絵級はこれ無しで生成しない（ユーザー指示 2026-09-10「かならずベースになるキャラ画像を入れる」）
    if sp.get('style_refs'):
        srefs = [ROOT / r for r in sp['style_refs']]
        for r in srefs:
            if not r.exists(): sys.exit(f'style_ref not found: {r}')
        refs = srefs + refs
        prompt += "\n\nREFERENCES: image 1 is a finished illustration by this game's illustrator — reproduce its style exactly (grain, dither, outline color, palette, proportions). Image 2 is the canonical character cut from that illustration — keep her design, colors and body proportions identical."
    if a.dry_run: print(prompt); print('refs:', refs); sys.exit(0)
    generate(a.name, prompt, refs, a.n)
