import { task } from "hardhat/config";

const ledgerAccountsTask = task("ledger:accounts", "Lists all accounts from the connected Ledger device")
  .setAction(async () => ({
    default: async (_params: any, hre: any) => {
      const { ledgerAccountsTask } = await import("./tasks/ledger-accounts.js");
      return ledgerAccountsTask(_params, hre);
    },
  }))
  .build();

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
  tasks: [ledgerAccountsTask],
};

export default hardhatLedgerPlugin as any;

export * from "./types.js";
export * from "./type-extensions.js";