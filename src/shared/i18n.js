// 表示言語（IMP-008 英語 UI）。ソース中の日本語文字列がキーで、en のときだけ辞書で置き換える。
// 使い方: t('はじめから') → 'New Game'（en）/ 'はじめから'（ja）。{n} などの変数は第 2 引数で埋める。
// 辞書に無いキーは日本語のまま表示し、test/i18n.test.js が t() の呼び出しを走査して漏れを検出する。
export const LANGS = ['ja', 'en'];
export const LANG_LABEL = { ja: '日本語', en: 'English' };
let lang = 'ja';
export const getLang = () => lang;
export function setLang(l) { lang = LANGS.includes(l) ? l : 'ja'; return lang; }
// ブラウザの言語から既定を決める（保存済みの設定が無いときだけ使う）。ja 以外は en
export function detectLang(nav = globalThis.navigator) { const l = String(nav?.language ?? 'ja').toLowerCase(); return l.startsWith('ja') ? 'ja' : 'en'; }

export const EN = {
  // タイトル・メニュー
  'はじめから': 'New Game', 'つづきから（第{n}章）': 'Continue (Chapter {n})', '2 周目（真の結末）': '2nd Loop (True End)', 'オプション': 'Options',
  'マジカル☆リリカと': 'MAGICAL ☆ LYRICA', '血塗られたおとぎの国': 'and the Bloodstained Fairyland', 'MAGICAL LYRICA AND THE BLOODSTAINED FAIRYLAND': 'マジカル☆リリカと血塗られたおとぎの国',
  // ポーズ・ゲームオーバー・クリア
  'つづける': 'Resume', '面の はじめから': 'Restart Stage', 'タイトルへ': 'Quit to Title', 'コンティニュー（面の はじめから）': 'Continue (Restart Stage)',
  'おとぎの国は赤いまま': 'The fairyland stays red', 'ステージクリア！': 'STAGE CLEAR!', '次の章へ…': 'To the next chapter...', '最終決戦へ…': 'To the final battle...',
  // オプション
  'おんりょう': 'Volume', 'ミュート': 'Mute', 'げんご': 'Language', 'キー か ボタン を おしてください': 'Press a key or button', 'そうさを しょきかに もどす': 'Reset controls', 'タイトルへ もどる': 'Back to title',
  'ひだり': 'Left', 'みぎ': 'Right', 'うえ': 'Up', 'した': 'Down', 'まほう': 'Magic', 'ジャンプ': 'Jump', 'けってい': 'OK', 'ポーズ': 'Pause',
  // オプション: パッド診断・テスター報告（実機パッド確認とテスター計測の再開、2026-09-10）
  'ゲームパッド': 'Gamepad', 'みけんしゅつ': 'not detected', 'テスター報告を コピー': 'Copy tester report', 'コピーしました': 'Copied', 'コピーできません': 'Copy failed',
  // 溜め魔法（L1）と強化魔法（L2）の名前。発動時にトーストで出る（magic.js MAGIC / SUPER）
  '流星群': 'Meteor Shower', '影の連射': 'Shadow Volley', '大爆発': 'Big Bang', '火柱': 'Fire Pillars',
  '星屑の葬列': 'Stardust Cortege', '鏡像の舞踏会': 'Mirror Waltz', '心臓の花園': 'Heart Garden', '蝋の聖歌隊': 'Wax Choir',
  // ゲーム内トースト
  '先へ進め': 'Move on', '祈りの十字路：ここから再開できる': 'Prayer crossroads: checkpoint', '変身が解けた…！': 'Transformation broken...!',
  '魔法のドレス！': 'Magic Dress!', 'フルブルームドレス！ためうちが使える': 'Full Bloom Dress! Hold to charge', 'リリカ人形 ＋１': 'Lyrica Doll +1', 'いちごポーション': 'Strawberry Potion',
  // 章題（levels/index.js title / subtitle）
  '第一章　花畑の墓地': 'Chapter 1  Graveyard of Flowers', '土の下から、可愛いものたちが這い出してくる': 'Cute things crawl out from under the soil',
  '第二章　毒沼の菓子の森': 'Chapter 2  Candy Forest of Poison Bogs', '甘い匂いは、腐った匂いと見分けがつかない': 'Sweet smells and rotten smells are hard to tell apart',
  '第三章　血染めの砂糖城': 'Chapter 3  Bloodstained Sugar Castle', 'かつて、彼女も誰かの希望だった': 'Once, she too was someone\'s hope',
  '第四章　涙の川': 'Chapter 4  River of Tears', '泣いているのは、川ではない': 'It is not the river that weeps',
  '第五章　綿雪の人形工房': 'Chapter 5  Snow-Cotton Doll Workshop', 'ここで、わたしたちは作られた': 'This is where we were made',
  '第六章　骨の遊園地': 'Chapter 6  Amusement Park of Bones', '笑い声は、いつまでも鳴りやまない': 'The laughter never stops',
  '第七章　鏡の塔': 'Chapter 7  Tower of Mirrors', '鏡の中のわたしは、笑っていない': 'The me in the mirror is not smiling',
  '最終章　星の墓標': 'Final Chapter  Grave of Stars', 'ぜんぶ、ここで終わらせる': 'It all ends here',
  // ボス名（story.js BOSS_NAMES）
  '泣き人形 ドロシー': 'Dorothy the Weeping Doll', 'はらわたテディ': 'Gutted Teddy', '堕ちた魔法少女 ノワール': 'Noir, the Fallen Magical Girl', '生まれ直す魔法少女 ノワール': 'Noir, the Magical Girl Reborn',
  '涙の大蛇 ララバイ': 'Lullaby the Serpent of Tears', '人形師の機械 マザーグース': 'Mother Goose, the Dollmaker\'s Machine', '大観覧車の主 グランギニョル': 'Grand Guignol, Lord of the Wheel', '鏡の女王 ヴァニタス': 'Vanitas the Mirror Queen', '砂糖の女王 マリー': 'Marie the Sugar Queen',
};

export function t(ja, vars = null) {
  let s = lang === 'en' ? (EN[ja] ?? ja) : ja;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
// 言語別の配列（物語本文など）。{ ja: [...], en: [...] } から現在の言語のものを返す
export const pick = (byLang) => byLang[lang] ?? byLang.ja;
