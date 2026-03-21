import "./globals.css";
import { AppProviders } from "@/components/AppProviders";
import type { Metadata, Viewport } from "next";
import Script from "next/script";

export const metadata: Metadata = {
    title: {
        default: "Input-Output | Node-based Calculator",
        template: "%s | Input-Output",
    },
    description: "A free, node-based calculator that visualizes the calculation process. Build and connect your logic.",
    keywords: ["Node-based Calculator", "Visual Calculation", "Mathematical Logic", "Free Tools", "Input-Output", "Graph-based Math"],
    authors: [{ name: "Input-Output Team" }],
    creator: "Input-Output",
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.input-output.cc'),
    openGraph: {
        type: "website",
        locale: "zh_TW",
        url: "https://www.input-output.cc",
        siteName: "Input-Output",
        title: "Input-Output | Node-based Calculator",
        description: "A free, node-based calculator that visualizes the calculation process. Build and connect your logic.",
    },
    twitter: {
        card: "summary_large_image",
        title: "Input-Output | Node-based Calculator",
        description: "A free, node-based calculator that visualizes the calculation process. Build and connect your logic.",
    },
    icons: {
        icon: "/favicon.ico",
        shortcut: "/logo.webp",
        apple: "/apple-icon.png",
    },
};

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    ],
    width: "device-width",
    initialScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className="antialiased"
                suppressHydrationWarning
            >
                <AppProviders>{children}</AppProviders>
                {/* Externalized heavy libraries to bypass Cloudflare build timeouts */}
                <Script src="https://unpkg.com/mathjs@14.2.1/lib/browser/math.js" strategy="beforeInteractive" />
                <Script src="https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/nerdamer.core.js" strategy="afterInteractive" />
            </body>
        </html>
    );
}
