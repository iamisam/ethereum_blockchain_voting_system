import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Vote } from "lucide-react";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import { Web3Provider } from "@/context/Web3Context";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VeriVote",
  description: "A Decentralized Application for Fair Elections.",
};

// Header Component (now shared across all pages)
const Header = () => (
  <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md">
    <div className="container mx-auto px-6 py-4 flex justify-between items-center border-b border-gray-700">
      <Link href="/" className="flex items-center">
        <h1 className="text-2xl font-bold tracking-tighter">
          <Vote className="inline-block mr-2 text-blue-400" />
          VeriVote
        </h1>
      </Link>
      <ConnectWalletButton />
    </div>
  </header>
);

// Footer Component (now shared across all pages)
const Footer = () => (
  <footer className="border-t border-gray-700">
    <div className="container mx-auto px-6 py-8 text-center text-gray-500">
      <p>
        &copy; {new Date().getFullYear()} VeriVote. A Decentralized Application
        for Fair Elections.
      </p>
    </div>
  </footer>
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-900 text-white`}>
        <Web3Provider>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer />
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
