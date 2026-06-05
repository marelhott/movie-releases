import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

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
          background: "#f5f1e8",
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 16,
            background: "#1d2a24",
            display: "flex",
            position: "relative",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "inset 0 0 0 2px rgba(255,253,248,0.12)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 14,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              background: "#0f9f76",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 10,
              display: "flex",
              gap: 6,
            }}
          >
            <div style={{ width: 4, height: 4, borderRadius: 999, background: "#f5f1e8" }} />
            <div style={{ width: 4, height: 4, borderRadius: 999, background: "#f5f1e8" }} />
            <div style={{ width: 4, height: 4, borderRadius: 999, background: "#f5f1e8" }} />
          </div>
          <div
            style={{
              marginTop: 10,
              color: "#fffdf8",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.05em",
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
