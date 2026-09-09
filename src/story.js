// プロローグ・エンディングのテキスト。表示側で実測幅により折り返す。
// 英語版（IMP-008）は同じ場面数・同じ順で _EN に置き、story() で現在の言語のものを返す
import { pick } from './i18n.js';
export const PROLOGUE = [
  'むかしむかし、おとぎの国は',
  'ひとりの魔法少女に',
  '守られていた。',
  '',
  'ある日、彼女は世界を呪った。',
  '花は腐り、うさぎは血を吐き、',
  '砂糖の城は赤く染まった。',
  '',
  '見習い魔女リリカ、15歳。',
  '今日は、その後始末をする日。',
];
export const PROLOGUE_EN = [
  'Once upon a time, the fairyland',
  'was watched over by',
  'a single magical girl.',
  '',
  'One day, she cursed the world.',
  'Flowers rotted, rabbits spat blood,',
  'and the sugar castle turned red.',
  '',
  'Lyrica, apprentice witch, age 15.',
  'Today is the day she cleans up the mess.',
];
// エンディングの 6 場面（生成イラスト assets/sprites/ending/sceneN と対）。各場面 2〜3 行
export const ENDING_SCENES = [
  ['星の墓標の果てで、ノワールは', '静かに崩れた。', '「……ありがとう」そう聞こえた気がした。'],
  ['おとぎの国に朝が来る。', '花はまだ半分腐っているけれど。'],
  ['洗濯物は血まみれだけれど。', 'どうやっても落ちないけれど。'],
  ['リリカは帽子を直した。', '見習い魔女、15歳。今日の仕事はおしまい。'],
  ['ほうきに乗って、朝日の中へ。', '砂糖の城はまだ赤い。それでも。'],
  ['「さ、帰って宿題やろ」', 'ＴＨＥ　ＥＮＤ'],
];
export const ENDING_SCENES_EN = [
  ['At the far end of the Grave of Stars,', 'Noir quietly crumbled.', '"...Thank you." Or so it seemed to say.'],
  ['Morning comes to the fairyland.', 'Half the flowers are still rotten, but still.'],
  ['The laundry is soaked in blood.', 'It will never come out. But still.'],
  ['Lyrica straightened her hat.', 'Apprentice witch, age 15. Work is done for today.'],
  ['Onto the broom, into the sunrise.', 'The sugar castle is still red. Even so.'],
  ['"Right. Home. Homework."', 'THE END'],
];
// 2 周目（真の結末）の追加場面。1 周目の 6 場面の後に 1 場面。生成イラスト scene7 が無ければ scene5 を流用
export const ENDING_TRUE = ['二度目の朝。呪いの根は、リリカ自身の', '「守りたい」だった。', '彼女はそれを、今度は手放さなかった。', 'ＴＲＵＥ　ＥＮＤ'];
export const ENDING_TRUE_EN = ['The second morning. The root of the curse', 'was Lyrica\'s own wish "to protect".', 'This time, she did not let it go.', 'TRUE END'];
export const CREDITS = [
  'マジカル☆リリカと血塗られたおとぎの国',
  '',
  '企画・設計・実装', 'yasushi + Claude',
  '',
  'ドット絵生成', 'Gemini 2.5 Flash Image',
  '後処理・合成', 'tools/postprocess.py',
  '',
  'フォント', 'DotGothic16 (SIL OFL 1.1)',
  '音楽・効果音', 'Web Audio 合成（自作）',
  '',
  'Special Thanks', '超魔界村 / 聖剣伝説2 / ロマンシング サ・ガ3 / クロノ・トリガー',
  '',
  'THANK YOU FOR PLAYING',
];
export const CREDITS_EN = [
  'Magical Lyrica and the Bloodstained Fairyland',
  '',
  'Design & Code', 'yasushi + Claude',
  '',
  'Pixel Art Generation', 'Gemini 2.5 Flash Image',
  'Post-processing', 'tools/postprocess.py',
  '',
  'Font', 'DotGothic16 (SIL OFL 1.1)',
  'Music & SFX', 'Web Audio synthesis (original)',
  '',
  'Special Thanks', 'Super Ghouls \'n Ghosts / Secret of Mana / Romancing SaGa 3 / Chrono Trigger',
  '',
  'THANK YOU FOR PLAYING',
];
// 現在の言語の本文。呼び出し側は毎回これを通す（オプションで言語を切り替えた直後にも効くように）
export const story = () => ({
  prologue: pick({ ja: PROLOGUE, en: PROLOGUE_EN }),
  scenes: pick({ ja: ENDING_SCENES, en: ENDING_SCENES_EN }),
  trueEnd: pick({ ja: ENDING_TRUE, en: ENDING_TRUE_EN }),
  credits: pick({ ja: CREDITS, en: CREDITS_EN }),
});
// ボス名（world.js bossName が t() を通して表示する）
export const BOSS_NAMES = { doll: '泣き人形 ドロシー', teddy: 'はらわたテディ', noir: '堕ちた魔法少女 ノワール', noirw: '生まれ直す魔法少女 ノワール', serpent: '涙の大蛇 ララバイ', machine: '人形師の機械 マザーグース', ringmaster: '大観覧車の主 グランギニョル', mirrorqueen: '鏡の女王 ヴァニタス', sugarqueen: '砂糖の女王 マリー' };
export const ENDING = [
  '星の墓標の果てで、ノワールは',
  '静かに崩れた。',
  '「……ありがとう」',
  'そう聞こえた気がした。',
  '',
  'おとぎの国に朝が来る。',
  '花はまだ腐っているし、',
  '洗濯物は血まみれだけれど。',
  '',
  'リリカは帽子を直して、',
  'ほうきに乗った。',
  '「さ、帰って宿題やろ」',
  '',
  'ＴＨＥ　ＥＮＤ',
];
