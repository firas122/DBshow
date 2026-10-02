import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const INK = "#0a0e1a";
const MARIGOLD = "#d99a3f";
const MARIGOLD_LIGHT = "#e8b565";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: INK,
        }}
      >
        {/* blueprint frame corner ticks, anchored to the canvas */}
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 22,
            width: 28,
            height: 28,
            borderTop: `7px solid ${MARIGOLD_LIGHT}`,
            borderLeft: `7px solid ${MARIGOLD_LIGHT}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 22,
            right: 22,
            width: 28,
            height: 28,
            borderBottom: `7px solid ${MARIGOLD_LIGHT}`,
            borderRight: `7px solid ${MARIGOLD_LIGHT}`,
          }}
        />

        {/* table-card glyph */}
        <div
          style={{
            width: 90,
            height: 108,
            border: `8px solid ${MARIGOLD}`,
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              height: 30,
              width: "100%",
              background: MARIGOLD,
            }}
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "14px 12px",
            }}
          >
            <div style={{ height: 8, width: "100%", background: MARIGOLD, opacity: 0.55 }} />
            <div style={{ height: 8, width: "65%", background: MARIGOLD, opacity: 0.55 }} />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
