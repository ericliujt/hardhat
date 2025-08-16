const hardhatLedgerPlugin = {
  id: "@nomicfoundation/hardhat-ledger",
  hookHandlers: {
    config: async () => {
      const module = await import("./internal/hook-handlers/config.js");
      return { default: () => Promise.resolve(module.default) };
    },
    network: async () => {
      const module = await import("./internal/hook-handlers/network.js");
      return { default: () => Promise.resolve(module.default) };
    },
  },
};

export default hardhatLedgerPlugin as any;

export * from "./types.js";
export * from "./type-extensions.js";