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
    hatmask = al & (indigo | white | gold) & (ys < h * 0.30)  # 目より上の領域だけ（顔の誤検出を避ける）
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
    return al & (b > r + 10) & (r < 120) & (g < 110) & (ys < h * 0.30)


def hair_top_center(im):
    """髪（ピンク系）の最上行とその x 中心"""
    a = np.asarray(im); al = a[..., 3] > 0; r, g, b = (a[..., i].astype(int) for i in range(3))
    pink = al & (r > 180) & (b > 120) & (g < r - 30)
    ys, xs = np.nonzero(pink)
    if ys.size == 0: return None
    top = ys.min(); row = xs[ys <= top + 3]
    return int(top), float(row.mean())


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
    hx = int(round(cx - hat_img.width * 0.55)); hy = top + 6 - hat_img.height  # つばを髪に 6 セルかぶせる
    pad_top = max(0, -hy); pad_l = max(0, -hx); pad_r = max(0, hx + hat_img.width - im.width)
    canvas = Image.new('RGBA', (im.width + pad_l + pad_r, im.height + pad_top), (0, 0, 0, 0))
    canvas.paste(im, (pad_l, pad_top), im); canvas.paste(hat_img, (hx + pad_l, hy + pad_top), hat_img)
    canvas.save(SPR / f'{frame_name}.png'); return True


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


def main():
    manifest = json.loads(MANIFEST.read_text())
    hm = derive_hat(); manifest['player/hat'] = {'src': 'assets/sprites/player/hat.png', 'anchor': 'center', **hm}
    print('hat', hm)
    frames = ['idle', 'run1', 'run2', 'run3', 'run4', 'jump', 'fall', 'attack', 'crouch', 'hurt', 'hurt2', 'dead']
    hat_img = load('hat')
    for n in frames:
        if n in ('dead',) or not (SPR / f'{n}.png').exists(): continue
        if ensure_hat(n, hat_img):
            out = load(n); manifest[f'player/{n}'].update({'w': out.width, 'h': out.height}); print('hat composited onto', n)
    # plain: 帽子なしフレーム(*_nohat) に idle_nohat→idle_plain の写像を適用
    if (SPR / 'idle_plain.png').exists() and (SPR / 'idle_nohat.png').exists():
        mp = learn_map(load('idle_nohat'), load('idle_plain')); print('plain mapped colors', len(mp))
        for n in frames:
            src = SPR / f'{n}_nohat.png'
            if not src.exists(): continue
            out = apply_map(Image.open(src).convert('RGBA'), mp); out.save(SPR / f'{n}_plain.png')
            manifest[f'player/{n}_plain'] = {'src': f'assets/sprites/player/{n}_plain.png', 'w': out.width, 'h': out.height, 'anchor': 'bottom', 'fits': True, 'colors': len([c for c in out.getcolors(9999) if c[1][3] > 0])}
    # gold: 帽子ありフレームに idle_nohat→idle_gold の衣装写像を適用（帽子色は写像に含まれない）
    if (SPR / 'idle_gold.png').exists() and (SPR / 'idle_nohat.png').exists():
        mp = learn_map(load('idle_nohat'), load('idle_gold')); print('gold mapped colors', len(mp))
        for n in frames:
            src = SPR / f'{n}.png'
            if not src.exists(): continue
            out = apply_map(Image.open(src).convert('RGBA'), mp); out.save(SPR / f'{n}_gold.png')
            manifest[f'player/{n}_gold'] = {'src': f'assets/sprites/player/{n}_gold.png', 'w': out.width, 'h': out.height, 'anchor': 'bottom', 'fits': True, 'colors': len([c for c in out.getcolors(9999) if c[1][3] > 0])}
    MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True)); print('manifest updated', len(manifest))


if __name__ == '__main__':
    main()
