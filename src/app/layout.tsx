import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Web3Provider } from "@/context/Web3Context";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VeriVote",
  description: "A Decentralized Application for Fair Elections.",
};

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
