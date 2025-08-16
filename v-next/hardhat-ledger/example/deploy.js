import { ethers } from "hardhat";

async function main() {
  console.log("Deploying with Ledger hardware wallet...");
  
  // Get configured Ledger accounts
  const accounts = await ethers.getSigners();
  const ledgerSigner = accounts[0];
  
  console.log("Using Ledger account:", await ledgerSigner.getAddress());
  
  // Get balance
  const balance = await ethers.provider.getBalance(await ledgerSigner.getAddress());
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  // Example: Deploy a simple contract
  const contractCode = `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.19;
    
    contract SimpleStorage {
      uint256 public value;
      
      function setValue(uint256 _value) public {
        value = _value;
      }
    }
  `;
  
  // In a real scenario, you would compile the contract first
  // const Contract = await ethers.getContractFactory("SimpleStorage", ledgerSigner);
  // const contract = await Contract.deploy();
  // await contract.waitForDeployment();
  // console.log("Contract deployed to:", await contract.getAddress());
  
  // Example: Send a transaction
  console.log("\nSending test transaction...");
  console.log("Please approve the transaction on your Ledger device");
  
  const tx = await ledgerSigner.sendTransaction({
    to: "0x0000000000000000000000000000000000000000",
    value: ethers.parseEther("0.001"),
    data: "0x",
  });
  
  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("Transaction confirmed!");
  
  // Example: Sign a message
  console.log("\nSigning message...");
  console.log("Please approve the message signing on your Ledger device");
  
  const message = "Hello from Hardhat with Ledger!";
  const signature = await ledgerSigner.signMessage(message);
  console.log("Message signed:", signature);
  
  // Verify signature
  const recoveredAddress = ethers.verifyMessage(message, signature);
  console.log("Recovered address:", recoveredAddress);
  console.log("Signature valid:", recoveredAddress === await ledgerSigner.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });