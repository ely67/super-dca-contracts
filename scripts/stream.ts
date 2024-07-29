import { Framework } from "@superfluid-finance/sdk-core";
import { ethers } from "hardhat";
import { Constants } from "../misc/Constants"

const SUPERDCA_POOL_ADDRESS = "0x4507d2B91736A615131A28c3DCcDEb66E975FA97"

async function main() {

    // Get the right constants for the network we are deploying on
    const config = Constants['optimism'];

    // Get the deployer for this deployment, first hardhat signer
    const [deployer] = await ethers.getSigners();

    const sf = await Framework.create({
        provider: ethers.provider,
        networkName: "optimism",
        chainId: 10
    });

    const usdcx = await sf.loadSuperToken(config.USDCX_ADDRESS);

    const createFlowOperation = usdcx.createFlow({
        sender: deployer.address, // Replace with the sender's address
        receiver: SUPERDCA_POOL_ADDRESS, // Replace with the receiver's address
        flowRate: "317097919837645" // 10K per year
    });

    const txnResponse = await createFlowOperation.exec(deployer);
    const txnReceipt = await txnResponse.wait();

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
