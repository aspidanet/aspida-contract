import { deployments, getNamedAccounts, getChainId, ethers } from "hardhat";

import { network, deployInfo } from "./config/config";

async function main() {
    const chainId = await getChainId();
    const corePrimaryInfo: any = deployInfo[network[chainId]].CorePrimary;

    let deploymentsAll = await deployments.all();
    const corePrimaryContract = await ethers.getContractFactory("CorePrimary");
    const CorePrimary = corePrimaryContract.attach(deploymentsAll.CorePrimary.address);

    const owner = await CorePrimary.owner();
    const deployer = (await getNamedAccounts()).deployer;
    const sendStatus = owner == deployer;

    if (deploymentsAll.RewardOracle.address != (await CorePrimary.rewardOracle())) {
        console.log(`set rewardOracle\n`);
        if (sendStatus) {
            await CorePrimary._setRewardOracle(deploymentsAll.RewardOracle.address);
        } else {
            const data = CorePrimary.interface.encodeFunctionData("_setRewardOracle", [
                deploymentsAll.RewardOracle.address,
            ]);
            console.log(`target address: \n${CorePrimary.address}\n`);
            console.log(`transaction data: \n${data}\n\n`);
        }
    }

    const reserveRatio = ethers.utils.parseEther(corePrimaryInfo.reserveRatio);
    if (!reserveRatio.eq(await CorePrimary.reserveRatio())) {
        console.log(`set reserveRatio\n`);
        if (sendStatus) {
            await CorePrimary._setReserveRatio(reserveRatio);
        } else {
            const data = CorePrimary.interface.encodeFunctionData("_setReserveRatio", [reserveRatio]);
            console.log(`target address: \n${CorePrimary.address}\n`);
            console.log(`transaction data: \n${data}\n\n`);
        }
    }

    const treasuryRatio = ethers.utils.parseEther(corePrimaryInfo.treasuryRatio);
    if (!treasuryRatio.eq(await CorePrimary.treasuryRatio())) {
        console.log(`set treasuryRatio\n`);
        if (sendStatus) {
            await CorePrimary._setTreasuryRatio(treasuryRatio);
        } else {
            const data = CorePrimary.interface.encodeFunctionData("_setTreasuryRatio", [treasuryRatio]);
            console.log(`target address: \n${CorePrimary.address}\n`);
            console.log(`transaction data: \n${data}\n\n`);
        }
    }

    const actionControl = corePrimaryInfo.actionControl;
    await Promise.all(
        Object.keys(actionControl).map(async (action) => {
            const actionId = actionControl[action].actionId;
            const actionData = await CorePrimary.actionData(actionId);
            const actionLimit = ethers.utils.parseEther(actionControl[action].limit);

            if (!actionData.limit.eq(actionLimit)) {
                console.log(`set action limit: ${action}\n`);
                if (sendStatus) {
                    await CorePrimary._setActionLimit(actionId, actionLimit);
                } else {
                    const data = CorePrimary.interface.encodeFunctionData("_setActionLimit", [actionId, actionLimit]);
                    console.log(`target address: \n${CorePrimary.address}\n`);
                    console.log(`transaction data: \n${data}\n\n`);
                }
            }

            const actionThreshold = ethers.utils.parseEther(actionControl[action].threshold);
            if (!actionData.threshold.eq(actionThreshold)) {
                console.log(`set action threshold: ${action}\n`);
                if (sendStatus) {
                    await CorePrimary._setActionThreshold(actionId, actionThreshold);
                } else {
                    const data = CorePrimary.interface.encodeFunctionData("_setActionThreshold", [
                        actionId,
                        actionThreshold,
                    ]);
                    console.log(`target address: \n${CorePrimary.address}\n`);
                    console.log(`transaction data: \n${data}\n\n`);
                }
            }
        })
    );

    const managers = Array.from(new Set(corePrimaryInfo.managers));
    const currentManagers = await CorePrimary.managers();
    await Promise.all(
        managers.map(async (manager) => {
            if (!currentManagers.includes(manager as string)) {
                console.log(`CorePrimary addManager: ${manager}\n`);
                if (sendStatus) {
                    await CorePrimary._addManager(manager as string);
                    return;
                }

                const data = CorePrimary.interface.encodeFunctionData("_addManager", [manager]);
                console.log(`target address: \n${CorePrimary.address}\n`);
                console.log(`transaction data: \n${data}\n\n`);
            }
        })
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
