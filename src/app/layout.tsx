import type { Metadata, Viewport } from "next";
import { Pixelify_Sans, Press_Start_2P } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

const pixel = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin", "latin-ext"],
});

const arcade = Press_Start_2P({
  variable: "--font-arcade",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Blackjack Terraza",
  description: "Blackjack multijugador en 3D pixel art: mesas en tiempo real, crupier, fichas y perfiles.",
};

export const viewport: Viewport = {
  themeColor: "#0d0a16",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${pixel.variable} ${arcade.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
