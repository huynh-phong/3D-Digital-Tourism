import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-bg p-6 text-center text-fg">
      <p className="text-lg font-semibold">Không tìm thấy trang · Page not found</p>
      <Link href="/" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-on-accent">
        ← Bản đồ Sài Gòn 3D
      </Link>
    </main>
  );
}
