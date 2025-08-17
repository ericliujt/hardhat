import { 
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
  private dmk: any;
  private sessionId: string | null = null;
  private signer: SignerEth | null = null;
  private readonly options: Required<DMKOptions>;

  constructor(options?: DMKOptions) {
    this.options = {
      connectionTimeout: options?.connectionTimeout || 30000,
      deviceFilter: options?.deviceFilter || {},
      transportType: options?.transportType || "usb",
    };

    // Initialize DMK - using dynamic import due to lack of TypeScript definitions
    this.initializeDMK();
  }

  private async initializeDMK(): Promise<void> {
    const dmkModule = await import("@ledgerhq/device-management-kit") as any;
    const TransportNodeHid = (await import("@ledgerhq/hw-transport-node-hid")).default as any;
    const purifyModule = await import("purify-ts") as any;
    const { DeviceManagementKitBuilder, ConsoleLogger } = dmkModule;
    const { Observable } = await import("rxjs");
    const { Right, Left } = purifyModule;
    
    // Store transport reference at factory level so it persists
    let currentTransport: any = null;
    
    // Create a transport factory function that matches DMK's expected interface
    const nodeHidTransportFactory = () => {
      const transport = {
        getIdentifier: () => "node-hid",
        id: "node-hid",
        create: async () => {
          return await TransportNodeHid.create();
        },
        listen: (observer: any) => {
          return TransportNodeHid.listen(observer);
        },
        isSupported: () => Promise.resolve(true),
        connect: async (deviceId: string) => {
          try {
            // Always use create() to get a fresh connection
            // The stored HID path becomes stale after use
            currentTransport = await TransportNodeHid.create();
            
            // Wrap the transport to provide DMK-expected interface
            const wrappedTransport = {
              ...currentTransport,
              sendApdu: async (apdu: Uint8Array) => {
                try {
                  // Ensure transport is still available
                  if (!currentTransport) {
                    return Left(new Error("Transport disconnected"));
                  }
                  
                  // Convert Uint8Array to Buffer for hw-transport
                  const buffer = Buffer.from(apdu);
                  const response = await currentTransport.exchange(buffer);
                  
                  // Ensure response is a proper Uint8Array
                  let responseArray: Uint8Array;
                  if (response instanceof Uint8Array) {
                    responseArray = response;
                  } else if (Buffer.isBuffer(response)) {
                    responseArray = new Uint8Array(response);
                  } else {
                    responseArray = new Uint8Array(Buffer.from(response));
                  }
                  
                  // DMK expects response in format: { data: Uint8Array, statusCode: Uint8Array }
                  // The last 2 bytes are the status code (SW1 SW2)
                  if (responseArray.length >= 2) {
                    const data = responseArray.slice(0, -2);
                    const statusCode = responseArray.slice(-2);
                    
                    return Right({
                      data,
                      statusCode
                    });
                  } else {
                    // If response is too short, assume it's just a status code
                    return Right({
                      data: new Uint8Array(),
                      statusCode: responseArray
                    });
                  }
                } catch (error: any) {
                  // Return Either.Left for errors
                  return Left(error);
                }
              },
              send: currentTransport.send?.bind(currentTransport),
              exchange: currentTransport.exchange?.bind(currentTransport),
              close: currentTransport.close?.bind(currentTransport)
            };
            
            // Return Either.Right for success
            return Right({
              id: deviceId,
              transport: wrappedTransport,
              sendApdu: wrappedTransport.sendApdu,
              deviceModel: {
                id: "nanoS",
                model: "Ledger Device",
                name: "Ledger Device"
              },
              close: async () => {
                if (currentTransport) {
                  await currentTransport.close();
                  currentTransport = null;
                }
              }
            });
          } catch (error: any) {
            // Return Either.Left for error
            return Left(error);
          }
        },
        disconnect: async () => {
          if (currentTransport) {
            await currentTransport.close();
            currentTransport = null;
          }
        },
        startDiscovering: () => {
          // Use TransportNodeHid's listen method for discovery
          return new Observable((observer: any) => {
            const subscription = TransportNodeHid.listen({
              next: (event: any) => {
                if (event.type === "add") {
                  // Generate a unique ID for DMK
                  const dmkDeviceId = `ledger-${Date.now()}`;
                  
                  observer.next({
                    id: dmkDeviceId,
                    deviceModel: {
                      id: event.device?.productName?.includes("Flex") ? "flex" : "nanoS",
                      model: event.device?.productName || "Ledger Device",
                      name: event.device?.productName || "Ledger Device"
                    },
                    transport: "node-hid"
                  });
                }
              },
              error: (err: any) => observer.error(err),
              complete: () => observer.complete()
            });
            
            return () => {
              subscription.unsubscribe();
            };
          });
        },
        stopDiscovering: () => Promise.resolve(),
      };
      
      return transport;
    };
    
    // Also add getIdentifier to the factory function
    nodeHidTransportFactory.getIdentifier = () => "node-hid";
    
    // Build DMK instance with Node HID transport
    this.dmk = new DeviceManagementKitBuilder()
      .addLogger(new ConsoleLogger())
      .addTransport(nodeHidTransportFactory as any)
      .build();
  }

  async connect(): Promise<void> {
    // Ensure DMK is initialized
    if (!this.dmk) {
      await this.initializeDMK();
    }

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
    // Origin token is required by the Context Module
    // For development/hackathon, we use a placeholder token
    this.signer = new SignerEthBuilder({
      dmk: this.dmk,
      sessionId: this.sessionId,
      originToken: "hardhat-ledger-dev", // Development token for hackathon
    } as any).build();
  }

  async getAddress(derivationPath: string, checkOnDevice = false): Promise<{
    address: string;
    publicKey: string;
  }> {
    if (!this.signer) {
      throw new DeviceNotConnectedError();
    }

    // DMK expects derivation path as a string but without the "m/" prefix
    // Convert from "m/44'/60'/0'/0/0" to "44'/60'/0'/0/0"
    const cleanPath = derivationPath.startsWith("m/") 
      ? derivationPath.slice(2) 
      : derivationPath;
    
    const { observable } = this.signer.getAddress(cleanPath, {
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

    // DMK expects derivation path as a string but without the "m/" prefix
    // Convert from "m/44'/60'/0'/0/0" to "44'/60'/0'/0/0"
    const cleanPath = derivationPath.startsWith("m/") 
      ? derivationPath.slice(2) 
      : derivationPath;

    const { observable } = this.signer.signTransaction(
      cleanPath,
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

    // DMK expects derivation path without the "m/" prefix
    const cleanPath = derivationPath.startsWith("m/") 
      ? derivationPath.slice(2) 
      : derivationPath;

    const { observable } = this.signer.signMessage(cleanPath, message);

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

    // DMK expects derivation path without the "m/" prefix
    const cleanPath = derivationPath.startsWith("m/") 
      ? derivationPath.slice(2) 
      : derivationPath;

    const { observable } = this.signer.signTypedData(cleanPath, typedData);

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
    // First, try to disconnect the DMK session
    if (this.sessionId && this.dmk) {
      try {
        await this.dmk.disconnect({ sessionId: this.sessionId });
      } catch (error: any) {
        // Ignore disconnect errors - they are not critical
        // DMK may throw "Unknown transport" errors which can be safely ignored
      }
    }
    
    // Note: Transport cleanup is handled by DMK's disconnect
    // The transport is managed in the factory closure and will be cleaned up there
    
    // Clear the session and signer references
    this.sessionId = null;
    this.signer = null;
  }

  isConnected(): boolean {
    return this.sessionId !== null && this.signer !== null;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}