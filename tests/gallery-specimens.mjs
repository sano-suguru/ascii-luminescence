// 画面写真の比較（tests/visual.mjs）で写す図鑑の生き物と、その写し方。図鑑の乱数の確かめ（tests/gallery.mjs）も同じ物を使う。
// scene：画面写真の名前、name：図鑑の名前、yaw・pose・zoom：__test.galleryShow に渡す向き・姿・寄り（体の高さの真ん中を画面の真ん中に写す center も付ける）。
// zoom は、生き物が画面の高さの6〜7割を占め、どこも切れない値
export const GALLERY_SPECIMENS = [
  { scene: 'gal-dragon', name: '竜', yaw: 0.6, pose: 'stand', zoom: 1.15 }, // 四つ足の大きな形・翼・頭
  { scene: 'gal-ogre', name: 'オーガ', yaw: 0.25, pose: 'walk', zoom: 2 }, // 人型の見た目（lookHumanoid・extraLook）と歩く足
  { scene: 'gal-lichking', name: '不死の王', yaw: 0.25, pose: 'stand', zoom: 1.7 }, // 主の形とまわりの粒子（lichAura）・冠の光
  { scene: 'gal-beast', name: '燃える鱗の竜（見本）', yaw: 0.6, pose: 'stand', zoom: 1.6 }, // 忘れられた獣の組み立て（buildForm）
];
