import type { Metadata } from "next";
import { DinhExperience } from "@/components/game/DinhExperience";

export const metadata: Metadata = {
  title: "Dinh Độc Lập — Sài Gòn 3D",
  description: "Tham quan Dinh Độc Lập trong môi trường 3D cùng hướng dẫn viên AI Minh Anh.",
};

export default function DinhPage() {
  return <DinhExperience />;
}
