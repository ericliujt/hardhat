import { ethers } from "ethers";
import { LedgerSigner } from "./ledger-signer.js";
import type { 
  LedgerAccount,
} from "../types.js";
import { DeviceNotConnectedError } from "../types.js";

interface LedgerProviderOptions {
  accounts: (string | number)[];
  derivationFunction: (index: number) => string;
}

interface EthereumProvider {
  request(args: { method: string; params?: any[] }): Promise<any>;
  send?(method: string, params?: any[]): Promise<any>;
  close?(): Promise<void>;
}

export class LedgerProvider implements EthereumProvider {
  private ledgerSigner: LedgerSigner;
  private accounts: LedgerAccount[] = [];
  private readonly options: LedgerProviderOptions;
  private baseProvider: EthereumProvider;

  constructor(
    baseProvider: EthereumProvider,
    ledgerSigner: LedgerSigner,
    options: LedgerProviderOptions
  ) {
    this.baseProvider = baseProvider;
    this.ledgerSigner = ledgerSigner;
    this.options = options;
  }

  async initialize(): Promise<void> {
    await this.ledgerSigner.connect();
    await this.loadAccounts();
  }

  private async loadAccounts(): Promise<void> {
    const accountIndices = this.parseAccountConfig(this.options.accounts);
    
    for (const index of accountIndices) {
      const derivationPath = this.options.derivationFunction(index);
      const { address, publicKey } = await this.ledgerSigner.getAddress(derivationPath);
      
      this.accounts.push({
        address,
        derivationPath,
        publicKey,
      });
    }
  }

  private parseAccountConfig(accounts: (string | number)[]): number[] {
    const indices: number[] = [];
    
    for (const account of accounts) {
      if (typeof account === "number") {
        indices.push(account);
      } else if (typeof account === "string") {
        const parsed = parseInt(account, 10);
        if (!isNaN(parsed)) {
          indices.push(parsed);
        } else {
          const derivationMatch = account.match(/m\/44'\/60'\/\d+'\/\d+\/(\d+)/);
          if (derivationMatch) {
            indices.push(parseInt(derivationMatch[1], 10));
          }
        }
      }
    }
    
    return indices.length > 0 ? indices : [0];
  }

  getAccounts(): LedgerAccount[] {
    return [...this.accounts];
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    if (!this.ledgerSigner.isConnected()) {
      throw new DeviceNotConnectedError();
    }

    const { method, params = [] } = args;

    switch (method) {
      case "eth_accounts":
        return this.accounts.map(acc => acc.address);

      case "eth_requestAccounts":
        return this.accounts.map(acc => acc.address);

      case "eth_sendTransaction":
        return this.handleSendTransaction(params[0]);

      case "eth_signTransaction":
        return this.handleSignTransaction(params[0]);

      case "personal_sign":
      case "eth_sign":
        return this.handleSignMessage(params);

      case "eth_signTypedData":
      case "eth_signTypedData_v3":
      case "eth_signTypedData_v4":
        return this.handleSignTypedData(params);

      default:
        return this.baseProvider.request({ method, params });
    }
  }

  // Legacy support for send method
  async send(method: string, params?: any[]): Promise<any> {
    return this.request({ method, params });
  }

  async close(): Promise<void> {
    await this.disconnect();
    if (this.baseProvider.close) {
      await this.baseProvider.close();
    }
  }

  private async handleSendTransaction(txRequest: any): Promise<string> {
    const signedTx = await this.handleSignTransaction(txRequest);
    return this.baseProvider.request({ 
      method: "eth_sendRawTransaction", 
      params: [signedTx] 
    });
  }

  private async handleSignTransaction(txRequest: any): Promise<string> {
    const from = ethers.getAddress(txRequest.from);
    const account = this.accounts.find(
      acc => acc.address.toLowerCase() === from.toLowerCase()
    );

    if (!account) {
      throw new Error(`Account ${from} not found in Ledger accounts`);
    }

    const chainIdHex = await this.baseProvider.request({ 
      method: "eth_chainId", 
      params: [] 
    });
    const chainId = parseInt(chainIdHex, 16);

    const tx: ethers.TransactionRequest = {
      from: account.address,
      data: txRequest.data || "0x",
      value: txRequest.value ? BigInt(txRequest.value) : 0n,
      chainId,
    };

    if (txRequest.to) {
      const toAddress = typeof txRequest.to === 'string' ? txRequest.to : await txRequest.to;
      tx.to = toAddress;
    }

    if (txRequest.nonce !== undefined) {
      tx.nonce = parseInt(txRequest.nonce, 16);
    } else {
      const nonceHex = await this.baseProvider.request({ 
        method: "eth_getTransactionCount", 
        params: [account.address, "pending"] 
      });
      tx.nonce = parseInt(nonceHex, 16);
    }

    if (txRequest.gasLimit) {
      tx.gasLimit = BigInt(txRequest.gasLimit);
    } else if (txRequest.gas) {
      tx.gasLimit = BigInt(txRequest.gas);
    } else {
      const gasHex = await this.baseProvider.request({ 
        method: "eth_estimateGas", 
        params: [{
          from: tx.from,
          to: tx.to,
          data: tx.data,
          value: tx.value ? "0x" + tx.value.toString(16) : undefined,
        }] 
      });
      tx.gasLimit = BigInt(gasHex);
    }

    if (txRequest.maxFeePerGas && txRequest.maxPriorityFeePerGas) {
      tx.maxFeePerGas = BigInt(txRequest.maxFeePerGas);
      tx.maxPriorityFeePerGas = BigInt(txRequest.maxPriorityFeePerGas);
      tx.type = 2;
    } else if (txRequest.gasPrice) {
      tx.gasPrice = BigInt(txRequest.gasPrice);
      tx.type = 0;
    } else {
      const gasPriceHex = await this.baseProvider.request({ 
        method: "eth_gasPrice", 
        params: [] 
      });
      tx.gasPrice = BigInt(gasPriceHex);
      tx.type = 0;
    }

    const txData: any = {
      from: tx.from,
      data: tx.data,
      value: tx.value?.toString(),
      nonce: tx.nonce,
      gasLimit: tx.gasLimit?.toString(),
      gasPrice: tx.gasPrice?.toString(),
      maxFeePerGas: tx.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
      chainId: tx.chainId,
      type: tx.type,
    };
    
    if (tx.to) {
      txData.to = tx.to;
    }
    
    const unsignedTx = ethers.Transaction.from(txData);
    const serializedTx = unsignedTx.unsignedSerialized;
    const txBuffer = ethers.getBytes(serializedTx);

    const signature = await this.ledgerSigner.signTransaction(
      account.derivationPath,
      new Uint8Array(txBuffer)
    );

    unsignedTx.signature = {
      r: signature.r,
      s: signature.s,
      v: signature.v,
    };

    return unsignedTx.serialized;
  }

  private async handleSignMessage(params: any[]): Promise<string> {
    const [message, address] = params[0].startsWith("0x") 
      ? [params[0], params[1]] 
      : [params[1], params[0]];

    const account = this.accounts.find(
      acc => acc.address.toLowerCase() === address.toLowerCase()
    );

    if (!account) {
      throw new Error(`Account ${address} not found in Ledger accounts`);
    }

    const messageText = ethers.toUtf8String(message);
    const signature = await this.ledgerSigner.signMessage(
      account.derivationPath, 
      messageText
    );

    // Combine signature components
    const r = signature.r.padStart(64, '0');
    const s = signature.s.padStart(64, '0');
    const v = signature.v.toString(16).padStart(2, '0');
    
    return `0x${r}${s}${v}`;
  }

  private async handleSignTypedData(params: any[]): Promise<string> {
    const [address, typedDataJson] = params;
    const typedData = typeof typedDataJson === "string" 
      ? JSON.parse(typedDataJson) 
      : typedDataJson;

    const account = this.accounts.find(
      acc => acc.address.toLowerCase() === address.toLowerCase()
    );

    if (!account) {
      throw new Error(`Account ${address} not found in Ledger accounts`);
    }

    const signature = await this.ledgerSigner.signTypedData(
      account.derivationPath,
      typedData
    );

    // Combine signature components
    const r = signature.r.padStart(64, '0');
    const s = signature.s.padStart(64, '0');
    const v = signature.v.toString(16).padStart(2, '0');
    
    return `0x${r}${s}${v}`;
  }

  async disconnect(): Promise<void> {
    await this.ledgerSigner.disconnect();
    this.accounts = [];
  }
}