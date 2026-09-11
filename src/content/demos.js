// デモ入力ログ（assets/demo/*.json）。tools ではなくブラウザ上の記録（Game.startRecording → stopRecording）で作る
// 2026-09-11: 全面を録るなら node tools/record_demos.mjs（無敵なしのボット。再生と同じ条件で収録し、再生の軌跡が一致することを確認する。IMP-015）。
// ファイル名は面名（assets/demo/<面名>.json）。再生時は配列の位置ではなく記録時の面名（stage）で照合する（findDemo）
import stage1 from '../../assets/demo/stage1.json';
import stage2 from '../../assets/demo/stage2.json';
import stage3 from '../../assets/demo/stage3.json';
import river from '../../assets/demo/stage-river.json';
import workshop from '../../assets/demo/stage-workshop.json';
import park from '../../assets/demo/stage-park.json';
import tower from '../../assets/demo/stage-tower.json';
import stars from '../../assets/demo/stage-stars.json';
// 面 index 順。frames が 0 のものは未収録として飛ばす
export const DEMOS = [stage1, stage2, stage3, river, workshop, park, tower, stars];
