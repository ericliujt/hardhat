import { 
  DeviceManagementKit,
  type DeviceId,
  type DeviceModelId,
  type ConnectedDevice,
  type DeviceAction,
  type DeviceActionState,
  type TransportType,
  LockedDeviceError,
  type ApduResponse,
} from "@ledgerhq/device-management-kit";
import { 
  DeviceNotConnectedError,
  AppNotOpenError,
  type DMKOptions,
} from "../types.js";
import { firstValueFrom, timeout, catchError, of } from "rxjs";

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

    this.dmk = new DeviceManagementKit({
      transports: this.getTransports(),
    });
  }

  private getTransports(): TransportType[] {
    switch (this.options.transportType) {
      case "usb":
        return ["USB"];
      case "ble":
        return ["BLE"];
      default:
        return ["USB"];
    }
  }

  async connect(): Promise<void> {
    const deviceAction = this.dmk.startDiscovering();
    
    const discoveryState = await firstValueFrom(
      deviceAction.pipe(
        timeout(this.options.connectionTimeout),
        catchError((error) => {
          if (error.name === "TimeoutError") {
            throw new DeviceNotConnectedError(
              `No Ledger device found within ${this.options.connectionTimeout}ms`
            );
          }
          throw error;
        })
      )
    );

    if (discoveryState.status === "error") {
      throw new DeviceNotConnectedError(
        `Failed to discover device: ${discoveryState.error.message}`
      );
    }

    const discoveredDevices = Array.from(discoveryState.discoveredDevices || []);
    
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
    const connectAction = this.dmk.connect({ deviceId });
    
    const connectionState = await firstValueFrom(
      connectAction.pipe(
        timeout(this.options.connectionTimeout),
        catchError((error) => {
          if (error.name === "TimeoutError") {
            throw new DeviceNotConnectedError(
              `Connection timeout after ${this.options.connectionTimeout}ms`
            );
          }
          throw error;
        })
      )
    );

    if (connectionState.status === "error") {
      throw new DeviceNotConnectedError(
        `Failed to connect to device: ${connectionState.error.message}`
      );
    }

    if (connectionState.status === "connected" && connectionState.connectedDevice) {
      this.device = connectionState.connectedDevice;
      this.sessionId = connectionState.sessionId;
    } else {
      throw new DeviceNotConnectedError("Failed to establish device connection");
    }
  }

  async openEthereumApp(): Promise<void> {
    if (!this.device || !this.sessionId) {
      throw new DeviceNotConnectedError();
    }

    const openAppAction = this.dmk.sendCommand({
      deviceId: this.device.id,
      sessionId: this.sessionId,
      command: {
        name: "open-app",
        params: { appName: "Ethereum" },
      },
    });

    const result = await firstValueFrom(
      openAppAction.pipe(
        timeout(60000),
        catchError((error) => {
          if (error instanceof LockedDeviceError) {
            throw new AppNotOpenError("Device is locked. Please unlock it and try again");
          }
          throw error;
        })
      )
    );

    if (result.status === "error") {
      throw new AppNotOpenError(
        `Failed to open Ethereum app: ${result.error.message}`
      );
    }
  }

  async sendCommand<T>(command: any): Promise<T> {
    if (!this.device || !this.sessionId) {
      throw new DeviceNotConnectedError();
    }

    const commandAction = this.dmk.sendCommand({
      deviceId: this.device.id,
      sessionId: this.sessionId,
      command,
    });

    const result = await firstValueFrom(
      commandAction.pipe(
        timeout(60000),
        catchError((error) => {
          if (error instanceof LockedDeviceError) {
            throw new AppNotOpenError("Device is locked");
          }
          throw error;
        })
      )
    );

    if (result.status === "error") {
      throw new Error(`Command failed: ${result.error.message}`);
    }

    return result.response as T;
  }

  async executeDeviceAction<T>(
    createAction: () => DeviceAction<T>
  ): Promise<T> {
    if (!this.device) {
      throw new DeviceNotConnectedError();
    }

    const action = createAction();
    
    const result = await firstValueFrom(
      action.pipe(
        timeout(60000),
        catchError((error) => {
          if (error instanceof LockedDeviceError) {
            throw new AppNotOpenError("Device is locked");
          }
          throw error;
        })
      )
    );

    if ("error" in result && result.error) {
      throw new Error(`Action failed: ${result.error.message}`);
    }

    return result as T;
  }

  async disconnect(): Promise<void> {
    if (this.device && this.sessionId) {
      try {
        await firstValueFrom(
          this.dmk.disconnect({ sessionId: this.sessionId })
        );
      } catch (error) {
        console.error("Error disconnecting device:", error);
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