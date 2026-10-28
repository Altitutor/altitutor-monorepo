import { ImageResponse } from "next/og";
export const alt = "Altitutor Blog: guides, resources and updates";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function BlogImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "#f5f3ed",
          color: "#1a1a1a",
          padding: 90,
        }}
      >
        <div style={{ fontSize: 28 }}>ALTITUTOR</div>
        <div style={{ fontSize: 100, marginTop: 35 }}>Our blog.</div>
        <div style={{ fontSize: 32, marginTop: 25 }}>
          Study guides, resources and updates.
        </div>
      </div>
    ),
    size,
  );
}
