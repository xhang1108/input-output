import "./globals.css";
import { AppProviders } from "@/components/AppProviders";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
    title: {
        default: "Input-Output | Node-based Calculator",
        template: "%s | Input-Output",
    },
    description: "Input-Output is a free, node-based calculator that visualizes the calculation process. Build, connect, and explore mathematical logic with an intuitive graphical interface.",
    keywords: ["Node-based Calculator", "Visual Calculation", "Mathematical Logic", "Free Tools", "Input-Output", "Graph-based Math"],
    authors: [{ name: "Input-Output Team" }],
    creator: "Input-Output",
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
    openGraph: {
        type: "website",
        locale: "zh_TW",
        url: "https://io.singularity.com", // Placeholder, will be relevant if deployed
        siteName: "Input-Output",
        title: "Input-Output | Node-based Calculator",
        description: "A free, node-based calculator that visualizes the calculation process. Explore math like never before.",
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: "I/O System Blueprint Interface",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Input-Output | Node-based Calculator",
        description: "A free, node-based calculator that visualizes the calculation process. Build and connect your logic.",
        images: ["/og-image.png"],
    },
    icons: {
        icon: "/favicon.ico",
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
            </body>
        </html>
    );
}
