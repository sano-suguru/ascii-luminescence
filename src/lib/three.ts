// three.js と、画面の後処理の4つの部品（もとは src/game/00-test-mode.js の T）と、描く物を入れる場面 scene・霧の色 fogCol（もとは 05-renderer.js）。
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
/** 描く物を入れる場面。丸ごと入れ替えない */
export const scene = new T.Scene();
/** 霧の色（シェーダーと、画面を消す色に使う。src/lib/build.ts の setFog が階ごとに書き換える）。丸ごと入れ替えない */
export const fogCol = new T.Vector3(...nth(FOGS, 0));
