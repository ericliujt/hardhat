import type { LedgerConnection, LedgerOptions } from "./types.js";

declare module "hardhat/types/config" {
  export interface HttpNetworkUserConfig {
    ledgerAccounts?: (string | number)[];
    ledgerOptions?: LedgerOptions;
  }

  export interface HttpNetworkConfig {
    ledgerAccounts?: (string | number)[];
    ledgerOptions?: LedgerOptions;
  }

  export interface EdrNetworkUserConfig {
    ledgerAccounts?: (string | number)[];
    ledgerOptions?: LedgerOptions;
  }

  export interface EdrNetworkConfig {
    ledgerAccounts?: (string | number)[];
    ledgerOptions?: LedgerOptions;
  }
}

declare global {
  namespace HardhatTypes {
    interface NetworkConnection {
      ledger?: LedgerConnection;
    }
  }
}