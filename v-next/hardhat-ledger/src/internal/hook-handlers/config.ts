const configHookHandler = {
  resolveUserConfig: async (
    userConfig: any,
    resolveConfigurationVariable: any,
    next: any
  ) => {
    // Let Hardhat resolve the config first
    const resolvedConfig = await next(userConfig, resolveConfigurationVariable);
    
    // Add ledger fields to network configs
    const updatedNetworks: any = {};
    
    for (const [networkName, networkConfig] of Object.entries(resolvedConfig.networks || {})) {
      const userNetwork = userConfig.networks?.[networkName] || {};
      
      updatedNetworks[networkName] = {
        ...(networkConfig as any),
        ledgerAccounts: userNetwork.ledgerAccounts,
        ledgerOptions: userNetwork.ledgerOptions,
      };
    }
    
    return {
      ...resolvedConfig,
      networks: updatedNetworks,
    };
  },
};

export default configHookHandler;