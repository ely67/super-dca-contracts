import { waffle, ethers } from "hardhat";
import { impersonateAccounts } from "./helpers";
import { Framework, SuperToken } from "@superfluid-finance/sdk-core";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Constants } from "./Constants";
import * as dotenv from "dotenv";

const { provider, loadFixture } = waffle;

// NOTE: It is essential to pass in a Deployer into the contracts for initialization
// This is because when we are testing the emit, the passed in contract expects a
// provider and will throw an error if this doesn't exist.

dotenv.config();
const CONSTANTS = Constants['polygon'];

const ETHX_ADDRESS = "";
const USDCX_ADDRESS = "";
const WBTCX_ADDRESS = "";
const DAIX_ADDRESS = ""

const PROVIDER = provider;

export interface ISuperToken {
  ethx: SuperToken;
  usdcx: SuperToken;
  wbtcx: SuperToken;
  daix: SuperToken;
  maticx: SuperToken;
  ibAlluoUSD: SuperToken;
  ibAlluoETH: SuperToken;
}

export interface IUser {
  address: string;
  token: string;
  options?: any;
  alias?: string;
}

export const setup = async () => {
  const users: { [key: string]: IUser } = {};
  let tokens: { [key: string]: any } = {};  // TypesOfTokens

  const contracts: any = {};
  const constants = Constants['polygon'];
  const accountAddrs = [
    CONSTANTS.OWNER_ADDRESS,
    CONSTANTS.ALICE_ADDRESS,
    CONSTANTS.BOB_ADDRESS,
    CONSTANTS.CARL_ADDRESS,
    CONSTANTS.KAREN_ADDRESS,
    CONSTANTS.USDCX_SOURCE_ADDRESS,
    CONSTANTS.ETHX_SOURCE_ADDRESS,
    CONSTANTS.MATICX_SOURCE_ADDRESS,
    CONSTANTS.IBALLUOUSD_SOURCE_ADDRESS,
    CONSTANTS.IBALLUOETH_SOURCE_ADDRESS,
    // CONSTANTS.DCA_SOURCE_ADDRESS,
    CONSTANTS.SF_RESOLVER,
  ];

  const accounts: SignerWithAddress[] = await impersonateAccounts(accountAddrs);
  const names = ["admin", "alice", "bob", "carl", "karen", "usdcxspender", "ethxspender", "maticxspender", "ibAlluoUSDspender", "ibAlluoETHspender"];

  // Initialize superfluid sdk
  const superfluid = await Framework.create({
    provider: ethers.provider,  //   PROVIDER,  // ethers.getDefaultProvider(),
    resolverAddress: CONSTANTS.SF_RESOLVER,
    networkName: "hardhat",
    dataMode: "WEB3_ONLY",
    protocolReleaseVersion: "v1",
    chainId: 31337
  });

  // Declare supertokens as ERC 20 contracts
  const superTokens: ISuperToken = {
    maticx: await superfluid.loadSuperToken(
      "0x3aD736904E9e65189c3000c7DD2c8AC8bB7cD4e3"
    ),
    ethx: await superfluid.loadSuperToken(
      "0x27e1e4E6BC79D93032abef01025811B7E4727e85"
    ),
    usdcx: await superfluid.loadSuperToken(
      "0xCAa7349CEA390F89641fe306D93591f87595dc1F"
    ),
    wbtcx: await superfluid.loadSuperToken(
      "0x4086eBf75233e8492F1BCDa41C7f2A8288c2fB92"
    ),
    daix: await superfluid.loadSuperToken(
      "0x1305f6b6df9dc47159d12eb7ac2804d4a33173c2"
    ),
    stIbAlluoUSD: await superfluid.loadSuperToken(
      "0xE9E759B969B991F2bFae84308385405B9Ab01541"
    ),
    stIbAlluoETH: await superfluid.loadSuperToken(
      "0x2D4Dc956FBd0044a4EBA945e8bbaf98a14025C2d"
    ),
    // ibAlluoUSD: await ethers.getContractAt(
    //   "IbAlluo", "0xC2DbaAEA2EfA47EBda3E572aa0e55B742E408BF6"
    // ),
    // ibAlluoETH: await ethers.getContractAt(
    //   "IbAlluo", "0xc677B0918a96ad258A68785C2a3955428DeA7e50"
    // ),
  };


  // Declare all users for transactions (usdcx)
  for (let i = 0; i < names.length; i += 1) {
    users[names[i]] = {
      address: accounts[i].address,
      token: superTokens.usdcx.address,
      alias: names[i],
    };
  }

  // console.log(superTokens.ethx)
  // Declare ERC 20 tokens
  tokens.weth = await ethers.getContractAt(
    "ERC20",
    CONSTANTS.ETH_ADDRESS
  );
  tokens.wbtc = await ethers.getContractAt(
    "ERC20",
    await superTokens.wbtcx.underlyingToken.address
  );
  tokens.usdc = await ethers.getContractAt(
    "ERC20",
    await superTokens.usdcx.underlyingToken.address
  );
  tokens.maticx = await ethers.getContractAt(
    "ERC20",
    await superTokens.maticx.underlyingToken.address
  );
  tokens.ibAlluoUSD = await ethers.getContractAt(
    "ERC20",
    await superTokens.stIbAlluoUSD.underlyingToken.address
  );
  tokens.ibAlluoETH = await ethers.getContractAt(
    "ERC20",
    await superTokens.stIbAlluoETH.underlyingToken.address
  );

  return {
    superfluid,
    users,
    accounts,
    tokens,
    superTokens,
    contracts,
    constants,
  };
};
