// 画面を描き直す呼び口：まだ古い JS にある描き直し（装備の画面 renderInv）を、TypeScript の側から呼ぶため。
// 古い JS（27-rune-screen.js）が、読み込みの時に本物を入れる。入れる前に呼ぶと、その場で止まる。renderInv を移し終えたら消す。
export const redraw = {
  /** 装備の画面を描き直す */
  inv: (): void => {
    throw new Error('redraw.inv がまだ入っていない（27-rune-screen.js が入れる）');
  },
};
