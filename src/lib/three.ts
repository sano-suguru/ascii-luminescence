// three.js と、画面の後処理の4つの部品（もとは src/game/00-test-mode.js の T）と、霧の色 fogCol（もとは 05-renderer.js）。
// ここで作ってよいのは、作る時に乱数を引かない物だけ（three.js の Object3D・Material などは、作る時に Math.random で uuid を作る。
// このモジュールはテスト用モードの乱数の入れ替えより先に読まれるので、ここで作ると、その後の見た目の乱数がずれる）。場面 scene は src/lib/render.ts の initRenderer が作る（gfx.scene）
// three.js（r147）は npm の three から組み立てに入れる（CDN からは読まない）。型は @types/three。
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FOGS } from './world.ts';
import { nth } from './array.ts';

/** three.js と、画面の後処理の部品（光のにじみなど） */
export const T = { ...THREE, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass };
/** 霧の色（シェーダーと、画面を消す色に使う。src/lib/build.ts の setFog が階ごとに書き換える）。丸ごと入れ替えない */
export const fogCol = new T.Vector3(...nth(FOGS, 0));
