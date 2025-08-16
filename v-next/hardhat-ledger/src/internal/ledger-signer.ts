import { 
  DeviceManagementKit,
  DeviceActionStatus,
} from "@ledgerhq/device-management-kit";
import { 
  SignerEthBuilder,
  type SignerEth,
} from "@ledgerhq/device-signer-kit-ethereum";
import { firstValueFrom, filter } from "rxjs";
import { 
  DeviceNotConnectedError,
  UserRejectedError,
  type DMKOptions,
} from "../types.js";

export class LedgerSigner {
  private dmk: DeviceManagementKit;
  private sessionId: string | null = null;
  private signer: SignerEth | null = null;
  private readonly options: Required<DMKOptions>;

  constructor(options?: DMKOptions) {
    this.options = {
      connectionTimeout: options?.connectionTimeout || 30000,
      deviceFilter: options?.deviceFilter || {},
      transportType: options?.transportType || "usb",
    };

    this.dmk = new DeviceManagementKit();
  }

  async connect(): Promise<void> {
    // Start device discovery
    const discoveryObs = this.dmk.startDiscovering({});
    
    // Wait for device discovery with timeout
    const discovered = await Promise.race([
      firstValueFrom(discoveryObs),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new DeviceNotConnectedError("Discovery timeout")), this.options.connectionTimeout)
      ),
    ]);

    // Connect to the first discovered device
    this.sessionId = await this.dmk.connect({ 
      device: discovered 
    });

    if (!this.sessionId) {
      throw new DeviceNotConnectedError("Failed to establish device connection");
    }

    // Initialize the Ethereum signer
    this.signer = new SignerEthBuilder({
      dmk: this.dmk,
      sessionId: this.sessionId,
    } as any).build();
  }

  async getAddress(derivationPath: string, checkOnDevice = false): Promise<{
    address: string;
    publicKey: string;
  }> {
    if (!this.signer) {
      throw new DeviceNotConnectedError();
    }

    const { observable } = this.signer.getAddress(derivationPath, {
      checkOnDevice,
      returnChainCode: false,
    });

    const result = await firstValueFrom(
      observable.pipe(
        filter((state: any) => 
          state.status === DeviceActionStatus.Completed ||
          state.status === DeviceActionStatus.Error
        )
      )
    );

    if (result.status === DeviceActionStatus.Error) {
      throw new Error(result.error?.message || "Failed to get address");
    }

    return {
      address: result.output.address,
      publicKey: result.output.publicKey,
    };
  }

  async signTransaction(
    derivationPath: string,
    transaction: Uint8Array,
    domain?: string
  ): Promise<{ r: string; s: string; v: number }> {
    if (!this.signer) {
      throw new DeviceNotConnectedError();
    }

    const { observable } = this.signer.signTransaction(
      derivationPath,
      transaction,
      { domain }
    );

    const result = await firstValueFrom(
      observable.pipe(
        filter((state: any) => 
          state.status === DeviceActionStatus.Completed ||
          state.status === DeviceActionStatus.Error
        )
      )
    );

    if (result.status === DeviceActionStatus.Error) {
      if (result.error?.message?.includes("rejected")) {
        throw new UserRejectedError();
      }
      throw new Error(result.error?.message || "Failed to sign transaction");
    }

    return result.output;
  }

  async signMessage(
    derivationPath: string,
    message: string
  ): Promise<{ r: string; s: string; v: number }> {
    if (!this.signer) {
      throw new DeviceNotConnectedError();
    }

    const { observable } = this.signer.signMessage(derivationPath, message);

    const result = await firstValueFrom(
      observable.pipe(
        filter((state: any) => 
          state.status === DeviceActionStatus.Completed ||
          state.status === DeviceActionStatus.Error
        )
      )
    );

    if (result.status === DeviceActionStatus.Error) {
      if (result.error?.message?.includes("rejected")) {
        throw new UserRejectedError();
      }
      throw new Error(result.error?.message || "Failed to sign message");
    }

    return result.output;
  }

  async signTypedData(
    derivationPath: string,
    typedData: any
  ): Promise<{ r: string; s: string; v: number }> {
    if (!this.signer) {
      throw new DeviceNotConnectedError();
    }

    const { observable } = this.signer.signTypedData(derivationPath, typedData);

    const result = await firstValueFrom(
      observable.pipe(
        filter((state: any) => 
          state.status === DeviceActionStatus.Completed ||
          state.status === DeviceActionStatus.Error
        )
      )
    );

    if (result.status === DeviceActionStatus.Error) {
      if (result.error?.message?.includes("rejected")) {
        throw new UserRejectedError();
      }
      throw new Error(result.error?.message || "Failed to sign typed data");
    }

    return result.output;
  }

  async disconnect(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.dmk.disconnect({ sessionId: this.sessionId });
      } catch (error) {
        // Ignore disconnect errors
      }
      this.sessionId = null;
      this.signer = null;
    }
  }

  isConnected(): boolean {
    return this.sessionId !== null && this.signer !== null;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}