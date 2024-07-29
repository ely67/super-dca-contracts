import { ethers } from "hardhat";
import { parseUnits } from "@ethersproject/units";

import { setup, IUser, ISuperToken } from "./setup";
import { impersonateAccounts } from "./helpers";
import { type } from "os";
import { constants } from "buffer";
const { defaultAbiCoder, keccak256 } = require("ethers/lib/utils");

const { web3tx, wad4human } = require("@decentral.ee/web3-helpers");
const SuperfluidGovernanceBase = require("../test/artifacts/superfluid/SuperfluidGovernanceII.json");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";


export const common = async () => {
    const { superfluid, users, tokens, superTokens, contracts } = await setup();

    const appBalances: { [key: string]: string[] } = {
        ethx: [],
        wbtcx: [],
        daix: [],
        usdcx: [],
    };
    const ownerBalances: { [key: string]: string[] } = {
        ethx: [],
        wbtcx: [],
        daix: [],
        usdcx: [],
    };
    const aliceBalances: { [key: string]: string[] } = {
        ethx: [],
        wbtcx: [],
        daix: [],
        usdcx: [],
    };
    const bobBalances: { [key: string]: string[] } = {
        ethx: [],
        wbtcx: [],
        daix: [],
        usdcx: [],
    };

    const hostABI = [
        "function getGovernance() external view returns (address)",
        "function getSuperTokenFactory() external view returns(address)",
    ];

    async function checkBalance(users: any) {
        for (let i = 0; i < users.length; ++i) {
            console.log("Balance of ", users[i].alias);
            console.log(
                "usdcx: ",
                (await superTokens.usdcx.balanceOf(users[i].address)).toString()
            );
            console.log(
                "wbtcx: ",
                (await superTokens.wbtcx.balanceOf(users[i].address)).toString()
            );
        }
    }

    async function upgrade(accounts: any) {
        for (let i = 0; i < accounts.length; ++i) {
            await web3tx(
                superTokens.usdcx.upgrade,
                `${accounts[i].alias} upgrades many USDCx`
            )(parseUnits("100000000", 18), {
                from: accounts[i].address,
            });
            await web3tx(
                superTokens.daix.upgrade,
                `${accounts[i].alias} upgrades many DAIx`
            )(parseUnits("100000000", 18), {
                from: accounts[i].address,
            });

            await checkBalance(accounts[i]);
        }
    }

    async function logUsers() {
        let string = "user\t\ttokens\t\tnetflow\n";
        let p = 0;
        for (const [, user] of Object.entries(users)) {
            if (await hasFlows(user)) {
                p++;
                string += `${user.alias}\t\t${wad4human(
                    await superTokens.usdcx.balanceOf(user.address as any)
                )}\t\t${wad4human((await (user as any).details()).cfa.netFlow)}
            `;
            }
        }
        if (p == 0) return console.warn("no users with flows");
        console.log("User logs:");
        console.log(string);
    }

    async function hasFlows(user: any) {
        const { inFlows, outFlows } = (await user.details()).cfa.flows;
        return inFlows.length + outFlows.length > 0;
    }

    async function approveSubscriptions(
        userss: any,
        tokenss: any,
        app: any
    ) {
        // Do approvals
        // Already approved?
        console.log('Approving subscriptions...');
        for (let tokenIndex = 0; tokenIndex < tokenss.length; tokenIndex += 1) {
            for (let userIndex = 0; userIndex < userss.length; userIndex += 1) {
                let index = 0;

                await web3tx(
                    superfluid.host.hostContract.callAgreement,
                    `${users[userIndex]} approves subscription to the app ${tokens[tokenIndex]} ${index}`,
                )(
                    sf.agreements.ida.address,
                    sf.agreements.ida.contract.methods
                        .approveSubscription(tokens[tokenIndex], app.address, tokenIndex, '0x')
                        .encodeABI(),
                    '0x', // user data
                    {
                        from: users[userIndex],
                    },
                );
            }
        }
        console.log('Approved.');
    }

    const createSFRegistrationKey = async (sf: any, deployerAddr: any) => {
        // export async function createSFRegistrationKey(sf: any, deployerAddr: any) {
        const host = await ethers.getContractAt(
            hostABI,
            sf.settings.config.hostAddress
        );
        const registrationKey = `testKey-${Date.now()}`;

        const encodedKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string"],
                [
                    "org.superfluid-finance.superfluid.appWhiteListing.registrationKey",
                    deployerAddr,
                    registrationKey,
                ]
            )
        ); 
        const governance: string = await host.getGovernance();
        const sfGovernanceRO = await ethers.getContractAt(
            SuperfluidGovernanceBase.abi,
            governance
        );
        const govOwner = await sfGovernanceRO.owner();
        const [govOwnerSigner] = await impersonateAccounts([govOwner]);
        const sfGovernance = await ethers.getContractAt(
            SuperfluidGovernanceBase.abi,
            governance,
            govOwnerSigner
        );

        let expirationTs = Math.floor(Date.now() / 1000) + 3600 * 24 * 90; // 90 days from now

        //console.log("sf governance", sfGovernance.whiteListNewApp);
        await sfGovernance.setConfig(
            sf.settings.config.hostAddress,
            ZERO_ADDRESS,
            encodedKey,
            expirationTs
        );

        return registrationKey;
    }

    return { createSFRegistrationKey };
};
