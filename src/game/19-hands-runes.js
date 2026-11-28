// ---------------------------------------------------------------- the weapons in hand
// VM_ST・vmGlyphS・vmGlyph と形と色の表（VM_MODELS・VM_PART・VM_BRIGHT・VM_REST・VM_REST_HOT・VM_TINT・VM_FIST）は src/lib/hands.ts（読むのは src/lib/held.ts と src/lib/fx.ts。古い JS は読まない）
// RUNE_FONT・TRAIT_V・pct など 18 個は src/lib/runes.ts
// 手元の武器を描く drawViewWeapons は src/lib/held.ts
// 武器を振った線 drawSwing は src/lib/aim.ts

// ---------------------------------------------------------------- runes: attacks and elements held in each hand, chanting, reactions
// RUNE_DEF は src/lib/runes.ts
// ルーンの名前・色・付けられるか（runeName・canPut など）は src/lib/runes.ts、手と持ち物の処理（makeRune・effHand・isTwo など）は src/lib/gear.ts
// 特性の説明 trDesc は src/lib/runes.ts（祭壇の画面の説明とルーンの説明の5行が使う）
// RUNE_TYPES は src/lib/runes.ts
// RES は src/lib/runes.ts
try{ saved.BOOK=new Set(JSON.parse(localStorage.getItem('al_book')||'[]')); }catch(e){}
// ルーンの種類を選ぶ randomRuneType は src/lib/gear.ts
// 幅に合わせて HTML を切る clipHtml は src/lib/text.ts
// resetRunes は src/lib/gear.ts
// specOf は src/lib/gear.ts

