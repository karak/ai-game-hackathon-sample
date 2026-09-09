// カタログの敵・ボス仕様表（DOM 非依存。test/catalog.test.js が manifest との掲載漏れを検査する）
export const SPEC = {
  mirror:   { jp: '鏡像リリカ', noSprite: true, anim: '主人公のコマを反転再生（専用スプライトなし）', move: '鏡の軸 x を挟んで主人公の 1 秒前の位置を左右反転。主人公が軸から 200 以上離れると軸で待機（接触なし）', shot: 'なし（接触）', gore: '血', spawn: 'i: 軸の位置' },
  gargoyle: { jp: 'ガーゴイル人形', anim: '止まり木 / 急降下 2 コマ', move: '70 以内・下方を通ると 170/s で急降下 0.6 秒、90/s で止まり木へ戻る', shot: 'なし（接触）', gore: '骨＋血', spawn: 's' },
  balloon: { jp: '風船の亡霊', anim: '漂い / 膨張 2 コマ', move: '主人公へ 18/s で漂う。28 以内に来るか撃たれると 0.5 秒膨らんで破裂', shot: '破裂時に血の雨 5 滴（扇状）', gore: '血', spawn: 'g: マーカーの 40 上' },
  clown:   { jp: 'ピエロ骸骨', anim: '立ち / 投げ 2 コマ', move: '60 より近いと後退 22/s、160 より遠いと接近 16/s', shot: '200 以内で投げナイフ 2 本（150/s、1.8 秒毎）', gore: '骨＋血', spawn: 'j' },
  dollpart: { jp: '未完成の人形', anim: '立ち / 投げ 2 コマ', move: '150 以内で主人公へ 12/s、遠いと 10/s で往復', shot: '130 以内で腕（arm ブーメラン、2.6 秒毎）', gore: '綿＋血', spawn: 'd' },
  needles:  { jp: '縫い針の群れ', anim: '散開 / 槍 2 コマ', move: '主人公の斜め上 (−60, −40) へ 34/s で寄る → 1.6 秒後に 0.4 秒固まって 190/s で突進 0.55 秒', shot: 'なし（突進の接触）', gore: '血', spawn: 'q' },
  mermaid:  { jp: '人魚人形', anim: '待機 / 跳躍 2 コマ', move: '水面下で待機（水面上の半身のみ描く）。主人公が 56 以内・水面より上なら vy -150 で跳ね上がり、放物線で戻る（1.2〜2.0 秒間隔）', shot: 'なし（跳躍中のみ接触）', gore: '骨＋血。水面下は撃てない', spawn: 'r: 直下の ~ の上端を水面にする' },
  umbrella: { jp: '傘の妖精', anim: '傘の開閉 2 コマ 15t', move: '出現位置 ±90 の範囲で主人公の上へ 28/s で寄る、上下 ±5 浮遊', shot: '主人公の真上 24 以内で血の雨滴 3 発（1.6 秒毎）', gore: '血', spawn: 'p: マーカーの 40 上を飛ぶ' },
  cocoon:   { jp: '綿あめの繭（第二章）', anim: '吊り 2 コマ（糸で揺れる）／落下後は破れた繭', move: '天井から糸で下がって待ち、真下（±26、主人公が下側）に来ると落下 → 着地して 18±8/s で這い寄る。壁で反転', shot: 'なし（接触）', gore: '綿＋血', spawn: 'Y: 天井のタイルの下' },
  syruparm: { jp: 'シロップの腕（第二章）', anim: '伸び 2 コマ（薙ぎ払いで別コマ）', move: '溜まりから 0.4 秒で伸び上がり 0.5 秒薙ぎ、0.4 秒で沈んで 1.0〜1.8 秒待つ。沈んでいる間は接触も被弾もしない（撃つと弾かれる）', shot: 'なし（接触）', gore: '血', spawn: 'A: 地面のタイルの上' },
  zombie:   { jp: 'ゾンビうさぎ', anim: '歩き 2 コマ 12t', move: '湧き 0.7 秒 → 主人公へ 26/s 直進、壁で反転、9 秒で沈む', shot: 'なし（接触）', gore: '綿＋血。歩行中に血痕', spawn: 'z: 主人公 ±150 内で 1.5〜2.6 秒毎、前 60%/後 40%、同時 4 体' },
  mushroom: { jp: '毒キノコ妖精', anim: '羽 2 コマ 10t', move: '定位置で上下 ±6 浮遊', shot: '毒 3 連（扇状、170 以内、2.4 秒毎）→ 着弾で毒溜まり 3.5 秒', gore: '毒＋血', spawn: 'm' },
  unicorn:  { jp: '血まみれユニコーン', anim: '走り 2 コマ 6t', move: '待機 → 130 以内・同じ高さで突進 115/s、壁で反転、260 離れると待機', shot: '走行中に血滴（12%/f）', gore: '血＋肉片', spawn: 'u' },
  cake:     { jp: '腐ったケーキの精', anim: '口 2 コマ（吐く前 0.4 秒）', move: '主人公へ 18/s（30〜200 の距離で）', shot: '蛆 3 連（跳ねる、150 以内、2.6 秒毎）', gore: '血', spawn: 'k' },
  angel:    { jp: '天使の骸骨', anim: '羽 2 コマ 7t', move: '200 以内で主人公の x へ 42/s、上下 ±8 浮遊', shot: '真上に来たら骨/血を落下（1.8 秒毎）', gore: '骨＋綿＋血', spawn: 'a' },
  bear:     { jp: 'テディベア', anim: '地上/空中 2 コマ', move: '180 以内で 0.5〜1.1 秒毎に跳躍（vx 55, vy -190）', shot: 'なし（接触）。着地で血', gore: '綿＋血', spawn: 'b' },
  eye:      { jp: '目玉砲台', anim: '開/閉（開 2.5〜4 秒、閉 0.5 秒）', move: '固定', shot: '開眼中 170 以内で血の弾 95/s を狙い撃ち 1.7 秒毎。閉眼中は無敵', gore: '血', spawn: 'e' },
};

export const BOSS_SPEC = {
  noirw: { jp: '生まれ直す魔法少女 ノワール（最終章 第 2 形態）', hp: 30, states: 'ノワールと同じ行動（常に激昂: 5 連射・雨 2.2 秒・突進 230/s）＋ 3.5 秒ごとに 8 方向の光の星の環（bolt）。白いドレス、冠が直っている', shots: 'darkheart, rain, bolt', death: '同上（長尺演出は M5）' },
  sugarqueen: { jp: '砂糖の女王 マリー（第三章）', hp: 22, states: 'enter → walk(2.0s、14/s、HP 50% 以下で 22/s) → jam(ジャム 3 発放物線、酸として溜まる) | shards(飴の破片 3〜5 扇状) | stomp(跳んで着地、血の飛沫 3) の循環', shots: 'acid, bone, blood', death: '同上' },
  mirrorqueen: { jp: '鏡の女王 ヴァニタス（第六章）', hp: 30, states: 'enter(1.4s フェードイン) → pose(1.2s) → shards(破片 5 発扇状、HP 50% 以下で 7) | teleport(0.4s で消えて反対側へ) | twin(HP 50% 以下: 鏡像を反対側に置き、破片が鏡像からも同時に飛ぶ) の循環', shots: 'bolt', death: '同上' },
  ringmaster: { jp: '大観覧車の主 グランギニョル（第五章）', hp: 30, states: 'enter → stand(1.4s、HP 50% 以下で 1.0s) → whip(0.3s 後に前方 90 の横薙ぎ、しゃがみで回避) | heads(追尾する人形の頭 3〜5) | stomp(跳んで着地、骨の破片 5) の循環。部屋に観覧車 O', shots: 'darkheart, bone', death: '同上' },
  machine: { jp: '人形師の機械 マザーグース（第四章）', hp: 28, states: 'enter → roll(1.6s、26/s、HP 50% 以下で 40/s) → slam(0.5s 後に主人公の上へ針を落とす) | thread(糸弾 3 発扇状、HP 50% 以下で 5 発) | toss(人形の胴体ブーメラン) の順に循環。部屋の床はベルトコンベア', shots: 'bone, bolt, arm', death: '同上' },
  serpent: { jp: '涙の大蛇 ララバイ（第三章）', hp: 24, states: 'enter(1.5s 浮上) → sweep(川を横切る、周期 ≈11 秒、水面上 26〜52) → 主人公が 70 以内で strike(0.35s で突き出し、口を開く) | 4.5 秒ごとに rain(血の涙を吐き上げ 1 秒)。HP 50% 以下で速度 1.4 倍、雨 2 倍。胴 6 節＋尾は接触のみ（撃てない）', shots: 'rain', death: '同上' },
  doll:  { jp: '泣き人形ドロシー（第一章）', hp: 16, states: 'enter → walk(2.4s, 14/s) → cry(1.4s: 酸の涙 2 発/0.2s) | throw(腕ブーメラン)。HP 50% 以下で速度 24/s、涙に血が混ざる', shots: 'acid, blood, arm', death: '2.6 秒 血飛沫→大爆散（gore 30 / blood 60 / stuffing 20）' },
  teddy: { jp: 'はらわたテディ（第二章）', hp: 20, states: 'enter → idle(0.9s) → jump(vy -270) 着地で蛆 5 連 | 3 回に 1 回 belly(1.9s: 腹から血を扇状噴射)。HP 50% 以下で idle 0.5s', shots: 'maggot, blood', death: '同上' },
  noir:  { jp: '堕ちた魔法少女ノワール（最終章）', hp: 24, states: 'enter(1.5s) → hover(闇ハート 3 連/1.3s ×3) → teleport | rain(血の雨 2.4s) | dash(180/s)。HP 50% 以下で 5 連/0.9s、dash 230/s', shots: 'darkheart, rain', death: '同上' },
};
