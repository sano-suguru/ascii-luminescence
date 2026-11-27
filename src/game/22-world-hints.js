// ---------------------------------------------------------------- drawing: runes on the floor, pedestals, altars, steles, beams, a ring while swapping, the chant at your hands
// 先にある物の手がかり（表 STRATUM_OMEN など・computeOmen・omenOf・omenSound・drawOmens）と階段の封（stairsGuarded・drawStairSeal）は src/lib/omens.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- direction arrows
// 方向の矢印（drawArrows と、行き先 arrowTargets・見通せるか inPlainSight・文字盤の傾き ARROW_TILT・ARROW_TILT0）は src/lib/arrows.ts（drawArrows を src/game/imports.mjs で読む）。描くキャンバスと描き手と下の HUD は、ここで document から ui に入れる
ui.arrowCv=document.getElementById('arrows'); ui.arrowCtx=ui.arrowCv?ui.arrowCv.getContext('2d'):null; ui.hotbarEl=document.getElementById('hotbar');
// where the line at the bottom (#hotbar) starts, in CSS pixels (-1: hidden), kept in ui.hotbarTop until it or the window changes size, so the page's layout is not read every tick
// (reading it right after the status or the log was written makes the browser lay the page out again). Without ResizeObserver it is read every time
ui.hotbarWatch=!!(ui.hotbarEl&&window.ResizeObserver);
if(ui.hotbarWatch){ new ResizeObserver(()=>{ ui.hotbarTop=null; }).observe(ui.hotbarEl); addEventListener('resize',()=>{ ui.hotbarTop=null; }); }
// 階の場所ごとの空気 updateSectionAir は src/lib/camera.ts（呼ぶのは drawRunesWorld）
// 墓を描く drawGraves と、床のルーン・台・祭壇・石碑と術の跡を描く drawRunesWorld は src/lib/fixtures.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- the feel of a chant: a circle of runes at the hand, light gathering, the screen taking the element's colour
// 詠唱の声 humNode は src/lib/state.ts の gear（src/game/imports.mjs で読む）
// castSound は src/lib/audio.ts（src/game/imports.mjs で読む）
// 照準の小さな関数（handUp・aimPoint・centerPoint・castPoint・handPoint）は src/lib/aim.ts（src/game/imports.mjs で読む）
// shotFrame は src/lib/aim.ts（src/game/imports.mjs で読む）
// assistPoint は src/lib/aim.ts（src/game/imports.mjs で読む）
// aimTarget は src/lib/aim.ts（src/game/imports.mjs で読む）
// 詠唱の見た目 drawCastFx・照準の文字 updateCross と、術が飛ぶ道 simPath は src/lib/chantfx.ts（drawCastFx・updateCross を src/game/imports.mjs で読む）
