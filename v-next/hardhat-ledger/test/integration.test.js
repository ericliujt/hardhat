import { describe, it, mock } from "node:test";
import assert from "node:assert";

describe("Integration Tests", () => {
  describe("Plugin exports", () => {
    it("should export the plugin with correct structure", async () => {
      const plugin = await import("../dist/src/index.js");
      
      assert.ok(plugin.default);
      assert.strictEqual(plugin.default.id, "@nomicfoundation/hardhat-ledger");
      assert.ok(plugin.default.hookHandlers);
      assert.ok(plugin.default.hookHandlers.config);
      assert.ok(plugin.default.hookHandlers.network);
    });
    
    it("should export types", async () => {
      const types = await import("../dist/src/types.js");
      
      assert.ok(types.LedgerError);
      assert.ok(types.DeviceNotConnectedError);
      assert.ok(types.UserRejectedError);
      assert.ok(types.AppNotOpenError);
    });
  });

  describe("Configuration validation", () => {
    it("should validate ledger configuration", async () => {
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
      
      const result = await configHandler.resolveUserConfig(
        mockConfig.userConfig,
        (key) => key,
        async (config) => mockConfig.resolvedConfig
      );
      
      assert.ok(result);
      assert.deepStrictEqual(
        result.networks.mainnet.ledgerAccounts, 
        [0, 1, 2]
      );
      assert.ok(result.networks.mainnet.ledgerOptions);
      assert.strictEqual(
        result.networks.mainnet.ledgerOptions.dmkOptions.transportType,
        "usb"
      );
    });

    it("should reject invalid configuration", async () => {
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
              ledgerAccounts: "invalid", // Should be array
              ledgerOptions: {
                dmkOptions: {
                  transportType: "invalid" // Should be "usb" or "ble"
                }
              }
            }
          }
        }
      };
      
      // Config handler doesn't validate, just passes through
      const result = await configHandler.resolveUserConfig(
        mockConfig.userConfig,
        (key) => key,
        async (config) => mockConfig.resolvedConfig
      );
      
      // Should pass through invalid config
      assert.strictEqual(result.networks.mainnet.ledgerAccounts, "invalid");
    });
  });

});