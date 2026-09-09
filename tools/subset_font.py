#!/usr/bin/env python3
"""ゲーム用フォントのサブセット化（IMP-019）。

DotGothic16 全字形（2.07 MB）から、ゲーム本体が描く文字だけを残した assets/fonts/DotGothic16-Game.ttf を作る。
文字の出所: src/**/*.js（catalog を除く）の文字列リテラル、index.html の本文、ASCII 全印字文字、i18n 辞書、
数字・記号（HUD／メニューの ■□◀▶▼←→↑↓、全角英数字）。集めた文字は assets/fonts/game-chars.txt に書き、
test/font-subset.test.js がソースの文字が全てこの一覧に入っていることを検査する。
カタログ（catalog.html）は任意の説明文を出すので全字形のままにする。

  .venv/bin/python tools/subset_font.py        # 生成＋検証（欠けた字形があれば非 0 で終了）
"""
import glob, re, subprocess, sys
from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC_FONT = ROOT / 'assets/fonts/DotGothic16-Regular.ttf'
OUT_FONT = ROOT / 'assets/fonts/DotGothic16-Game.ttf'
CHARS_TXT = ROOT / 'assets/fonts/game-chars.txt'
# 文字列リテラルからは拾えないが描く可能性のある文字（動的に組み立てる値・記号）
EXTRA = ''.join(chr(c) for c in range(0x20, 0x7F)) + '■□◀▶▼▲←→↑↓☆★…・ー、。「」（）！？：＋－０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ　'

STR_RE = re.compile(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`((?:[^`\\]|\\.)*)`")

def source_chars():
    chars = set(EXTRA)
    for f in glob.glob(str(ROOT / 'src/**/*.js'), recursive=True):
        if '/catalog/' in f: continue
        s = Path(f).read_text(encoding='utf-8')
        s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
        s = re.sub(r'(^|[^:\\])//[^\n]*', r'\1', s)  # 行コメント（URL の :// は残す）
        for m in STR_RE.finditer(s): chars.update(m.group(1) or m.group(2) or m.group(3) or '')
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    body = re.sub(r'<style>.*?</style>|<script.*?</script>|<[^>]+>', ' ', html, flags=re.S)
    chars.update(body)
    return {c for c in chars if ord(c) >= 0x20 and c not in '  '}

def main():
    chars = source_chars()
    text = ''.join(sorted(chars))
    CHARS_TXT.write_text(text + '\n', encoding='utf-8')
    subprocess.run([sys.executable, '-m', 'fontTools.subset', str(SRC_FONT), f'--text-file={CHARS_TXT}', f'--output-file={OUT_FONT}',
                    '--layout-features=*', '--no-hinting', '--desubroutinize', '--name-IDs=*', '--notdef-outline'], check=True)
    cmap = TTFont(str(OUT_FONT)).getBestCmap()
    missing = [c for c in chars if ord(c) not in cmap and not c.isspace()]
    src_cmap = TTFont(str(SRC_FONT)).getBestCmap()
    not_in_source = [c for c in missing if ord(c) not in src_cmap]
    print(f'chars {len(chars)} → {OUT_FONT.name} {OUT_FONT.stat().st_size / 1024:.0f} KB (full {SRC_FONT.stat().st_size / 1024:.0f} KB), glyphs {len(cmap)}')
    fallback = [c for c in missing if c in not_in_source]
    lost = [c for c in missing if c not in not_in_source]
    if fallback:
        # DotGothic16 自体に字形が無い文字（▶◀ など）。元々ブラウザのフォールバックフォントで描かれているので欠字ではない
        print('not in DotGothic16 (browser fallback, unchanged):', ''.join(fallback))
    if lost:
        print('MISSING (present in the full font but dropped from the subset):', ''.join(lost)); return 1
    return 0

if __name__ == '__main__': sys.exit(main())
