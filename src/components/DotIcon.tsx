import { GRID, type CellTest } from "../lib/dot-icons";

const offset = (GRID.size - GRID.cells * GRID.step) / 2 + (GRID.step - GRID.dot) / 2;
const paths = new WeakMap<CellTest, string>();

function pathFor(test: CellTest) {
  let d = paths.get(test);
  if (d === undefined) {
    d = "";
    const w = GRID.dot.toFixed(3);
    for (let y = 0; y < GRID.cells; y++) {
      for (let x = 0; x < GRID.cells; x++) {
        if (!test(x, y)) continue;
        d += `M${(offset + x * GRID.step).toFixed(3)} ${(offset + y * GRID.step).toFixed(3)}h${w}v${w}h-${w}z`;
      }
    }
    paths.set(test, d);
  }
  return d;
}

export function DotIcon({ icon, color, label }: { icon: CellTest; color?: string; label?: string }) {
  return (
    <svg
      className="dot-icon"
      width={GRID.size}
      height={GRID.size}
      viewBox={`0 0 ${GRID.size} ${GRID.size}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path fill={color ?? "currentColor"} d={pathFor(icon)} />
    </svg>
  );
}
