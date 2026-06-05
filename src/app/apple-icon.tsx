import { ImageResponse } from "next/og";

export const alt = "Audiobook Player";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

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
          background:
            "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
          color: "white",
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: -4,
        }}
      >
        A
      </div>
    ),
    { ...size },
  );
}
