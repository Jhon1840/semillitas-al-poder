import type { ReactNode } from "react";

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const scriptProps = {
    id: "google-maps-script",
    "data-google-maps": "true",
    src: `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`,
    async: true,
    defer: true,
    loading: "async",
  } as any;

  return (
    <>
      <script {...scriptProps} />
      {children}
    </>
  );
}
