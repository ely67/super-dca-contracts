import { ethers } from "hardhat";
import { Constants } from "../../misc/Constants"

async function main() {

    // Get the right constants for the network we are deploying on
    const config = Constants['base_sepolia'];

    // Get the deployer for this deployment, first hardhat signer
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Get the input/output token addresses from the environment
    const INPUT_TOKEN = process.env.INPUT_TOKEN;
    const INPUT_TOKEN_UNDERLYING = process.env.INPUT_TOKEN_UNDERLYING;
    const OUTPUT_TOKEN = process.env.OUTPUT_TOKEN;
    const OUTPUT_TOKEN_UNDERLYING = process.env.OUTPUT_TOKEN_UNDERLYING;
    const PRICE_FEED = process.env.PRICE_FEED || "0x0000000000000000000000000000000000000000";
    const UNISWAP_POOL_FEE = process.env.UNISWAP_POOL_FEE;

    // Log all the config values for the network we are initialize on this pool

    const initParams = {
        host: config.HOST_SUPERFLUID_ADDRESS,
        cfa: config.CFA_SUPERFLUID_ADDRESS,
        ida: config.IDA_SUPERFLUID_ADDRESS,
        weth: config.WETH_ADDRESS,
        wethx: config.WETHX_ADDRESS,
        inputToken: INPUT_TOKEN,
        outputToken: OUTPUT_TOKEN,
        router: config.UNISWAP_V3_ROUTER_ADDRESS,
        uniswapFactory: config.UNISWAP_V3_FACTORY_ADDRESS,
        uniswapPath: [INPUT_TOKEN_UNDERLYING, config.DCA_ADDRESS, OUTPUT_TOKEN_UNDERLYING],
        poolFees: [500, 500],
        priceFeed: PRICE_FEED,
        invertPrice: false,
        registrationKey: config.SF_REG_KEY,
        ops: config.GELATO_OPS,
    }

    console.log("initParams", initParams);
    // Prompt the user to continue after checking the config
    console.log("Verify these parameters. Then press any key to continue the deployment...");
    await new Promise(resolve => process.stdin.once("data", resolve));

    // Deploy SuperDCAPoolV1
    console.log("Deploying SuperDCAPoolV1")
    const SuperDCAPoolV1 = await ethers.getContractFactory("SuperDCAPoolV1");
    const pool = await SuperDCAPoolV1.deploy(
        config.GELATO_OPS,
        { gasLimit: 10000000 } // Force deploy even if estimate gas fails
    );
    await pool.deployed();
    console.log("SuperDCAPoolV1 deployed to:", pool.address);

    // Initialize WMATIC and MATICx
    let tx: any;
    tx = await pool.initialize(initParams, { gasLimit: 10000000 });
    await tx.wait();
    console.log("Initialized Pool", tx.hash);

    // Save the artifacts to tenderly for further inspection, monitoring, and debugging
    await hre.tenderly.persistArtifacts({
        name: "SuperDCAPoolV1",
        address: pool.address,
    });

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
