import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#fff" }}>
      <svg fill="none" height="140" viewBox="0 0 32 32" width="140" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 1.75 28.25 6v9.25c0 7.4-5.1 12.9-12.25 15-7.15-2.1-12.25-7.6-12.25-15V6L16 1.75Z" fill="#1f4f8f" />
        <path d="M16 9.25 23.5 15.6h-2.1v7.15h-3.6v-4.1h-3.6v4.1h-3.6V15.6H8.5L16 9.25Z" fill="#fff" />
      </svg>
    </div>,
    size,
  );
}
