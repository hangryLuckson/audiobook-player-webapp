import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

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
          background:
            "linear-gradient(135deg, #1e1040 0%, #312e81 60%, #1e1040 100%)",
          borderRadius: 7,
        }}
      >
        {/* Headband top arc */}
        <div
          style={{
            position: "absolute",
            top: 5,
            left: 5,
            width: 22,
            height: 11,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              border: "2.5px solid white",
              boxSizing: "border-box",
            }}
          />
        </div>
        {/* Left earpiece */}
        <div
          style={{
            position: "absolute",
            bottom: 5,
            left: 5,
            width: 7,
            height: 12,
            borderRadius: 4,
            background: "white",
          }}
        />
        {/* Right earpiece */}
        <div
          style={{
            position: "absolute",
            bottom: 5,
            right: 5,
            width: 7,
            height: 12,
            borderRadius: 4,
            background: "white",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
