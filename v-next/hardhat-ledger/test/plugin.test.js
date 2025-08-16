import { describe, it } from "node:test";
import assert from "node:assert";

describe("Hardhat Ledger Plugin", () => {
  describe("Plugin Structure", () => {
    it("should export the plugin with correct structure", async () => {
      const plugin = await import("../dist/src/index.js");
      
      assert.ok(plugin.default, "Plugin should have default export");
      assert.strictEqual(plugin.default.id, "@nomicfoundation/hardhat-ledger");
      assert.ok(plugin.default.hookHandlers, "Plugin should have hookHandlers");
      assert.ok(plugin.default.hookHandlers.config, "Plugin should have config hook");
      assert.ok(plugin.default.hookHandlers.network, "Plugin should have network hook");
    });
    
    it("should export required types", async () => {
      const types = await import("../dist/src/types.js");
      
      assert.ok(types.LedgerError, "Should export LedgerError");
      assert.ok(types.DeviceNotConnectedError, "Should export DeviceNotConnectedError");
      assert.ok(types.UserRejectedError, "Should export UserRejectedError");
      assert.ok(types.AppNotOpenError, "Should export AppNotOpenError");
    });
  });

  describe("Configuration Validation", () => {
    it("should validate correct ledger configuration", async () => {
      const configModule = await import("../dist/src/internal/hook-handlers/config.js");
      const configHandler = configModule.default;
      
      const mockConfig = {
        resolvedConfig: {
          networks: {
            mainnet: {}
          }
        },
        userConfig: {
          networks: {
            mainnet: {
              ledgerAccounts: [0, 1, 2],
              ledgerOptions: {
                dmkOptions: {
                  connectionTimeout: 30000,
                  transportType: "usb"
                }
              }
            }
          }
        }
      };
      
      const result = await configHandler.resolved(mockConfig, {});
      
      assert.ok(result.resolvedConfig);
      assert.deepStrictEqual(
        result.resolvedConfig.networks.mainnet.ledgerAccounts, 
        [0, 1, 2]
      );
      assert.ok(result.resolvedConfig.networks.mainnet.ledgerOptions);
      assert.strictEqual(
        result.resolvedConfig.networks.mainnet.ledgerOptions.dmkOptions.transportType,
        "usb"
      );
    });

    it("should reject invalid transport type", async () => {
      const configModule = await import("../dist/src/internal/hook-handlers/config.js");
      const configHandler = configModule.default;
      
      const mockConfig = {
        resolvedConfig: {
          networks: {
            mainnet: {}
          }
        },
        userConfig: {
          networks: {
            mainnet: {
              ledgerAccounts: [0],
              ledgerOptions: {
                dmkOptions: {
                  transportType: "invalid" // Should be "usb" or "ble"
                }
              }
            }
          }
        }
      };
      
      await assert.rejects(
        () => configHandler.resolved(mockConfig, {}),
        /Invalid Ledger configuration/,
        "Should reject invalid transport type"
      );
    });

    it("should handle mixed account configuration", async () => {
      const configModule = await import("../dist/src/internal/hook-handlers/config.js");
      const configHandler = configModule.default;
      
      const mockConfig = {
        resolvedConfig: {
          networks: {
            testnet: {}
          }
        },
        userConfig: {
          networks: {
            testnet: {
              ledgerAccounts: [0, "1", 2], // Mixed types
              ledgerOptions: {
                derivationFunction: (index) => `m/44'/60'/0'/0/${index}`
              }
            }
          }
        }
      };
      
      const result = await configHandler.resolved(mockConfig, {});
      
      assert.deepStrictEqual(
        result.resolvedConfig.networks.testnet.ledgerAccounts, 
        [0, "1", 2]
      );
      assert.ok(typeof result.resolvedConfig.networks.testnet.ledgerOptions.derivationFunction === 'function');
    });
  });

  // Network handler tests skip DMK import issues
  // The handler is tested through integration tests instead

  describe("Error Classes", () => {
    it("should create proper error instances", async () => {
      const { 
        LedgerError, 
        DeviceNotConnectedError,
        UserRejectedError,
        AppNotOpenError 
      } = await import("../dist/src/types.js");
      
      const ledgerError = new LedgerError("Test error", "TEST_CODE");
      assert.ok(ledgerError instanceof Error);
      assert.strictEqual(ledgerError.message, "Test error");
      assert.strictEqual(ledgerError.code, "TEST_CODE");
      assert.strictEqual(ledgerError.name, "LedgerError");
      
      const deviceError = new DeviceNotConnectedError();
      assert.ok(deviceError instanceof LedgerError);
      assert.strictEqual(deviceError.code, "DEVICE_NOT_CONNECTED");
      
      const userError = new UserRejectedError();
      assert.ok(userError instanceof LedgerError);
      assert.strictEqual(userError.code, "USER_REJECTED");
      
      const appError = new AppNotOpenError();
      assert.ok(appError instanceof LedgerError);
      assert.strictEqual(appError.code, "APP_NOT_OPEN");
    });
  });
});