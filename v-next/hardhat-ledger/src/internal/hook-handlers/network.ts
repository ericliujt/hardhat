import { LedgerSigner } from "../ledger-signer.js";
import { LedgerProvider } from "../ledger-provider.js";

const networkHookHandler = {
  newConnection: async (context: any, next: any) => {
    // Call the next handler in the chain to get the connection
    const connection = await next(context);
    
    // Check if this network uses Ledger accounts
    const networkConfig = connection.networkConfig;
    
    // Check for ledgerAccounts in the resolved config
    if (!networkConfig?.ledgerAccounts || networkConfig.ledgerAccounts.length === 0) {
      // Not a Ledger network, return unchanged
      return connection;
    }
    
    console.log("Initializing Ledger for network...");

    // Get Ledger options or use defaults
    const ledgerOptions = networkConfig.ledgerOptions || {};
    const ledgerSigner = new LedgerSigner(ledgerOptions.dmkOptions || {
      connectionTimeout: 30000,
      transportType: "usb",
    });
    
    const ledgerProvider = new LedgerProvider(
      connection.provider,
      ledgerSigner,
      {
        accounts: networkConfig.ledgerAccounts,
        derivationFunction: ledgerOptions.derivationFunction || 
          ((index: number) => `m/44'/60'/0'/0/${index}`),
      }
    );

    await ledgerProvider.initialize();
    
    // Get the Ledger accounts
    const ledgerAccounts = ledgerProvider.getAccounts();

    // Replace the provider and accounts in the connection
    const enhancedConnection = {
      ...connection,
      provider: ledgerProvider,
      accounts: ledgerAccounts.map(acc => acc.address), // Override accounts
      ledger: {
        accounts: ledgerAccounts,
        isConnected: ledgerSigner.isConnected(),
      },
    };

    return enhancedConnection;
  },

  closeConnection: async (context: any, networkConnection: any, next: any) => {
    // If this connection has ledger, disconnect it
    if (networkConnection.ledger) {
      const provider = networkConnection.provider as LedgerProvider;
      await provider.disconnect();
    }
    
    // Call the next handler
    return next(context, networkConnection);
  },
};

export default networkHookHandler;