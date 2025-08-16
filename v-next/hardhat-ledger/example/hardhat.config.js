import "@nomicfoundation/hardhat-ledger";

export default {
  solidity: "0.8.19",
  networks: {
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "https://eth-mainnet.alchemyapi.io/v2/YOUR-API-KEY",
      ledgerAccounts: [0, 1, 2],
      ledgerOptions: {
        derivationFunction: (index) => `m/44'/60'/0'/0/${index}`,
        dmkOptions: {
          connectionTimeout: 30000,
          transportType: "usb",
        }
      }
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.alchemyapi.io/v2/YOUR-API-KEY",
      ledgerAccounts: [0],
      ledgerOptions: {
        dmkOptions: {
          transportType: "usb",
          deviceFilter: {
            modelId: "nanoX",
          }
        }
      }
    }
  }
};