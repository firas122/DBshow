import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const INK = "#0a0e1a";
const MARIGOLD = "#d99a3f";
const MARIGOLD_LIGHT = "#e8b565";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: INK,
          borderRadius: 6,
        }}
      >
        {/* table-card glyph: header bar + two row dividers, blueprint corner ticks */}
        <div
          style={{
            position: "relative",
            width: 20,
            height: 20,
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: `1.6px solid ${MARIGOLD}`,
              borderRadius: 2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                height: 5,
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
                padding: "0 2px",
              }}
            >
              <div style={{ height: 1.4, width: "100%", background: MARIGOLD, opacity: 0.55 }} />
              <div style={{ height: 1.4, width: "70%", background: MARIGOLD, opacity: 0.55 }} />
            </div>
          </div>
          {/* corner ticks */}
          <div
            style={{
              position: "absolute",
              top: -3,
              left: -3,
              width: 5,
              height: 5,
              borderTop: `1.4px solid ${MARIGOLD_LIGHT}`,
              borderLeft: `1.4px solid ${MARIGOLD_LIGHT}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -3,
              right: -3,
              width: 5,
              height: 5,
              borderBottom: `1.4px solid ${MARIGOLD_LIGHT}`,
              borderRight: `1.4px solid ${MARIGOLD_LIGHT}`,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
