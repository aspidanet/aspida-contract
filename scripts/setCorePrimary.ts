import { deployments, getNamedAccounts, getChainId, ethers } from "hardhat";

import { sendTransaction } from "./utils/utils";

import { network, deployInfo } from "./config/config";

async function main() {
    const chainId = await getChainId();
    const corePrimaryInfo: any = deployInfo[network[chainId]].CorePrimary;

    const deploymentsAll = await deployments.all();
    const CorePrimary = await ethers.getContractAt("CorePrimary", deploymentsAll.CorePrimary.address);

    const owner = await CorePrimary.owner();
    const deployer = (await getNamedAccounts()).deployer;
    const send = owner == deployer;

    if (deploymentsAll.RewardOracle.address != (await CorePrimary.rewardOracle())) {
        console.log(`set rewardOracle\n`);
        await sendTransaction(CorePrimary, "_setRewardOracle", [deploymentsAll.RewardOracle.address], send);
    }

    const reserveRatio = ethers.utils.parseEther(corePrimaryInfo.reserveRatio);
    if (!reserveRatio.eq(await CorePrimary.reserveRatio())) {
        console.log(`set reserveRatio\n`);
        await sendTransaction(CorePrimary, "_setReserveRatio", [reserveRatio], send);
    }

    const treasuryRatio = ethers.utils.parseEther(corePrimaryInfo.treasuryRatio);
    if (!treasuryRatio.eq(await CorePrimary.treasuryRatio())) {
        console.log(`set treasuryRatio\n`);
        await sendTransaction(CorePrimary, "_setTreasuryRatio", [treasuryRatio], send);
    }

    const managers = Array.from(new Set(corePrimaryInfo.managers));
    const currentManagers = await CorePrimary.managers();
    await Promise.all(
        managers.map(async (manager) => {
            if (!currentManagers.includes(manager as string)) {
                console.log(`CorePrimary addManager: ${manager}\n`);
                await sendTransaction(CorePrimary, "_addManager", [manager], send);
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
