import { ethers } from "ethers";
import type { DMKManager } from "./dmk-manager.js";
import { UserRejectedError } from "../types.js";

export class EthereumCommands {
  constructor(private dmkManager: DMKManager) {}

  async getAddress(derivationPath: string): Promise<{ address: string; publicKey: string }> {
    const command = {
      name: "get-address",
      params: {
        derivationPath,
        displayOnDevice: false,
      },
    };

    const response = await this.dmkManager.sendCommand<{
      address: string;
      publicKey: string;
    }>(command);

    return {
      address: ethers.getAddress(response.address),
      publicKey: response.publicKey,
    };
  }

  async signTransaction(
    derivationPath: string,
    serializedTx: string
  ): Promise<{ v: string; r: string; s: string }> {
    const command = {
      name: "sign-transaction",
      params: {
        derivationPath,
        transaction: serializedTx,
      },
    };

    try {
      const response = await this.dmkManager.sendCommand<{
        v: string;
        r: string;
        s: string;
      }>(command);

      return response;
    } catch (error: any) {
      if (error.message?.includes("rejected") || error.code === "0x6985") {
        throw new UserRejectedError();
      }
      throw error;
    }
  }

  async signMessage(
    derivationPath: string,
    message: string
  ): Promise<string> {
    const command = {
      name: "sign-message",
      params: {
        derivationPath,
        message: Buffer.from(message).toString("hex"),
      },
    };

    try {
      const response = await this.dmkManager.sendCommand<{
        signature: string;
      }>(command);

      return response.signature;
    } catch (error: any) {
      if (error.message?.includes("rejected") || error.code === "0x6985") {
        throw new UserRejectedError();
      }
      throw error;
    }
  }

  async signTypedData(
    derivationPath: string,
    domain: any,
    types: any,
    value: any
  ): Promise<string> {
    const encodedData = this.encodeEIP712(domain, types, value);
    
    const command = {
      name: "sign-typed-data",
      params: {
        derivationPath,
        data: encodedData,
      },
    };

    try {
      const response = await this.dmkManager.sendCommand<{
        signature: string;
      }>(command);

      return response.signature;
    } catch (error: any) {
      if (error.message?.includes("rejected") || error.code === "0x6985") {
        throw new UserRejectedError();
      }
      throw error;
    }
  }

  private encodeEIP712(domain: any, types: any, value: any): string {
    const TypedDataEncoder = ethers.TypedDataEncoder;
    const encoder = new TypedDataEncoder(types);
    
    const domainSeparator = TypedDataEncoder.hashDomain(domain);
    const valueHash = encoder.hash(value);
    
    const digestBytes = ethers.concat([
      "0x1901",
      domainSeparator,
      valueHash,
    ]);
    
    return ethers.hexlify(digestBytes);
  }

  async getAppVersion(): Promise<{ version: string; flags: number }> {
    const command = {
      name: "get-app-version",
      params: {},
    };

    const response = await this.dmkManager.sendCommand<{
      version: string;
      flags: number;
    }>(command);

    return response;
  }
}