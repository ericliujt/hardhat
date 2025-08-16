import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import { DMKManager } from "../dist/src/internal/dmk-manager.js";
import { DeviceNotConnectedError } from "../dist/src/types.js";

describe("DMKManager", () => {
  let dmkManager;
  let mockDMK;

  beforeEach(() => {
    dmkManager = new DMKManager({
      connectionTimeout: 5000,
      transportType: "usb",
    });

    mockDMK = {
      startDiscovering: mock.fn(() => ({
        pipe: mock.fn(() => Promise.resolve({
          status: "discovered",
          discoveredDevices: new Set([{
            id: "device-1",
            modelId: "nanoX",
          }]),
        })),
      })),
      connect: mock.fn(() => ({
        pipe: mock.fn(() => Promise.resolve({
          status: "connected",
          connectedDevice: {
            id: "device-1",
            modelId: "nanoX",
          },
          sessionId: "session-1",
        })),
      })),
      sendCommand: mock.fn(() => ({
        pipe: mock.fn(() => Promise.resolve({
          status: "success",
          response: { success: true },
        })),
      })),
      disconnect: mock.fn(() => ({
        pipe: mock.fn(() => Promise.resolve({
          status: "disconnected",
        })),
      })),
    };
  });

  afterEach(async () => {
    await dmkManager.disconnect();
  });

  describe("connect", () => {
    it("should connect to a discovered device", async () => {
      dmkManager.dmk = mockDMK;
      
      await dmkManager.connect();
      
      assert.strictEqual(dmkManager.isConnected(), true);
      assert.strictEqual(dmkManager.getDeviceId(), "device-1");
      assert.strictEqual(dmkManager.getModelId(), "nanoX");
    });

    it("should throw DeviceNotConnectedError when no devices found", async () => {
      mockDMK.startDiscovering = mock.fn(() => ({
        pipe: mock.fn(() => Promise.resolve({
          status: "discovered",
          discoveredDevices: new Set(),
        })),
      }));
      
      dmkManager.dmk = mockDMK;
      
      await assert.rejects(
        () => dmkManager.connect(),
        DeviceNotConnectedError
      );
    });

    it("should timeout if device discovery takes too long", async () => {
      mockDMK.startDiscovering = mock.fn(() => ({
        pipe: mock.fn(() => new Promise(() => {})),
      }));
      
      dmkManager.dmk = mockDMK;
      dmkManager.options.connectionTimeout = 100;
      
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