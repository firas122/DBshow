import { ImageResponse } from "next/og";

import { brandMark } from "@/lib/brandMark";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const INK = "#0a0e1a";

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
        {brandMark({ size: 28 })}
      </div>
    ),
    { ...size }
  );
}
