import { 
  DeviceManagementKit,
  type DeviceId,
  type DeviceModelId,
  type ConnectedDevice,
  DeviceLockedError,
} from "@ledgerhq/device-management-kit";
import { 
  DeviceNotConnectedError,
  AppNotOpenError,
  type DMKOptions,
} from "../types.js";

export class DMKManager {
  private dmk: DeviceManagementKit;
  private device: ConnectedDevice | null = null;
  private sessionId: string | null = null;
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
    const discoveryObs = this.dmk.startDiscovering({});
    
    const discoveredDevices: any[] = [];
    const subscription = discoveryObs.subscribe({
      next: (device) => {
        discoveredDevices.push(device);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));
    subscription.unsubscribe();
    
    if (discoveredDevices.length === 0) {
      throw new DeviceNotConnectedError("No Ledger devices found");
    }

    const deviceToConnect = this.selectDevice(discoveredDevices);
    
    if (!deviceToConnect) {
      throw new DeviceNotConnectedError(
        "No matching Ledger device found with the specified filter"
      );
    }

    await this.connectToDevice(deviceToConnect.id);
  }

  private selectDevice(devices: Array<{ id: DeviceId; modelId: DeviceModelId }>): 
    { id: DeviceId; modelId: DeviceModelId } | null {
    
    const { deviceFilter } = this.options;
    
    for (const device of devices) {
      if (deviceFilter.deviceId && device.id !== deviceFilter.deviceId) {
        continue;
      }
      
      if (deviceFilter.modelId && device.modelId !== deviceFilter.modelId) {
        continue;
      }
      
      return device;
    }
    
    return devices[0] || null;
  }

  private async connectToDevice(deviceId: DeviceId): Promise<void> {
    const sessionId = await this.dmk.connect({ device: { id: deviceId } as any });
    
    if (!sessionId) {
      throw new DeviceNotConnectedError("Failed to establish device connection");
    }

    this.sessionId = sessionId;
    const connectedDevice = await this.dmk.getConnectedDevice({ sessionId });
    
    if (connectedDevice) {
      this.device = connectedDevice;
    } else {
      throw new DeviceNotConnectedError("Failed to get connected device");
    }
  }

  async openEthereumApp(): Promise<void> {
    if (!this.device || !this.sessionId) {
      throw new DeviceNotConnectedError();
    }

    try {
      const result = await this.sendCommand({
        name: "open-app",
        params: { appName: "Ethereum" },
      });
      
      if (!result) {
        throw new AppNotOpenError("Failed to open Ethereum app");
      }
    } catch (error: any) {
      if (error instanceof DeviceLockedError) {
        throw new AppNotOpenError("Device is locked. Please unlock it and try again");
      }
      throw new AppNotOpenError(
        `Failed to open Ethereum app: ${error.message}`
      );
    }
  }

  async sendCommand<T>(command: any): Promise<T> {
    if (!this.device || !this.sessionId) {
      throw new DeviceNotConnectedError();
    }

    try {
      const result = await this.dmk.sendCommand({
        sessionId: this.sessionId,
        command,
      });

      if ((result as any).status === "error") {
        throw new Error(`Command failed`);
      }

      return (result as any).data || result as T;
    } catch (error: any) {
      if (error instanceof DeviceLockedError) {
        throw new AppNotOpenError("Device is locked");
      }
      throw error;
    }
  }

  async executeDeviceAction<T>(
    createAction: () => any
  ): Promise<T> {
    if (!this.device || !this.sessionId) {
      throw new DeviceNotConnectedError();
    }

    try {
      const action = createAction();
      const result = await action;
      return result as T;
    } catch (error: any) {
      if (error instanceof DeviceLockedError) {
        throw new AppNotOpenError("Device is locked");
      }
      throw new Error(`Action failed: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.device && this.sessionId) {
      try {
        await this.dmk.disconnect({ sessionId: this.sessionId });
      } catch (error) {
        // Ignore disconnect errors
      }
      
      this.device = null;
      this.sessionId = null;
    }
  }

  isConnected(): boolean {
    return this.device !== null && this.sessionId !== null;
  }

  getDeviceId(): DeviceId | null {
    return this.device?.id || null;
  }

  getModelId(): DeviceModelId | null {
    return this.device?.modelId || null;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}