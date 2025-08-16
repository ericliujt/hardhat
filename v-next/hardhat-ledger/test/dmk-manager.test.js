import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";

describe("DMKManager", () => {
  let DMKManager;
  let DeviceNotConnectedError;
  let dmkManager;
  let mockDMK;

  beforeEach(async () => {
    // Import the compiled JS files to avoid DMK import issues
    const dmkModule = await import("../dist/src/internal/dmk-manager.js");
    const typesModule = await import("../dist/src/types.js");
    
    DMKManager = dmkModule.DMKManager;
    DeviceNotConnectedError = typesModule.DeviceNotConnectedError;
    
    dmkManager = new DMKManager({
      connectionTimeout: 5000,
      transportType: "usb",
    });

    // Mock the internal DMK instance
    mockDMK = {
      startDiscovering: mock.fn(() => ({
        subscribe: mock.fn((observer) => {
          observer.next({ id: "device-1", modelId: "nanoX" });
          return { unsubscribe: mock.fn() };
        }),
      })),
      connect: mock.fn(() => Promise.resolve("session-1")),
      getConnectedDevice: mock.fn(() => Promise.resolve({
        id: "device-1",
        modelId: "nanoX",
      })),
      sendCommand: mock.fn(() => Promise.resolve({
        status: "success",
        data: { success: true },
      })),
      disconnect: mock.fn(() => Promise.resolve()),
    };
    
    // Replace the internal dmk instance
    dmkManager.dmk = mockDMK;
  });

  afterEach(async () => {
    await dmkManager.disconnect();
  });

  describe("connect", () => {
    it("should connect to a discovered device", async () => {
      await dmkManager.connect();
      
      assert.strictEqual(dmkManager.isConnected(), true);
      assert.strictEqual(dmkManager.getDeviceId(), "device-1");
      assert.strictEqual(dmkManager.getModelId(), "nanoX");
    });

    it("should throw DeviceNotConnectedError when no devices found", async () => {
      mockDMK.startDiscovering = mock.fn(() => ({
        subscribe: mock.fn((observer) => {
          return { unsubscribe: mock.fn() };
        }),
      }));
      
      dmkManager.dmk = mockDMK;
      
      await assert.rejects(
        () => dmkManager.connect(),
        DeviceNotConnectedError
      );
    });
  });

  describe("openEthereumApp", () => {
    it("should open Ethereum app on connected device", async () => {
      dmkManager.device = { id: "device-1", modelId: "nanoX" };
      dmkManager.sessionId = "session-1";
      dmkManager.dmk = mockDMK;
      
      await assert.doesNotReject(() => dmkManager.openEthereumApp());
    });

    it("should throw when device not connected", async () => {
      await assert.rejects(
        () => dmkManager.openEthereumApp(),
        DeviceNotConnectedError
      );
    });
  });

  describe("sendCommand", () => {
    it("should send command to connected device", async () => {
      dmkManager.device = { id: "device-1", modelId: "nanoX" };
      dmkManager.sessionId = "session-1";
      dmkManager.dmk = mockDMK;
      
      const result = await dmkManager.sendCommand({ test: "command" });
      
      assert.deepStrictEqual(result, { success: true });
    });

    it("should throw when device not connected", async () => {
      await assert.rejects(
        () => dmkManager.sendCommand({ test: "command" }),
        DeviceNotConnectedError
      );
    });
  });

  describe("disconnect", () => {
    it("should disconnect device and clear state", async () => {
      dmkManager.device = { id: "device-1", modelId: "nanoX" };
      dmkManager.sessionId = "session-1";
      dmkManager.dmk = mockDMK;
      
      await dmkManager.disconnect();
      
      assert.strictEqual(dmkManager.isConnected(), false);
      assert.strictEqual(dmkManager.getDeviceId(), null);
      assert.strictEqual(dmkManager.getModelId(), null);
    });
  });
});