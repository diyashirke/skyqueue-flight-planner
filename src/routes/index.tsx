import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkyQueue — Book Flights Across India" },
      { name: "description", content: "Search flights, book and manage your SkyQueue demo reservation." },
      { property: "og:title", content: "SkyQueue — Book Flights Across India" },
      { property: "og:description", content: "Search flights, book and manage your SkyQueue demo reservation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// The SkyQueue site is plain HTML/CSS/JS in public/skyqueue.
function Index() {
  useEffect(() => {
    window.location.replace("/skyqueue/index.html");
  }, []);
  return <p className="p-8 text-muted-foreground">Loading SkyQueue…</p>;
}
