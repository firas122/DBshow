import { ImageResponse } from "next/og";

import { brandMark } from "@/lib/brandMark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const INK = "#0a0e1a";

export default function AppleIcon() {
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
        }}
      >
        {brandMark({ size: 148, detail: true })}
      </div>
    ),
    { ...size }
  );
}
