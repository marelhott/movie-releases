import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

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
          background: "#f5f1e8",
        }}
      >
        <div
          style={{
            width: 152,
            height: 152,
            borderRadius: 40,
            background: "#1d2a24",
            display: "flex",
            position: "relative",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "inset 0 0 0 4px rgba(255,253,248,0.12)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 40,
              borderTopLeftRadius: 40,
              borderTopRightRadius: 40,
              background: "#0f9f76",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 13,
              left: 28,
              display: "flex",
              gap: 12,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 999, background: "#f5f1e8" }} />
            <div style={{ width: 8, height: 8, borderRadius: 999, background: "#f5f1e8" }} />
            <div style={{ width: 8, height: 8, borderRadius: 999, background: "#f5f1e8" }} />
          </div>
          <div
            style={{
              marginTop: 18,
              color: "#fffdf8",
              fontSize: 70,
              fontWeight: 700,
              letterSpacing: "-0.08em",
              fontFamily: "sans-serif",
            }}
          >
            MR
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
