// ---------------------------------------------------------------- the weapons in hand
// VM_ST・vmGlyphS・vmGlyph と形と色の表（VM_MODELS・VM_PART・VM_BRIGHT・VM_REST・VM_REST_HOT・VM_TINT・VM_FIST）は src/lib/hands.ts（古い JS が読むのは、そのうち src/game/imports.mjs にある物）
// RUNE_FONT・TRAIT_V・pct など 18 個は src/lib/runes.ts（古い JS が読むのは、そのうち src/game/imports.mjs にある物）
// 手元の武器を描く drawViewWeapons は src/lib/held.ts（src/game/imports.mjs で読む）
// 武器を振った線 drawSwing は src/lib/aim.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- runes: attacks and elements held in each hand, chanting, reactions
// RUNE_DEF は src/lib/runes.ts（src/game/imports.mjs で読む）
// ルーンの名前・色・付けられるか（runeName・canPut など）は src/lib/runes.ts、手と持ち物の処理（makeRune・effHand・isTwo など）は src/lib/gear.ts
// 特性の説明 trDesc は src/lib/runes.ts（祭壇の画面の説明とルーンの説明の5行が使う）
// RUNE_TYPES は src/lib/runes.ts（src/game/imports.mjs で読む）
// RES は src/lib/runes.ts（src/game/imports.mjs で読む）
try{ saved.BOOK=new Set(JSON.parse(localStorage.getItem('al_book')||'[]')); }catch(e){}
// ルーンの種類を選ぶ randomRuneType は src/lib/gear.ts（src/game/imports.mjs で読む）
// 幅に合わせて HTML を切る clipHtml は src/lib/text.ts（src/game/imports.mjs で読む）
// resetRunes は src/lib/gear.ts（src/game/imports.mjs で読む）
// specOf は src/lib/gear.ts（src/game/imports.mjs で読む）

