interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    isTrust?: boolean;
    networkVersion?: string;
    chainId?: string;
    selectedAddress?: string;
    isConnected?: () => boolean;
    _state?: {
      accounts?: string[];
      isConnected?: boolean;
      isUnlocked?: boolean;
      initialized?: boolean;
      isPermanentlyDisconnected?: boolean;
    };
    request: (request: { method: string; params?: any[] }) => Promise<any>;
    on: (eventName: string, callback: (...args: any[]) => void) => void;
    removeListener: (eventName: string, callback: (...args: any[]) => void) => void;
  };
}
