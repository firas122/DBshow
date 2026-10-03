/**
 * The DBShow mark: a cluster of spheres — one near, the rest receding — joined
 * by relation edges. The same thing the app draws, in miniature.
 *
 * Shared by `src/app/icon.tsx` (32px) and `src/app/apple-icon.tsx` (180px) so
 * the two never drift apart. Returned as a plain element rather than a React
 * component because `ImageResponse` renders through satori, which is fussy
 * about anything that isn't a concrete element — in particular it drops
 * fragments inside `<svg>`, so every group below is a real `<g>`.
 *
 * Shading is flat-shaded, not gradient-lit: each sphere is three stacked
 * circles (shadow body, lit face offset toward the light, specular dot).
 * Satori's gradient support is partial, and three opaque tones survive being
 * shrunk to 16px better than a gradient does anyway.
 */

const INK = "#0a0e1a";
const MARIGOLD = "#d99a3f";
const MARIGOLD_LIGHT = "#e8b565";
const MARIGOLD_DEEP = "#9c6a28";

/** Everything is laid out in a 100×100 box and scaled by the viewBox. */
const BOX = 100;

/** Light comes from the upper left, as it did on the previous mark. */
const LIGHT = -Math.SQRT1_2; // cos/sin of 225°, i.e. up and to the left

/** How far the lit face and the specular dot shift toward the light, in radii. */
const LIT_SHIFT = 0.15;
const LIT_RADIUS = 0.82;
const SPEC_SHIFT = 0.34;
const SPEC_RADIUS = 0.28;

type Sphere = { cx: number; cy: number; r: number };

/**
 * The near sphere, and the two that recede behind it. Sizes stand in for
 * distance, which is what gives a flat square some depth.
 */
const NEAR: Sphere = { cx: 36, cy: 64, r: 26 };
const FAR: Sphere = { cx: 75, cy: 27, r: 15 };
/** Third node, only drawn at detail sizes — at 16px it degrades to a smudge. */
const FARTHER: Sphere = { cx: 84, cy: 69, r: 8.5 };

/**
 * Relation edges run centre to centre and are drawn under the spheres, so only
 * the span between two surfaces shows. They are marigold rather than ink: the
 * icon sits on an ink ground, where an ink edge is an invisible edge.
 */
const edge = (a: Sphere, b: Sphere) => `M ${a.cx} ${a.cy} L ${b.cx} ${b.cy}`;

function sphere({ cx, cy, r }: Sphere) {
  const lit = LIGHT * LIT_SHIFT * r;
  const spec = LIGHT * SPEC_SHIFT * r;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={MARIGOLD_DEEP} />
      <circle
        cx={cx + lit}
        cy={cy + lit}
        r={r * LIT_RADIUS}
        fill={MARIGOLD}
      />
      <circle
        cx={cx + spec}
        cy={cy + spec}
        r={r * SPEC_RADIUS}
        fill={MARIGOLD_LIGHT}
      />
    </g>
  );
}

/**
 * A great circle on the near sphere, seen edge-on: the near half of an ellipse
 * inscribed in the sphere's silhouette and tilted with it. `TILT` is the
 * sphere's axial tilt in degrees; `squash` is how narrow the circle appears
 * (0 = edge-on, 1 = face-on).
 */
const TILT = -18;

function greatCircle(axis: "equator" | "meridian", squash: number) {
  const { cx, cy, r } = NEAR;
  // The equator exits the silhouette along the tilt; the meridian exits 90° off.
  const base = axis === "equator" ? 0 : 90;
  const at = (deg: number) => {
    const a = ((deg + TILT) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const [x1, y1] = at(base + 180);
  const [x2, y2] = at(base);
  const [rx, ry] =
    axis === "equator" ? [r, r * squash] : [r * squash, r];
  return `M ${x1} ${y1} A ${rx} ${ry} ${TILT} 0 0 ${x2} ${y2}`;
}

const GREAT_CIRCLES = [
  greatCircle("equator", 0.34),
  greatCircle("meridian", 0.34),
].join(" ");

type BrandMarkOptions = {
  /** Rendered size in pixels. */
  size: number;
  /**
   * Draw the third, smallest node and the great circles ruled across the near
   * sphere. Both turn to mush below roughly 64px, so the tab icon leaves them
   * off and keeps to two spheres and one edge.
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
        <path
          d={
            detail
              ? `${edge(NEAR, FAR)} ${edge(NEAR, FARTHER)}`
              : edge(NEAR, FAR)
          }
          stroke={MARIGOLD_DEEP}
          strokeWidth={5}
          strokeLinecap="round"
        />
      </g>
      {sphere(FAR)}
      {detail ? sphere(FARTHER) : <g />}
      {sphere(NEAR)}
      {detail ? (
        <g>
          <path
            d={GREAT_CIRCLES}
            stroke={INK}
            strokeWidth={2.4}
            strokeOpacity={0.34}
            strokeLinecap="round"
          />
        </g>
      ) : (
        <g />
      )}
    </svg>
  );
}
