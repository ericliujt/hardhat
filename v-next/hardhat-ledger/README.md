# @nomicfoundation/hardhat-ledger

Hardhat v3 plugin for integrating with Ledger hardware wallets using the modern Device Management Kit (DMK).

## Installation

```bash
npm install --save-dev @nomicfoundation/hardhat-ledger
```

## Quick Start

Add the plugin to your `hardhat.config.ts`:

```typescript
import hardhatLedgerPlugin from "@nomicfoundation/hardhat-ledger";

const config: HardhatUserConfig = {
  plugins: [hardhatLedgerPlugin],
  networks: {
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
      ledgerAccounts: [0, 1, 2], // Use first 3 Ledger accounts
    }
  }
};

export default config;
```

## Configuration

### Network Configuration

Add Ledger support to any network by including `ledgerAccounts` and optional `ledgerOptions`:

```typescript
export default {
  networks: {
    mainnet: {
      type: "http",
      url: "https://eth-mainnet.alchemyapi.io/v2/YOUR-API-KEY",
      ledgerAccounts: [0, 1, 2], // Account indices or paths
      ledgerOptions: {
        derivationFunction: (index) => `m/44'/60'/0'/0/${index}`,
        dmkOptions: {
          connectionTimeout: 30000,
          transportType: "usb"
        }
      }
    }
  }
};
```

### Configuration Options

#### `ledgerAccounts` (required)

Specifies which accounts to use from the Ledger device:

```typescript
// Using account indices (will use default derivation function)
ledgerAccounts: [0, 1, 2]

// Using custom derivation paths
ledgerAccounts: ["m/44'/60'/0'/0/0", "m/44'/60'/1'/0/0"]

// Mixed approach
ledgerAccounts: [0, "m/44'/60'/1'/0/0", 2]
```

#### `ledgerOptions` (optional)

Fine-tune Ledger integration:

- **`derivationFunction`**: Custom function to generate derivation paths
  - Type: `(index: number) => string`
  - Default: `(index) => m/44'/60'/0'/0/${index}`
  
- **`dmkOptions`**: Device Management Kit configuration
  - **`connectionTimeout`**: Connection timeout in milliseconds
    - Type: `number`
    - Default: `30000`
  - **`transportType`**: Connection method
    - Type: `"usb"` | `"ble"`
    - Default: `"usb"`
  - **`deviceFilter`**: Filter for specific devices
    - `modelId`: Filter by model (e.g., "flex", "nanoS", "nanoX")
    - `deviceId`: Target specific device ID

## Usage

### List Ledger Accounts

```bash
npx hardhat ledger:accounts --network localhost
```

Output:
```
Ledger accounts:
  [0]: 0xfd49eF6B572815318819De8a485BD9E9662892B1
       Path: m/44'/60'/0'/0/0
  [1]: 0x7A6aA4990DDa2c852a6848b70922807BB32F50d5
       Path: m/44'/60'/0'/0/1
  [2]: 0xe546996E51b182B1aCd9913f8cdd21A07ECB6840
       Path: m/44'/60'/0'/0/2

Connected: true
```

### Deploy Contracts with Ignition

```bash
npx hardhat ignition deploy ./ignition/modules/MyModule.ts --network localhost
```

The plugin automatically handles transaction signing through your Ledger device.

### Programmatic Usage

```typescript
// Connect to network with Ledger
const connection = await hre.network.connect();

// Access Ledger accounts
if (connection.ledger) {
  const accounts = connection.ledger.accounts;
  console.log("First account:", accounts[0].address);
  console.log("Derivation path:", accounts[0].derivationPath);
}
```

## Features

### Supported Operations

- ✅ **Transaction Signing**: Legacy, EIP-155, EIP-1559, and EIP-2930 transactions
- ✅ **Message Signing**: Personal sign and eth_sign
- ✅ **Typed Data Signing**: Full EIP-712 support
- ✅ **Contract Deployment**: Via Hardhat Ignition or scripts
- ✅ **Multiple Accounts**: Manage multiple accounts from single device
- ✅ **Custom Derivation Paths**: Full BIP44 path customization

### Device Management Kit (DMK) Benefits

- **Auto-discovery**: Automatic device detection and connection
- **Better Error Handling**: Clear, actionable error messages
- **Connection Management**: Robust connection state handling
- **Modern Architecture**: Built on reactive programming patterns
- **Transport Flexibility**: USB and Bluetooth support

## Troubleshooting

### Common Issues

#### Device Not Found
```
Error: cannot open device with path...
```

**Solutions:**
- Ensure Ledger is connected and unlocked
- Open the Ethereum app on your device
- Close other applications using the device
- Try unplugging and reconnecting the device

#### Insufficient Funds
```
ProviderError: Sender doesn't have enough funds to send tx
```

**Solution:** Fund your Ledger address. For local development:
```bash
# Using cast (Foundry)
cast rpc eth_sendTransaction '{"from":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","to":"YOUR_LEDGER_ADDRESS","value":"0xde0b6b3a7640000"}' --rpc-url http://localhost:8545
```

#### Invalid Number Error
```
Error: invalid number provided
```

**Solution:** Update to latest version - this issue has been fixed.

### Device Requirements

- Ledger device with latest firmware
- Ethereum app installed and updated
- "Blind signing" or "Contract data" enabled in Ethereum app settings
- USB cable (for USB connection) or Bluetooth enabled (for BLE)

## Technical Details

### Architecture

The plugin implements:
1. **Network Hook Handler**: Intercepts network connections to inject Ledger provider
2. **Ledger Provider**: EIP-1193 compatible provider that handles signing
3. **Ledger Signer**: DMK integration for device communication
4. **Task Registration**: Adds `ledger:accounts` task

### Derivation Paths

Default Ethereum derivation path: `m/44'/60'/0'/0/{index}`

- `44'`: BIP44 purpose
- `60'`: Ethereum coin type
- `0'`: Account (hardened)
- `0`: Change (external chain)
- `{index}`: Address index

## Development

### Building

```bash
npm install
npm run build
```

### Testing with Example Project

```bash
cd hardhat-example
npm install
npx hardhat node # In one terminal
npx hardhat ledger:accounts --network localhost # In another
```

## Requirements

- Node.js 18+
- Hardhat v3 (v-next)
- Ledger device with Ethereum app
- USB or Bluetooth connectivity

## License

MIT

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/NomicFoundation/hardhat).