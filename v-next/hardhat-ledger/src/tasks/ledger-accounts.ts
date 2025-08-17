// Task implementation for ledger:accounts

export async function ledgerAccountsTask(
  _params: any,
  hre: any
): Promise<void> {
  // Connect to the network first
  const connection = await hre.network.connect();
  
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
  if (connection.provider?.close) {
    await connection.provider.close();
  }
}