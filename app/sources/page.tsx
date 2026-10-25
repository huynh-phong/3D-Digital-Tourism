import type { Metadata } from "next";
import { SourcesView } from "@/components/ui/SourcesView";

export const metadata: Metadata = {
  title: "Nguồn tư liệu — Sài Gòn 3D",
  description: "Nguồn tư liệu, dữ kiện đã kiểm chứng, số đo và giấy phép dữ liệu của Sài Gòn 3D.",
};

export default function SourcesPage() {
  return <SourcesView />;
}
