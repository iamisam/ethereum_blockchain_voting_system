import { Eip1193Provider } from "ethers";

// 1. Create a more specific interface that extends the base EIP-1193 provider
//    and includes the event methods we know MetaMask provides.
interface MetaMaskEip1193Provider extends Eip1193Provider {
  on(event: "accountsChanged", listener: (accounts: string[]) => void): this;
  on(event: "chainChanged", listener: (chainId: string) => void): this;
  removeListener(
    event: "accountsChanged",
    listener: (accounts: string[]) => void,
  ): this;
  removeListener(
    event: "chainChanged",
    listener: (chainId: string) => void,
  ): this;
}

// 2. Augment the global Window interface to use our new, more specific type.
declare global {
  interface Window {
    ethereum?: MetaMaskEip1193Provider;
  }
}
