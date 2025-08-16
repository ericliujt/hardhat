import { LedgerSigner } from "../ledger-signer.js";
import { LedgerProvider } from "../ledger-provider.js";
import type { LedgerOptions } from "../../types.js";

const networkHookHandler = {
  newConnection: async ({ connection, networkConfig }: any, _context: any) => {
    if (!networkConfig.ledgerAccounts || networkConfig.ledgerAccounts.length === 0) {
      return { connection };
    }

    const ledgerOptions = networkConfig.ledgerOptions as LedgerOptions | undefined;

    const ledgerSigner = new LedgerSigner(ledgerOptions?.dmkOptions);
    
    const ledgerProvider = new LedgerProvider(
      connection.provider,
      ledgerSigner,
      {
        accounts: networkConfig.ledgerAccounts,
        derivationFunction: ledgerOptions?.derivationFunction || 
          ((index: number) => `m/44'/60'/0'/0/${index}`),
      }
    );

    await ledgerProvider.initialize();

    const enhancedConnection = {
      ...connection,
      provider: ledgerProvider,
      ledger: {
        accounts: ledgerProvider.getAccounts(),
        isConnected: ledgerSigner.isConnected(),
      },
    };

    return { connection: enhancedConnection };
  },

  connectionClosed: async ({ connection }: any, _context: any) => {
    if (connection.ledger) {
      const provider = connection.provider as LedgerProvider;
      await provider.disconnect();
    }
    return {};
  },
};

export default networkHookHandler;