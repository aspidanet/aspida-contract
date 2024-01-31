import { deployments, getNamedAccounts, getChainId, ethers } from "hardhat";

import { sendTransaction } from "./utils/utils";

import { network, deployInfo } from "./config/config";

async function main() {
    const chainId = await getChainId();

    const deploymentsAll = await deployments.all();
    const RewardOracle = await ethers.getContractAt("RewardOracle", deploymentsAll.RewardOracle.address);

    const owner = await RewardOracle.owner();
    const deployer = (await getNamedAccounts()).deployer;
    const send = owner == deployer;

    const SECONDS_PER_SLOT = ethers.utils.parseUnits("12", "wei");
    const SLOT_PER_EPOCH = ethers.utils.parseUnits("32", "wei");
    const EPOCH_PER_YEAR = ethers.utils.parseUnits("31536000", "wei").div(SECONDS_PER_SLOT.mul(SLOT_PER_EPOCH)); // 3600 * 24 * 365

    const rewardOracleInfo = deployInfo[network[chainId]].RewardOracle;

    const annualInterestRateCap = ethers.utils.parseEther(rewardOracleInfo.annualInterestRateCap);
    const interestRateLimitPerEpoch = annualInterestRateCap.div(EPOCH_PER_YEAR);
    if (!interestRateLimitPerEpoch.eq(await RewardOracle.interestRateLimitPerEpoch())) {
        console.log(`set interestRateLimitPerEpoch\n`);
        await sendTransaction(RewardOracle, "_setInterestRateLimitPerEpoch", [annualInterestRateCap], send);
    }

    const validatorLimitPerEpoch = ethers.utils.parseUnits(rewardOracleInfo.validatorLimitPerEpoch, 0);
    if (!validatorLimitPerEpoch.eq(await RewardOracle.validatorLimitPerEpoch())) {
        console.log(`set validatorLimitPerEpoch\n`);
        await sendTransaction(RewardOracle, "_setValidatorLimitPerEpoch", [validatorLimitPerEpoch], send);
    }

    const managers = rewardOracleInfo.managers;
    const currentManagers = await RewardOracle.managers();
    await Promise.all(
        managers.map(async (manager: string) => {
            if (!currentManagers.includes(manager)) {
                console.log(`RewardOracle addManager: ${manager}\n`);
                await sendTransaction(RewardOracle, "_addManager", [manager], send);
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
