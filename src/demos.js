// デモ入力ログ（assets/demo/*.json）。tools ではなくブラウザ上の記録（Game.startRecording → stopRecording）で作る
import d1 from '../assets/demo/stage1.json';
import d2 from '../assets/demo/stage2.json';
import d3 from '../assets/demo/stage3.json';
import d4 from '../assets/demo/stage4.json';
// 面 index 順。frames が 0 のものは未収録として飛ばす
export const DEMOS = [d1, d2, d3, d4];
