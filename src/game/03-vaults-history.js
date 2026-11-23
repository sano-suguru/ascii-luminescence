// makeCave・VAULTS・vaultCells は src/lib/vaults.ts（src/game/imports.mjs で読む）

// VAULT_WALL_H・ROCKS・VEIN_COL・VEIN_NAME は src/lib/world.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- history and engravings (after Caves of Qud's histories and Dwarf Fortress's engravings)
// ASCII-art motifs carved into walls; each row is exactly 7 characters
const ARTS={
 tower:["   ^   ","  /#\\  ","  |#|  "," /|#|\\ ","/_|#|_\\"],
 star: ["   .   "," \\ | / ","-- * --"," / | \\ ","   '   "],
 hammer:[" _____ ","|_____|","   |   ","   |   ","  _|_  "],
 bridge:["_______","| \\_/ |","|  |  |","~~~~~~~"],
 fountain:["  ( )  "," ( | ) ","  \\|/  "," _/ \\_ ","~~~~~~~"],
 swords:["\\     /"," \\   / ","  \\ /  ","  / \\  "," /   \\ "],
 serpent:["  __   "," (oo)  ","  \\ \\  ","  / /  "," ( (__ ","  \\__) "],
 skull:[" _____ ","/ o o \\","|  ^  |"," \\___/ ","  |||  "],
 eye:  ["  ___  "," /   \\ ","| (o) |"," \\___/ "],
 crown:["^  ^  ^","|\\/ \\/|","|_____|"],
 wave: ["  .-.  "," /   \\ ","~~~~~~~","~ ~ ~ ~","~~~~~~~"],
 tree: ["  ___  "," (   ) ","(_____)","   |   ","  /|\\  "],
 moon: ["  __   "," /  )  ","(  (   "," \\__)  ","     . "],
 lantern:["   |   ","  _|_  "," |   | "," | * | "," |___| "],
};
let HIST=null, HIST_SEED=-1;
// makeHistory（歴史を作る）は src/lib/history.ts（src/game/imports.mjs で読む）

// how much of the 70x46 frame a level uses
