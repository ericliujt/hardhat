// Task implementation for ledger:accounts

export async function ledgerAccountsTask(
  _params: any,
  hre: any
): Promise<void> {
  console.log("Connecting to network...");
  
  // Connect to the network first
  const connection = await hre.network.connect();
  
  console.log("Network config:", connection.networkConfig);
  console.log("Connection has ledger?", !!connection.ledger);
  
  if (!connection.ledger) {
    console.log("No Ledger configured for this network");
    console.log("Make sure your network config includes 'ledgerAccounts' array");
    return;
  }

  console.log("Ledger accounts:");
  const accounts = connection.ledger.accounts;
  
  for (let i = 0; i < accounts.length; i++) {
    console.log(`  [${i}]: ${accounts[i].address}`);
    console.log(`       Path: ${accounts[i].derivationPath}`);
  }
  
  console.log(`\nConnected: ${connection.ledger.isConnected}`);
  
  // Close the connection when done
  await hre.network.close(connection);
}