import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { Providers } from "@/components/ui/Providers";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sài Gòn 3D — Hành trình khám phá di sản",
  description:
    "Khám phá Sài Gòn trên bản đồ 3D và tham quan Dinh Độc Lập cùng hướng dẫn viên AI Minh Anh. Saigon 3D — Immersive Heritage Explorer.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1311" },
  ],
};

/** Runs before paint: apply saved theme/lang so there's no flash. */
const bootScript = `(function(){try{var s=JSON.parse(localStorage.getItem('sg3d-settings')||'{}').state||{};var t=s.theme||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';if(s.lang)document.documentElement.lang=s.lang;var rm=s.reducedMotion;if(rm===null||rm===undefined)rm=matchMedia('(prefers-reduced-motion: reduce)').matches;document.documentElement.dataset.reducedMotion=String(!!rm);}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="h-full overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
