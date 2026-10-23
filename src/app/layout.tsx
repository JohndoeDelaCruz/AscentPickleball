import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { getSession } from "@/lib/data";
import "./globals.css";

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "Ascent Pickleball — Higher together.",
    template: "%s | Ascent Pickleball",
  },
  description:
    "Your next great game starts here. Explore Ascent Pickleball’s two courts, find your time, and get your crew together.",
  icons: { icon: "/icon.svg" },
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, staff } = await getSession();
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${body.variable} ${display.variable}`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Header signedIn={Boolean(user)} staff={staff} />
        {children}
        <Footer />
      </body>
    </html>
  );
}
