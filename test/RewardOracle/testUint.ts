import { ethers } from "hardhat";
import { Signer, Contract, BigNumber, utils } from "ethers";
import { expect } from "chai";

import { fixtureDefault } from "../utils/fixtures";
import { MAX, ZERO, ONE, TWO, NegativeOne, Ether, AddressZero, AbiCoder } from "../utils/constants";
import { getCurrentTime, mineManually } from "../utils/helper";

const SECONDS_PER_SLOT = ethers.utils.parseUnits("12", "wei");
const SLOT_PER_EPOCH = ethers.utils.parseUnits("32", "wei");
const EPOCH_PER_YEAR = ethers.utils.parseUnits("31536000", "wei").div(SECONDS_PER_SLOT.mul(SLOT_PER_EPOCH)); // 3600 * 24 * 365
const EPOCH_INTEREST_RATE_MAX = Ether.div(EPOCH_PER_YEAR);
const DEPOSIT_SIZE = ethers.utils.parseEther("32");

describe("Test RewardOracle unit test", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let aETH: Contract;
    let saETH: Contract;
    let RewardOracle: Contract;

    async function init() {
        const initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        aETH = initData.aETH;
        saETH = initData.saETH;
        RewardOracle = initData.RewardOracle;
    }

    async function forward(epochId: BigNumber) {
        const epochIdTimestamp = epochId
            .mul(SECONDS_PER_SLOT)
            .mul(SLOT_PER_EPOCH)
            .add(await RewardOracle.zeroEpochTimestamp());
        const timestamp = utils.parseUnits((await getCurrentTime()).toString(), 0);
        if (epochIdTimestamp.gt(timestamp)) {
            const increaseTime = epochIdTimestamp.sub(timestamp);
            await mineManually(1, Number(increaseTime.toString()));
        }
    }

    async function calculateEpochCount(epochId: BigNumber) {
        const lastEpochId = await RewardOracle.lastEpochId();
        let epochCount = ZERO;
        if (epochId.gt(lastEpochId)) epochCount = epochId.sub(lastEpochId);

        return epochCount;
    }

    function calculateEpochInterestRate(
        epochCount: BigNumber,
        activatedValidatorCount: BigNumber,
        rewardIncrement: BigNumber
    ) {
        const _principal = epochCount.mul(activatedValidatorCount).mul(DEPOSIT_SIZE);
        return rewardIncrement.mul(Ether).add(_principal.sub(ONE)).div(_principal);
    }

    async function calculateMaxRewardIncrement(epochCount: BigNumber, activatedValidatorCount: BigNumber) {
        const interestRateLimitPerEpoch = await RewardOracle.interestRateLimitPerEpoch();
        return interestRateLimitPerEpoch.mul(epochCount.mul(activatedValidatorCount).mul(DEPOSIT_SIZE)).div(Ether);
    }

    async function calculateMaxValidatorCount(epochCount: BigNumber) {
        const validatorLimitPerEpoch = await RewardOracle.validatorLimitPerEpoch();
        const lastActivatedValidatorCount = await RewardOracle.lastActivatedValidatorCount();
        return validatorLimitPerEpoch.mul(epochCount).add(lastActivatedValidatorCount);
    }

    async function calculateIncreaseValidatorsPerEpoch(activatedValidatorCount: BigNumber) {
        const lastActivatedValidatorCount = await RewardOracle.lastActivatedValidatorCount();
        if (activatedValidatorCount.gt(lastActivatedValidatorCount))
            return activatedValidatorCount.sub(lastActivatedValidatorCount);
        return ZERO;
    }

    // async function checkSubmitData(epochId: BigNumber, activatedValidatorCount: BigNumber, rewardIncrement: BigNumber) {
    //     // let status = true;
    //     // let message = "";
    //     if (activatedValidatorCount.eq(ZERO))
    //         return { status: false, message: "_updateEpochReward: Active validators must not be 0" };

    //     const epochCount = await calculateEpochCount(epochId);
    //     if (epochCount.eq(ZERO)) return { status: false, message: "_updateEpochReward: Epoch id must increase" };
    // }

    before(async function () {
        await init();
        await RewardOracle._addManager(await owner.getAddress());
        await RewardOracle._setValidatorLimitPerEpoch(ethers.utils.parseUnits("265", "wei"));
    });

    it("test submitEpochReward: activatedValidatorCount = 0, expected revert", async () => {
        const startEpochId = await RewardOracle.lastEpochId();
        const epochId = startEpochId.add(ONE);
        const activatedValidatorCount = ZERO;
        const rewardIncrement = Ether;

        await expect(
            RewardOracle.submitEpochReward(startEpochId, epochId, activatedValidatorCount, rewardIncrement)
        ).to.be.revertedWith("_updateEpochReward: Active validators must not be 0");
    });

    it("test submitEpochReward: epochId = lastEpochId, expected revert", async () => {
        const startEpochId = await RewardOracle.lastEpochId();
        const epochId = startEpochId;
        const activatedValidatorCount = ONE;
        const rewardIncrement = Ether;

        await expect(
            RewardOracle.submitEpochReward(startEpochId, epochId, activatedValidatorCount, rewardIncrement)
        ).to.be.revertedWith("_updateEpochReward: Epoch id must increase");
    });

    it("test submitEpochReward: epochId > currentEpochId, expected revert", async () => {
        const currentEpochId = await RewardOracle.currentEpochId();
        const startEpochId = await RewardOracle.lastEpochId();
        const epochId = currentEpochId.add(ONE);
        const activatedValidatorCount = ONE;
        const rewardIncrement = Ether;

        await expect(
            RewardOracle.submitEpochReward(startEpochId, epochId, activatedValidatorCount, rewardIncrement)
        ).to.be.revertedWith("_updateEpochReward: Invalid epoch id");
    });

    it("test submitEpochReward: Interest rate per epoch exceeds cap, expected revert", async () => {
        const startEpochId = await RewardOracle.lastEpochId();
        const epochId = startEpochId.add(ONE);
        const activatedValidatorCount = ONE;

        const epochCount = await calculateEpochCount(epochId);
        const maxRewardIncrement = await calculateMaxRewardIncrement(epochCount, activatedValidatorCount);
        const rewardIncrement = maxRewardIncrement.add(ONE);

        await forward(epochId);
        await expect(
            RewardOracle.submitEpochReward(startEpochId, epochId, activatedValidatorCount, rewardIncrement)
        ).to.be.revertedWith("_updateEpochReward: Invalid epoch interest rate");
    });

    it("test submitEpochReward: Validator exceeds cap per epoch, expected revert", async () => {
        const startEpochId = await RewardOracle.lastEpochId();
        const epochId = startEpochId.add(ONE);

        const epochCount = await calculateEpochCount(epochId);

        const maxValidatorCount = await calculateMaxValidatorCount(epochCount);
        const activatedValidatorCount = maxValidatorCount.add(ONE);

        const maxRewardIncrement = await calculateMaxRewardIncrement(epochCount, activatedValidatorCount);
        const rewardIncrement = maxRewardIncrement;

        await forward(epochId);
        await expect(
            RewardOracle.submitEpochReward(startEpochId, epochId, activatedValidatorCount, rewardIncrement)
        ).to.be.revertedWith("_updateEpochReward: Validator out of increment per epoch");
    });

    it("test submitEpochReward: All conditions are threshold, success", async () => {
        const startEpochId = await RewardOracle.lastEpochId();
        const epochId = startEpochId.add(ONE);

        const epochCount = await calculateEpochCount(epochId);

        const maxValidatorCount = await calculateMaxValidatorCount(epochCount);
        const activatedValidatorCount = maxValidatorCount;

        const maxRewardIncrement = await calculateMaxRewardIncrement(epochCount, activatedValidatorCount);
        const rewardIncrement = maxRewardIncrement;

        const beforeTotalSupply = await aETH.totalSupply();

        await forward(epochId);
        await expect(
            RewardOracle.submitEpochReward(startEpochId, epochId, activatedValidatorCount, rewardIncrement)
        ).changeTokenBalances(aETH, [saETH.address], [rewardIncrement]);

        expect(beforeTotalSupply.add(rewardIncrement)).to.be.equal(await aETH.totalSupply());
    });

    it("test submitEpochReward: The parameters satisfy the conditions, validatorCount constant, success", async () => {
        const startEpochId = await RewardOracle.lastEpochId();
        const epochId = startEpochId.add(ONE);

        const epochCount = await calculateEpochCount(epochId);

        const lastActivatedValidatorCount = await RewardOracle.lastActivatedValidatorCount();
        const activatedValidatorCount = lastActivatedValidatorCount;

        const maxRewardIncrement = await calculateMaxRewardIncrement(epochCount, activatedValidatorCount);
        const rewardIncrement = maxRewardIncrement;

        const beforeTotalSupply = await aETH.totalSupply();

        await forward(epochId);
        await expect(
            RewardOracle.submitEpochReward(startEpochId, epochId, activatedValidatorCount, rewardIncrement)
        ).changeTokenBalances(aETH, [saETH.address], [rewardIncrement]);

        expect(beforeTotalSupply.add(rewardIncrement)).to.be.equal(await aETH.totalSupply());
    });

    it("test submitEpochReward: The parameters satisfy the conditions, validatorCount decrease, success", async () => {
        const startEpochId = await RewardOracle.lastEpochId();
        const epochId = startEpochId.add(ONE);

        const epochCount = await calculateEpochCount(epochId);

        const lastActivatedValidatorCount = await RewardOracle.lastActivatedValidatorCount();
        const activatedValidatorCount = lastActivatedValidatorCount.sub(ONE);

        const maxRewardIncrement = await calculateMaxRewardIncrement(epochCount, activatedValidatorCount);
        const rewardIncrement = maxRewardIncrement;

        const beforeTotalSupply = await aETH.totalSupply();

        await forward(epochId);
        await expect(
            RewardOracle.submitEpochReward(startEpochId, epochId, activatedValidatorCount, rewardIncrement)
        ).changeTokenBalances(aETH, [saETH.address], [rewardIncrement]);

        expect(beforeTotalSupply.add(rewardIncrement)).to.be.equal(await aETH.totalSupply());
    });

    it("test submitEpochReward: The parameters satisfy the conditions, rewardIncrement = 0, expected revert", async () => {
        const startEpochId = await RewardOracle.lastEpochId();
        const epochId = startEpochId.add(ONE);

        const epochCount = await calculateEpochCount(epochId);

        const maxValidatorCount = await calculateMaxValidatorCount(epochCount);
        const activatedValidatorCount = maxValidatorCount;

        const rewardIncrement = ZERO;

        await forward(epochId);
        await expect(
            RewardOracle.submitEpochReward(startEpochId, epochId, activatedValidatorCount, rewardIncrement)
        ).to.be.revertedWith("supplyReward: Amount cannot be 0");
    });

    it("test submitEpochReward: startEpochId != lastEpochId, expected revert", async () => {
        const startEpochId = (await RewardOracle.lastEpochId()).add(ONE);
        const epochId = startEpochId.add(ONE);

        const epochCount = await calculateEpochCount(epochId);

        const lastActivatedValidatorCount = await RewardOracle.lastActivatedValidatorCount();
        const activatedValidatorCount = lastActivatedValidatorCount;

        const maxRewardIncrement = await calculateMaxRewardIncrement(epochCount, activatedValidatorCount);
        const rewardIncrement = maxRewardIncrement;

        await forward(epochId);
        await expect(
            RewardOracle.submitEpochReward(startEpochId, epochId, activatedValidatorCount, rewardIncrement)
        ).to.be.revertedWith("_updateEpochReward: Start epoch id must equal last epoch id");
    });
});
