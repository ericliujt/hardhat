const taskHookHandler = {
  registered: async (context: any, next: any) => {
    const taskDefinitions = await next(context);
    
    // Register ledger:accounts task
    taskDefinitions.set("ledger:accounts", {
      name: "ledger:accounts",
      description: "Lists all accounts from the connected Ledger device",
      action: async (_params: any, hre: any) => {
        const { ledgerAccountsTask } = await import("../../tasks/ledger-accounts.js");
        return ledgerAccountsTask(_params, hre);
      },
      paramDefinitions: {},
      positionalParamDefinitions: [],
    });

    return taskDefinitions;
  },
};

export default taskHookHandler;