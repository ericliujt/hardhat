import type { LedgerConnection, LedgerOptions } from "./types.js";

declare global {
  namespace HardhatTypes {
    interface NetworkConnection {
      ledger?: LedgerConnection;
    }

    interface NetworkConfig {
      ledgerAccounts?: string[] | number[];
      ledgerOptions?: LedgerOptions;
    }

    interface NetworkUserConfig {
      ledgerAccounts?: string[] | number[];
      ledgerOptions?: LedgerOptions;
    }
  }
}