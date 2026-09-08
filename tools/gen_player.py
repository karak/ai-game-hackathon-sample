#!/usr/bin/env python3
"""主人公リリカ(32x48)のドット絵定義を生成して src/gfx/sprites/player.js に書き出す。

行幅・行数を検証してから書くので、手作業のズレをコンパイル前に検出できる。
編集は本ファイルの文字列を直し、`python3 tools/gen_player.py` で再生成する。
"""
from pathlib import Path

W = 32
OUT = Path(__file__).resolve().parent.parent / 'src/gfx/sprites/player.js'


def chk(name, rows, n=None):
    bad = [(i, len(r)) for i, r in enumerate(rows) if len(r) != W]
    if bad:
        raise SystemExit(f'WIDTH {name}: {bad}')
    if n is not None and len(rows) != n:
        raise SystemExit(f'ROWS {name}: {len(rows)} != {n}')
    return rows


# ---- 頭部 (18行) 髪 s/t/c/d, 肌 2/3/4/k, 目 1/N/P, 頬 6 ----
HEAD = [
    '............00000000............',
    '..........00ssssssss00..........',
    '.........0sscccsssssss0.........',
    '........0ssccssssssssst0........',
    '.......0sscsssssssssssst0.......',
    '......0ssscssssssssssstts0......',
    '......0sssssssssssssssttts0.....',
    '.....0sss0000333333330sttts0....',
    '.....0ss03333333333330stts0.....',
    '.....0ss0333333333333330tts0....',
    '.....0s03331NN33331NN3330tts0...',
    '.....0s0333NPP3333NPP3330tts0...',
    '.....0s0333NP13333NP13330tts0...',
    '.....0s033633333333363330tts0...',
    '......0s033333333k33333330ts0...',
    '.......0s033333333333333330ts0..',
    '........0ss03333333330sts0......',
    '.........0ss0333333330ss0.......',
]
NECK_COLLAR = [
    '..........0ss00433400ss0........',
    '..........0sss0rrrr0sss0........',
]
TORSO_IDLE = [
    '.........0bpp0rrrrrr0ppa0.......',
    '........0bppp0rrrrrr0pppa0......',
    '.......0qbppp0rrKKrr0pppaq0.....',
    '.......0qqbpp0bpppppa0ppaqq0....',
    '.......0qqq0.0bpppppa0.0qqq0....',
    '........0330.0bpppppa0.0330.....',
    '........0430..0bpppa0..0430.....',
]
SKIRT = [
    '.........00..0yqqqqqe0..00......',
    '............0yqqeqqqqe0.........',
    '...........0yyqqeqqqqqe0........',
    '..........0yyqqqeqqqqqqe0.......',
    '.........0yyqqqqeqqqqqqqe0......',
    '........0yyqqqqqeqqqqqqqee0.....',
    '.......0yyqqqqqqeqqqqqqqeee0....',
]
TOP_IDLE = chk('idle', HEAD + NECK_COLLAR + TORSO_IDLE + SKIRT, 34)

# 攻撃: 画面右の腕を前へ伸ばす
TORSO_ATTACK = [
    '.........0bpp0rrrrrr0ppa0.......',
    '........0bppp0rrrrrr0pppa0......',
    '.......0qbppp0rrKKrr0pppaqq0....',
    '.......0qqbpp0bpppppa0ppaqqq0...',
    '.......0qqq0.0bpppppa00.0qq0.3..',
    '........0330.0bpppppa0.0.003330.',
    '........0430..0bpppa0....00330..',
]
TOP_ATTACK = chk('attack', HEAD + NECK_COLLAR + TORSO_ATTACK + SKIRT, 34)

# ジャンプ: 両腕を上げ、髪とスカートが浮く
HEAD_JUMP = HEAD[:7] + [
    '.....0sss0000333333330sttts0....',
    '.....0ss03333333333330stts0.....',
    '.....0ss0333333333333330tts0....',
    '.....0s03331NN33331NN3330tts0...',
    '.....0s0333NPP3333NPP3330tts0...',
    '.....0s0333NP13333NP13330tts0...',
    '.....0s033633333333363330tts0...',
    '......0s033333333133333330ts0...',
    '.......0s033333333333333330ts0..',
    '........0ss03333333330sts0......',
    '.........0ss0333333330ss0.......',
]
TORSO_JUMP = [
    '....33...0bpp0rrrrrr0ppa0.33....',
    '...0330.0bppp0rrrrrr0pppa00330..',
    '...0qq00qbppp0rrKKrr0pppaq0qq0..',
    '....0qqqqqbpp0bpppppa0ppaqqqq0..',
    '.....0qqq00..0bpppppa0..0qqq0...',
    '......000....0bpppppa0...000....',
    '..............0bpppa0...........',
]
SKIRT_JUMP = [
    '..........0yqqqqqqqqqe0.........',
    '.........0yyqqeqqqqqqqe0........',
    '........0yyqqqeqqqqqqqqe0.......',
    '.......0yyqqqqeqqqqqqqqee0......',
    '.......0yyqqqqqeqqqqqqqeee0.....',
    '......0yyqqqqqqeqqqqqqqqeee0....',
    '......0yyqqqqqqeqqqqqqqqeeee0...',
]
TOP_JUMP = chk('jump', HEAD_JUMP + NECK_COLLAR + TORSO_JUMP + SKIRT_JUMP, 34)

# 被弾: 目を閉じ(><)、口を開け、髪が跳ねる
HEAD_HURT = [
    '...........000000000.0..........',
    '.........00ssssssss00s0.........',
    '........0sscccsssssss0ss0.......',
    '.......0ssccsssssssssst0s0......',
    '.......0sscsssssssssssst00......',
    '......0ssscssssssssssstts0......',
    '......0sssssssssssssssttts0.....',
    '.....0sss0000333333330sttts0....',
    '.....0ss03333333333330stts0.....',
    '.....0ss0333333333333330tts0....',
    '.....0s0330033333330033330tts0..',
    '.....0s0333003333330033330tts0..',
    '.....0s0330033333330033330tts0..',
    '.....0s033633333333363330tts0...',
    '......0s0333330LL03333330ts0....',
    '.......0s0333300003333330ts0....',
    '........0ss03333333330sts0......',
    '.........0ss0333333330ss0.......',
]
TOP_HURT = chk('hurt', HEAD_HURT + NECK_COLLAR + TORSO_JUMP + SKIRT, 34)

LEGS = {
    'stand': [
        '......0rrrrrrrrrrrrrrrrrrrrrr0..',
        '............0333..3330..........',
        '............0333..3330..........',
        '............0433..3340..........',
        '............0rr0..0rr0..........',
        '...........0hCC0..0hCC0.........',
        '...........0hCCC0.0hCCC0........',
        '...........0hCCCi00hCCCi0.......',
        '..........0hhCCCi00hhCCCi0......',
        '..........0hCCCCi00hCCCCi0......',
        '.........0hCCCCCi00hCCCCCi0.....',
        '.........0hCCCCCii0hCCCCCii0....',
        '.........0iiiiiiii0iiiiiiii0....',
        '.........0000000000000000000....',
    ],
    'run1': [  # 開脚（右足前・左足後ろ）
        '......0rrrrrrrrrrrrrrrrrrrrrr0..',
        '.........0333........3330.......',
        '........0333..........3330......',
        '.......0433............3340.....',
        '......0rr0..............0rr0....',
        '.....0hCC0...............0hCC0..',
        '....0hCCC0...............0hCCC0.',
        '....0hCCCi0..............0hCCCi0',
        '...0hhCCCi0.............0hhCCCi0',
        '...0hCCCCi0.............0hCCCCi0',
        '..0hCCCCCi0.............0hCCCCi0',
        '..0hCCCCii0.............0hCCCii0',
        '..0iiiiiii0.............0iiiiii0',
        '..000000000.............00000000',
    ],
    'run2': [  # 交差（足が揃う）
        '......0rrrrrrrrrrrrrrrrrrrrrr0..',
        '............0333.3330...........',
        '............0333.3330...........',
        '............0433.3340...........',
        '............0rr0.0rr0...........',
        '...........0hCC0.0hCC0..........',
        '...........0hCCC00hCCC0.........',
        '...........0hCCCi0hCCCi0........',
        '..........0hhCCCi0hhCCCi0.......',
        '..........0hCCCCi0hCCCCi0.......',
        '.........0hCCCCCi0hCCCCCi0......',
        '.........0hCCCCCii0CCCCCii0.....',
        '.........0iiiiiiii0iiiiiii0.....',
        '.........000000000000000000.....',
    ],
    'run3': [  # 開脚（左足前・右足を後ろに蹴り上げ）
        '......0rrrrrrrrrrrrrrrrrrrrrr0..',
        '.........0333........3330.......',
        '........0333........03330.......',
        '.......0433........0hCC40.......',
        '......0rr0........0hCCCC0.......',
        '.....0hCC0.......0hCCCCi0.......',
        '....0hCCC0.......0hCCCii0.......',
        '....0hCCCi0......0iiiiii0.......',
        '...0hhCCCi0.......000000........',
        '...0hCCCCi0.....................',
        '..0hCCCCCi0.....................',
        '..0hCCCCii0.....................',
        '..0iiiiiii0.....................',
        '..000000000.....................',
    ],
    'run4': [  # 交差（もう一方）
        '......0rrrrrrrrrrrrrrrrrrrrrr0..',
        '............0333.3330...........',
        '............0333.3330...........',
        '............0433.3340...........',
        '............0rr0.0rr0...........',
        '...........0hCC0.0hCC0..........',
        '..........0hCCC0.0hCCC0.........',
        '.........0hCCCi0.0hCCCi0........',
        '........0hhCCCi0.0hhCCCi0.......',
        '........0hCCCCi0.0hCCCCi0.......',
        '.......0hCCCCCi0.0hCCCCCi0......',
        '.......0hCCCCCii00hCCCCCii0.....',
        '.......0iiiiiiii00iiiiiiii0.....',
        '.......0000000000000000000000...',
    ],
    'jump': [  # 上昇: 膝を抱える
        '......0rrrrrrrrrrrrrrrrrrrrrr0..',
        '...........0333..0333...........',
        '..........0433..0433............',
        '.........0rr0..0rr0.............',
        '........0hCC0.0hCC0.............',
        '........0hCCC00hCCC0............',
        '.......0hCCCi00hCCCi0...........',
        '.......0hCCCCi0hCCCCi0..........',
        '......0hCCCCCi0hCCCCCi0.........',
        '......0hCCCCiii0CCCCii0.........',
        '......0iiiiiii0iiiiiii0.........',
        '......00000000.0000000..........',
        '................................',
        '................................',
    ],
    'fall': [  # 下降: 脚を伸ばし片足前
        '......0rrrrrrrrrrrrrrrrrrrrrr0..',
        '..........0333.....3330.........',
        '..........0333......3330........',
        '..........0433.......3340.......',
        '..........0rr0.......0rr0.......',
        '.........0hCC0........0hCC0.....',
        '.........0hCCC0.......0hCCC0....',
        '........0hCCCi0.......0hCCCi0...',
        '........0hCCCCi0.....0hhCCCCi0..',
        '.......0hCCCCCi0.....0hCCCCCi0..',
        '.......0hCCCCCii0....0hCCCCCii0.',
        '.......0iiiiiiii0....0iiiiiiii0.',
        '.......000000000......000000000.',
        '................................',
    ],
}
for k, v in LEGS.items():
    chk('legs.' + k, v, 14)

CROUCH = chk('crouch', ['.' * 32] * 14 + HEAD + [
    '..........0ss00433400ss0........',
    '.........0qsss0rrrr0sssq0.......',
    '........0qqbpp0rrKKrr0ppaqq0....',
    '.......0qqq0bpp0rrrr0ppa0qqq03..',
    '.......0330.0bpppppppa0..0330...',
    '.....0yyqqqqqqqqeqqqqqqqqqeee0..',
    '....0yyqqqqqqqqqeqqqqqqqqqqeee0.',
    '....0rrrrrrrrrrrrrrrrrrrrrrrrr0.',
    '....0hCCCi0............0hCCCi0..',
    '...0hCCCCii0..........0hCCCCii0.',
    '...0hCCCCCii0.........0hCCCCCii0',
    '...0iiiiiiii0.........0iiiiiiii0',
    '...000000000..........0000000000',
    '................................',
    '................................',
    '................................',
], 48)

DEAD = chk('dead', ['.' * 32] * 28 + [
    '....................000000000...',
    '..................00sssssssss0..',
    '.................0sscccssssssss0',
    '............00000ss0333333330ss0',
    '..........0yqqqqqp3033NP3NP3s0..',
    '.........0yqqqqqqpp33333333330..',
    '........0yqqqqqqqppp3333LL3330..',
    '........0yqqqqqqqppppp3333330...',
    '........0yqqqqeqqpppppp033330...',
    '........0yqqqqeqqppppppp00.00...',
    '........0rrrrrrrrrrrrrr0........',
    '.........0hCCCCi00hCCCCi0.......',
    '.........0iiiiii00iiiiii0.......',
    '..........000000..000000........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
], 48)

HAT = chk('hat', [
    '...................000..........',
    '..................0hC0..........',
    '.................0hCC0..........',
    '................0hCCC0..........',
    '...............0hCCCC0..........',
    '..............0hCCCCCi0.........',
    '.............0hCCCCCCi0.........',
    '............0hCCCCCCCii0........',
    '...........0hhCCCCCCCCii0.......',
    '..........0hrrrrrrrrrrrri0......',
    '.........0hrrrDDrrrrrrrri0......',
    '..000000hhCCCCCCCCCCCCCii000000.',
    '.0hhhhhCCCCCCCCCCCCCCCCCCCiiiii0',
    '0hhCCCCCCCCCCCCCCCCCCCCCCCCCiii0',
    '.0iiiiiiiiiiiiiiiiiiiiiiiiiiii0.',
    '..0000000000000000000000000000..',
], 16)

BROOM = chk('broom', [
    '..........................DDDD..',
    '0000000000000000000000000000DYDD',
    'wFFFFFFFFFFFFFFFFFFFFFFFFF0YDDYD',
    'GGGGGGGGGGGGGGGGGGGGGGGGGG0DYDDD',
    '..........................0DDYD.',
    '...........................DDD..',
], 6)


def js(rows, ind='  '):
    return '[\n' + '\n'.join(f"{ind}  '{r}'," for r in rows) + f'\n{ind}]'


out = """// 主人公リリカのドット絵（32x48、docs/art-standard.md §2.1）。上半身(34行)+脚(14行)を合成。帽子・ほうきは別レイヤー。
// 右向き。'.' 透明。パレットキーは palette.js 参照。衣装キー p/a/b/q/e/y/r/s/t/c/d は衣装ごとに置換。
// 陰影はすべて手置き（自動シェーディング不使用）。このファイルは tools/gen_player.py から生成される。

export const PLAYER_TOP = {
  idle: %s,
  attack: %s,
  jump: %s,
  hurt: %s,
};

export const PLAYER_LEGS = {
%s
};

// しゃがみ・死亡は単独フレーム(32x48)
export const PLAYER_FULL = {
%s
};

// 魔女帽子(32x16)。スプライト上端に対して y=-11 の位置に描く（つばが髪の上にかかる）。
export const HAT = %s;

// ほうき (二段ジャンプ時に足元に出る) 32x6
export const BROOM = %s;
""" % (js(TOP_IDLE), js(TOP_ATTACK), js(TOP_JUMP), js(TOP_HURT),
       '\n'.join(f"  {k}: {js(v)}," for k, v in LEGS.items()),
       '\n'.join(f"  {k}: {js(v)}," for k, v in {'crouch': CROUCH, 'dead': DEAD}.items()),
       js(HAT, ''), js(BROOM, ''))
OUT.write_text(out)
print('wrote', OUT)
