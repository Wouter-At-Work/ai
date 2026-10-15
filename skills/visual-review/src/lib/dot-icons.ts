/**
 * Dot-grid icons, after new.wouter.codes: filled cells on one shared 11×11 grid
 * (1.1px step, 0.82px dots, 12px box), defined as cell predicates.
 */
export const GRID = { cells: 11, step: 1.1, dot: 0.82, size: 12 } as const

export type CellTest = (x: number, y: number) => boolean

function rows(r: string[]): CellTest {
  return (x, y) => r[y]?.[x] === "#";
}

const ring: CellTest = (x, y) => x <= 1 || x >= 9 || y <= 1 || y >= 9;

/** One pinwheel piece per kind of file change; colour carries the category. */
export const CHANGE_PIECE: Record<string, { test: CellTest; color: string }> = {
  change: {
    test: (x, y) => ring(x, y) && ((y >= 9 && x <= 4) || (x <= 1 && y >= 5)),
    color: "var(--accent-yellow)",
  },
  new: {
    test: (x, y) => ring(x, y) && ((x >= 9 && y >= 6) || (y >= 9 && x >= 5)),
    color: "var(--accent-green)",
  },
  deleted: {
    test: (x, y) => ring(x, y) && ((y <= 1 && x <= 5) || (x <= 1 && y <= 4)),
    color: "var(--accent-red)",
  },
  rename: {
    test: (x, y) => ring(x, y) && ((y <= 1 && x >= 6) || (x >= 9 && y <= 5)),
    color: "var(--accent-blue)",
  },
};

export const ICONS = {
  arrowLeft: ((x, y) =>
    (y === 5 && x >= 1 && x <= 9) ||
    (x + y === 6 && x >= 1 && x <= 4) ||
    (y - x === 4 && x >= 1 && x <= 4)) as CellTest,
  arrowUpRight: ((x, y) =>
    (x + y === 10 && x >= 1 && x <= 9) ||
    (y === 1 && x >= 4 && x <= 9) ||
    (x === 9 && y >= 1 && y <= 6)) as CellTest,
  comment: rows([
    "...........",
    "#########..",
    "#.......#..",
    "#.#####.#..",
    "#.......#..",
    "#.###...#..",
    "#.......#..",
    "####.####..",
    "...#.#.....",
    "...##......",
    "...#.......",
  ]),
  split: ((x, y) => (x === 0 || x === 4 || x === 6 || x === 10) || y === 0 || y === 10) as CellTest,
  unified: ((x, y) => x === 0 || x === 10 || y === 0 || y === 10 || (y === 5 && x >= 2 && x <= 8)) as CellTest,
  check: ((x, y) => (x - y === -4 && x >= 1 && x <= 4) || (x + y === 12 && x >= 4 && x <= 10)) as CellTest,
};
