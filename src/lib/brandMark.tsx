/**
 * The DBShow mark: an isometric cube, lit from the upper left, drawn as a
 * hexagon split into three faces.
 *
 * Shared by `src/app/icon.tsx` (32px) and `src/app/apple-icon.tsx` (180px) so
 * the two never drift apart. Returned as a plain element rather than a React
 * component because `ImageResponse` renders through satori, which is fussy
 * about anything that isn't a concrete element — in particular it drops
 * fragments inside `<svg>`, so every group below is a real `<g>`.
 */

const INK = "#0a0e1a";
const MARIGOLD = "#d99a3f";
const MARIGOLD_LIGHT = "#e8b565";
const MARIGOLD_DEEP = "#9c6a28";

/** Everything is laid out in a 100×100 box and scaled by the viewBox. */
const BOX = 100;

const CX = BOX / 2;
const TOP_Y = 13; // tip of the cube
const HALF_W = 34; // half the hexagon's width
const RISE = 19.6; // vertical drop across half the top face (HALF_W × tan 30°)
const SIDE = 34; // height of the vertical edges

const MID_Y = TOP_Y + RISE * 2; // where the three faces meet
const SHOULDER_Y = TOP_Y + RISE; // the two widest points
const HIP_Y = SHOULDER_Y + SIDE; // bottom corners
const BOTTOM_Y = MID_Y + SIDE; // lowest point

const TIP = [CX, TOP_Y];
const SHOULDER_L = [CX - HALF_W, SHOULDER_Y];
const SHOULDER_R = [CX + HALF_W, SHOULDER_Y];
const MID = [CX, MID_Y];
const HIP_L = [CX - HALF_W, HIP_Y];
const HIP_R = [CX + HALF_W, HIP_Y];
const BOTTOM = [CX, BOTTOM_Y];

const line = ([x, y]: number[]) => `${x} ${y}`;
const poly = (...points: number[][]) =>
  `M ${points.map(line).join(" L ")} Z`;

const TOP_FACE = poly(TIP, SHOULDER_R, MID, SHOULDER_L);
const LEFT_FACE = poly(SHOULDER_L, MID, BOTTOM, HIP_L);
const RIGHT_FACE = poly(MID, SHOULDER_R, HIP_R, BOTTOM);

/** The three edges radiating from the point where the faces meet. */
const SEAMS =
  `M ${line(SHOULDER_L)} L ${line(MID)} L ${line(SHOULDER_R)}` +
  ` M ${line(MID)} L ${line(BOTTOM)}`;

/**
 * A table row ruled across a side face, parallel to that face's upper edge.
 * `drop` is how far below the edge it sits; `from`/`to` run 0–1 along it.
 */
function row(face: "left" | "right", drop: number, from: number, to: number) {
  const at = (t: number): number[] =>
    face === "left"
      ? [CX - HALF_W + HALF_W * t, SHOULDER_Y + RISE * t + drop]
      : [CX + HALF_W * t, MID_Y - RISE * t + drop];
  return `M ${line(at(from))} L ${line(at(to))}`;
}

const ROWS = [
  row("left", 10, 0.18, 0.84),
  row("left", 18.5, 0.18, 0.84),
  row("left", 27, 0.18, 0.58),
  row("right", 10, 0.16, 0.82),
  row("right", 18.5, 0.16, 0.82),
  row("right", 27, 0.42, 0.82),
].join(" ");

type BrandMarkOptions = {
  /** Rendered size in pixels. */
  size: number;
  /**
   * Draw the table rows and the node on the top face. They turn to mush below
   * roughly 64px, so the tab icon leaves them off.
   */
  detail?: boolean;
};

export function brandMark({ size, detail = false }: BrandMarkOptions) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${BOX} ${BOX}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        <path d={TOP_FACE} fill={MARIGOLD_LIGHT} />
        <path d={LEFT_FACE} fill={MARIGOLD} />
        <path d={RIGHT_FACE} fill={MARIGOLD_DEEP} />
      </g>
      {detail ? (
        <g>
          <path
            d={ROWS}
            stroke={INK}
            strokeWidth={2.4}
            strokeOpacity={0.42}
            strokeLinecap="round"
          />
          <circle cx={CX} cy={TOP_Y + RISE * 0.9} r={4.6} fill={INK} />
        </g>
      ) : (
        <g />
      )}
      <g>
        <path
          d={SEAMS}
          stroke={INK}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
