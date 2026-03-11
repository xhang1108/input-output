import "./globals.css";
import { AppProviders } from "@/components/AppProviders";

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
