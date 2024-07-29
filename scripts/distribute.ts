import { ethers } from "hardhat";

const POOL_ADDRESS = "0x981Ac6F25F28dCB47DB1708A60881C76fe64D84E";

async function main() {

  const SuperDCAPoolV1 = await ethers.getContractFactory("SuperDCAPoolV1");
  const pool = await SuperDCAPoolV1.attach(POOL_ADDRESS);

  const [deployer] = await ethers.getSigners();

  console.log("Address:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  console.log('Distributing...');
  let tx = await pool.distribute("0x", true, {gasLimit: 10000000});
  console.log(tx)
  console.log('Distributed');

}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
