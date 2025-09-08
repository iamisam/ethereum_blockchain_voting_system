"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  ReactNode,
} from "react";
import { ethers, BrowserProvider, Signer } from "ethers";

// Define the shape of our context data
interface Web3ContextType {
  account: string | null;
  provider: BrowserProvider | null;
  signer: Signer | null;
  isConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void; // Add this
}

// Create the context with a default undefined value
const Web3Context = createContext<Web3ContextType | undefined>(undefined);

// Create the Provider component
export const Web3Provider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false);

  // 2. The disconnect function now sets this flag.
  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setManuallyDisconnected(true);
    console.log("Wallet has been manually disconnected from the app.");
  };

  const connectWallet = useCallback(async () => {
    if (typeof window.ethereum === "undefined") {
      console.error("MetaMask is not installed.");
      alert("Please install MetaMask to use this application.");
      return;
    }

    try {
      setManuallyDisconnected(false);
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const signerInstance = await browserProvider.getSigner();
      const accounts = await browserProvider.send("eth_requestAccounts", []);

      setProvider(browserProvider);
      setSigner(signerInstance);
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  }, []);

  // 4. Add a new effect to handle "eager connection" on page load.
  useEffect(() => {
    const connectEagerly = async () => {
      if (window.ethereum && !manuallyDisconnected) {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        if (accounts.length > 0) {
          console.log(
            "Eagerly connecting to previously connected account:",
            accounts[0],
          );
          // Use the main connect function to set everything up
          connectWallet();
        }
      }
    };
    connectEagerly();
  }, [manuallyDisconnected, connectWallet]);

  useEffect(() => {
    const { ethereum } = window;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      console.log("Account changed:", accounts[0]);
      setAccount(accounts.length > 0 ? accounts[0] : null);
      // Optionally, reconnect to get the new signer
      connectWallet();
    };

    const handleChainChanged = () => {
      // A page reload is the simplest way to handle network changes.
      console.log("Network changed, reloading...");
      window.location.reload();
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    // Cleanup listeners on component unmount
    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [connectWallet]);

  const value = {
    account,
    provider,
    signer,
    isConnected: !!account,
    connectWallet,
    disconnectWallet,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

// Create a custom hook for easy access to the context
export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
};
