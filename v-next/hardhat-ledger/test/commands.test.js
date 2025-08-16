import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { EthereumCommands } from "../dist/src/internal/commands.js";
import { UserRejectedError } from "../dist/src/types.js";

describe("EthereumCommands", () => {
  let commands;
  let mockDMKManager;

  beforeEach(() => {
    mockDMKManager = {
      sendCommand: mock.fn(),
    };
    
    commands = new EthereumCommands(mockDMKManager);
  });

  describe("getAddress", () => {
    it("should get address and public key for derivation path", async () => {
      const mockResponse = {
        address: "0x742d35cc6634c0532925a3b844bc9e7595f0b0bb",
        publicKey: "0x04abc...",
      };
      
      mockDMKManager.sendCommand.mock.mockImplementation(() => 
        Promise.resolve(mockResponse)
      );
      
      const result = await commands.getAddress("m/44'/60'/0'/0/0");
      
      assert.strictEqual(result.address.toLowerCase(), "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEBb".toLowerCase());
      assert.strictEqual(result.publicKey, "0x04abc...");
      assert.strictEqual(mockDMKManager.sendCommand.mock.calls.length, 1);
      assert.deepStrictEqual(mockDMKManager.sendCommand.mock.calls[0].arguments[0], {
        name: "get-address",
        params: {
          derivationPath: "m/44'/60'/0'/0/0",
          displayOnDevice: false,
        },
      });
    });
  });

  describe("signTransaction", () => {
    it("should sign transaction and return signature", async () => {
      const mockSignature = {
        v: "1b",
        r: "1234567890abcdef",
        s: "fedcba0987654321",
      };
      
      mockDMKManager.sendCommand.mock.mockImplementation(() => 
        Promise.resolve(mockSignature)
      );
      
      const result = await commands.signTransaction(
        "m/44'/60'/0'/0/0",
        "0xaabbccdd"
      );
      
      assert.deepStrictEqual(result, mockSignature);
      assert.strictEqual(mockDMKManager.sendCommand.mock.calls.length, 1);
    });

    it("should throw UserRejectedError when user rejects", async () => {
      mockDMKManager.sendCommand.mock.mockImplementation(() => 
        Promise.reject(new Error("Transaction rejected by user"))
      );
      
      await assert.rejects(
        () => commands.signTransaction("m/44'/60'/0'/0/0", "0xaabbccdd"),
        UserRejectedError
      );
    });
  });

  describe("signMessage", () => {
    it("should sign message and return signature", async () => {
      const mockSignature = { signature: "0xabcdef123456" };
      
      mockDMKManager.sendCommand.mock.mockImplementation(() => 
        Promise.resolve(mockSignature)
      );
      
      const result = await commands.signMessage(
        "m/44'/60'/0'/0/0",
        "Hello World"
      );
      
      assert.strictEqual(result, "0xabcdef123456");
      assert.strictEqual(mockDMKManager.sendCommand.mock.calls.length, 1);
      
      const call = mockDMKManager.sendCommand.mock.calls[0].arguments[0];
      assert.strictEqual(call.name, "sign-message");
      assert.strictEqual(call.params.derivationPath, "m/44'/60'/0'/0/0");
    });

    it("should throw UserRejectedError when user rejects", async () => {
      mockDMKManager.sendCommand.mock.mockImplementation(() => 
        Promise.reject(new Error("Message signing rejected"))
      );
      
      await assert.rejects(
        () => commands.signMessage("m/44'/60'/0'/0/0", "Hello"),
        UserRejectedError
      );
    });
  });

  describe("getAppVersion", () => {
    it("should get app version info", async () => {
      const mockVersion = {
        version: "1.10.0",
        flags: 0,
      };
      
      mockDMKManager.sendCommand.mock.mockImplementation(() => 
        Promise.resolve(mockVersion)
      );
      
      const result = await commands.getAppVersion();
      
      assert.deepStrictEqual(result, mockVersion);
      assert.strictEqual(mockDMKManager.sendCommand.mock.calls.length, 1);
      assert.deepStrictEqual(mockDMKManager.sendCommand.mock.calls[0].arguments[0], {
        name: "get-app-version",
        params: {},
      });
    });
  });
});