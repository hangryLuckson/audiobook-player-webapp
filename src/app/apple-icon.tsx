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
            "linear-gradient(135deg, #1e1040 0%, #312e81 60%, #1e1040 100%)",
          borderRadius: 42,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            borderRadius: 42,
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.25) 0%, transparent 60%)",
          }}
        />
        {/* Headband top arc */}
        <div
          style={{
            position: "absolute",
            top: 42,
            left: 26,
            width: 140,
            height: 70,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              border: "10px solid white",
              boxSizing: "border-box",
            }}
          />
        </div>
        {/* Left earpiece */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: 34,
            width: 46,
            height: 72,
            borderRadius: 23,
            background: "white",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        />
        {/* Right earpiece */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            right: 34,
            width: 46,
            height: 72,
            borderRadius: 23,
            background: "white",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        />
        {/* Sound waves from right */}
        <div
          style={{
            position: "absolute",
            right: 20,
            top: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 22,
              height: 5,
              borderRadius: 3,
              background: "rgba(255,255,255,0.90)",
            }}
          />
          <div
            style={{
              width: 15,
              height: 5,
              borderRadius: 3,
              background: "rgba(255,255,255,0.65)",
            }}
          />
          <div
            style={{
              width: 8,
              height: 5,
              borderRadius: 3,
              background: "rgba(255,255,255,0.40)",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
