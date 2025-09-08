"use client";

import { ShieldCheck, Lock, Users, ArrowRight, Layers } from "lucide-react";
import React from "react";
import Link from "next/link";
import { Web3Provider } from "@/context/Web3Context";

// Main Page Component
export default function Home() {
  return (
    // This new div wraps all sections and applies the grid background to the entire content area
    <div className="bg-grid-gray-700/[0.2]">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
    </div>
  );
}

// Hero Section Component
const HeroSection = () => (
  // The background class has been removed from here
  <section className="py-24 md:py-32 text-center">
    <div className="container mx-auto px-6">
      <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
        The Future of Campus Elections
      </h2>
      <p className="max-w-3xl mx-auto text-lg md:text-xl text-gray-300 mb-8">
        A secure, transparent, and decentralized voting system built for
        students, powered by blockchain technology. Your voice, immutably
        recorded.
      </p>
      <Link href="/register">
        <button className="inline-flex items-center justify-center px-8 py-4 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/50 text-lg transform hover:scale-105">
          Get Started & Register <ArrowRight className="ml-2 h-5 w-5" />
        </button>
      </Link>
    </div>
  </section>
);

// Feature Card Component
interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

const FeatureCard = ({ icon: Icon, title, description }: FeatureCardProps) => (
  <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 hover:border-blue-500 transition-colors">
    <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-gray-700 mb-4 border border-gray-600">
      <Icon className="h-6 w-6 text-blue-400" />
    </div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-gray-400">{description}</p>
  </div>
);

// Features Section Component
const FeaturesSection = () => (
  // Removed the explicit bg-gray-900 to inherit the new parent background
  <section className="py-20 md:py-28">
    <div className="container mx-auto px-6">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold">Why VeriVote?</h2>
        <p className="max-w-2xl mx-auto text-gray-400 mt-4">
          Leveraging cutting-edge technology to ensure every election is fair
          and trustworthy.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <FeatureCard
          icon={ShieldCheck}
          title="End-to-End Encryption"
          description="Your vote is encrypted on your device before submission. No one, not even administrators, can see it until the tally."
        />
        <FeatureCard
          icon={Layers}
          title="Immutable Ledger"
          description="Every encrypted vote is recorded on a public blockchain, creating a tamper-proof audit trail for ultimate transparency."
        />
        <FeatureCard
          icon={Users}
          title="One Person, One Vote"
          description="We use Soulbound NFT tokens tied to verified student identities to guarantee that every eligible voter can only vote once."
        />
        <FeatureCard
          icon={Lock}
          title="Decentralized & Secure"
          description="Built on a decentralized network, the system is resilient to single points of failure and censorship."
        />
      </div>
    </div>
  </section>
);

// How It Works Step Component
interface StepProps {
  number: string;
  title: string;
  description: string;
}

const Step = ({ number, title, description }: StepProps) => (
  <div className="flex">
    <div className="flex flex-col items-center mr-6">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-xl">
        {number}
      </div>
      {/* Render the line only if it's not the last step */}
      {number !== "3" && <div className="w-px h-full bg-gray-700" />}
    </div>
    <div className="pb-16">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  </div>
);

// How It Works Section Component
const HowItWorksSection = () => (
  <section id="how-it-works" className="py-20 md:py-28">
    <div className="container mx-auto px-6">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold">
          A Simple & Secure Process
        </h2>
        <p className="max-w-2xl mx-auto text-gray-400 mt-4">
          Voting in three easy steps.
        </p>
      </div>
      <div className="max-w-2xl mx-auto">
        <Step
          number="1"
          title="Register & Get Your Voter NFT"
          description="Verify your student email to receive a unique, non-transferable Soulbound NFT. This is your permanent key to vote in all future campus elections."
        />
        <Step
          number="2"
          title="Cast Your Encrypted Vote"
          description="Browse active elections, make your choice, and submit your vote. Your selection is encrypted client-side, ensuring complete privacy."
        />
        <Step
          number="3"
          title="View Transparent Results"
          description="Once an election ends, encrypted votes are tallied and the final results are published on-chain. Anyone can verify the integrity of the tally."
        />
      </div>
    </div>
  </section>
);
