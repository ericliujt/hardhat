# @nomicfoundation/hardhat-ledger

Hardhat plugin for integrating with Ledger hardware wallets using the modern Device Management Kit (DMK).

## Installation

```bash
npm install --save-dev @nomicfoundation/hardhat-ledger
```

## Quick Start

Import the plugin in your `hardhat.config.js`:

```javascript
import "@nomicfoundation/hardhat-ledger";
```

Or if using TypeScript, in your `hardhat.config.ts`:

```typescript
import "@nomicfoundation/hardhat-ledger";
```

## Configuration

This plugin extends the Hardhat network configuration to support Ledger hardware wallets:

```typescript
export default {
  networks: {
    mainnet: {
      url: "https://eth-mainnet.alchemyapi.io/v2/YOUR-API-KEY",
      ledgerAccounts: [0, 1, 2], // Use first 3 Ledger accounts
      ledgerOptions: {
        derivationFunction: (index) => `m/44'/60'/0'/0/${index}`,
        dmkOptions: {
          connectionTimeout: 30000,
          transportType: "usb", // "usb" or "ble"
          deviceFilter: {
            modelId: "nanoX", // Optional: filter by model
          }
        }
      }
    }
  }
};
```

### Configuration Options

#### `ledgerAccounts`

Array of account indices or derivation paths to use from the Ledger device.

```typescript
// Using indices (will use default derivation function)
ledgerAccounts: [0, 1, 2]

// Using custom derivation paths
ledgerAccounts: ["m/44'/60'/0'/0/0", "m/44'/60'/1'/0/0"]

// Mixed
ledgerAccounts: [0, "m/44'/60'/1'/0/0", 2]
```

#### `ledgerOptions`

Optional configuration for Ledger integration:

- `derivationFunction`: Function to generate derivation paths from indices
  - Default: `(index) => m/44'/60'/0'/0/${index}`
  
- `dmkOptions`: Device Management Kit specific options
  - `connectionTimeout`: Timeout in milliseconds for device connection (default: 30000)
  - `transportType`: Connection type - `"usb"` (default) or `"ble"`
  - `deviceFilter`: Optional filter to select specific devices
    - `modelId`: Ledger model ID (e.g., "nanoX", "nanoS", "nanoSP")
    - `deviceId`: Specific device ID

## Usage

Once configured, Ledger accounts can be used transparently with Hardhat:

```typescript
import { ethers } from "hardhat";

async function main() {
  // Get configured Ledger accounts
  const accounts = await ethers.getSigners();
  
  // Use first Ledger account
  const ledgerSigner = accounts[0];
  
  // Deploy contract
  const Contract = await ethers.getContractFactory("MyContract", ledgerSigner);
  const contract = await Contract.deploy();
  
  // Send transaction
  const tx = await ledgerSigner.sendTransaction({
    to: "0x...",
    value: ethers.parseEther("1.0")
  });
  
  // Sign message
  const message = "Hello from Ledger!";
  const signature = await ledgerSigner.signMessage(message);
}

main().catch(console.error);
```

## Features

### Device Management Kit Integration

This plugin uses Ledger's modern Device Management Kit (DMK) which provides:

- **Improved Connection Handling**: Automatic device discovery and connection management
- **Better Error Messages**: Clear, actionable error messages
- **State Management**: Track device connection state
- **Multiple Transport Support**: USB and Bluetooth connectivity
- **Timeout Management**: Built-in timeout and cancellation support

### Supported Operations

- Transaction signing (legacy, EIP-155, EIP-1559)
- Message signing (personal_sign, eth_sign)
- Typed data signing (EIP-712)
- Multiple account management
- Custom derivation paths

## Migration from Legacy Plugin

If migrating from the old `@nomiclabs/hardhat-ledger` plugin:

### Key Differences

1. **Package Name**: Changed to `@nomicfoundation/hardhat-ledger`
2. **Dependencies**: Uses DMK instead of individual transport libraries
3. **Configuration**: New `dmkOptions` for device management
4. **Connection**: Explicit connection management with better error handling

### Migration Steps

1. Uninstall old plugin:
   ```bash
   npm uninstall @nomiclabs/hardhat-ledger
   ```

2. Install new plugin:
   ```bash
   npm install --save-dev @nomicfoundation/hardhat-ledger
   ```

3. Update configuration:
   ```typescript
   // Old
   ledgerAccounts: ["0x..."]
   
   // New
   ledgerAccounts: [0, 1, 2],
   ledgerOptions: {
     dmkOptions: {
       transportType: "usb"
     }
   }
   ```

## Troubleshooting

### Device Not Found

- Ensure Ledger device is connected and unlocked
- Open the Ethereum app on your Ledger device
- Check USB/Bluetooth permissions
- Try increasing `connectionTimeout` in configuration

### Transaction Rejected

- Verify transaction details on device screen
- Ensure sufficient balance for gas fees
- Check network configuration matches device settings

### App Not Open

- Open the Ethereum app on your Ledger device
- Ensure "Contract data" is enabled in app settings
- Update Ethereum app to latest version

## Requirements

- Node.js 18+ 
- Hardhat v3 (v-next)
- Ledger device with Ethereum app installed
- USB or Bluetooth connectivity

## License

MIT