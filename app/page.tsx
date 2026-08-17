import type { Metadata } from "next";
import MorningDownload from "./MorningDownload";

export const metadata: Metadata = {
  title: "Morning Download — Daily briefings",
  description: "A clear daily read on world events, markets, AI, and agentic systems.",
};

export default function Home() {
  return <MorningDownload />;
}
