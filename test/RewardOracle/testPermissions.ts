import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";
import { expect } from "chai";

import { fixtureDefault } from "../utils/fixtures";
import { MAX, ZERO, ONE, TWO, NegativeOne, Ether, AddressZero, AbiCoder } from "../utils/constants";

const SECONDS_PER_SLOT = ethers.utils.parseUnits("12", "wei");
const SLOT_PER_EPOCH = ethers.utils.parseUnits("32", "wei");
const EPOCH_PER_YEAR = ethers.utils.parseUnits("31536000", "wei").div(SECONDS_PER_SLOT.mul(SLOT_PER_EPOCH)); // 3600 * 24 * 365
const EPOCH_INTEREST_RATE_MAX = Ether.div(EPOCH_PER_YEAR);

describe("Test RewardOracle permissions", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let DepositContract: Contract;
    let dETH: Contract;
    let sdETH: Contract;
    let CorePrimary: Contract;
    let RewardOracle: Contract;

    async function init() {
        ({ owner, manager, pauseGuardian, accounts, DepositContract, dETH, sdETH, CorePrimary, RewardOracle } =
            await fixtureDefault());
    }

    before(async function () {
        await init();
    });

    it("test initialize: Already initialized, expected revert", async () => {
        await expect(RewardOracle.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("test _close: Not pause guardian, expected revert", async () => {
        const sender = accounts[1];
        expect(await RewardOracle.isPauseGuardian(await sender.getAddress())).to.be.equal(false);

        await expect(RewardOracle.connect(sender)._close()).to.be.revertedWith(
            "onlyPauseGuardian: caller is not pauseGuardian"
        );
    });

    it("test _close: is the pause guardian, success", async () => {
        const sender = pauseGuardian;
        expect(await RewardOracle.isPauseGuardian(await sender.getAddress())).to.be.equal(true);

        await RewardOracle.connect(sender)._close();

        expect(await RewardOracle.paused()).to.be.equal(true);
    });

    it("test _open: Not owner, expected revert", async () => {
        const sender = pauseGuardian;

        await expect(RewardOracle.connect(sender)._open()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("test _open: is owner, success", async () => {
        const sender = owner;

        await RewardOracle.connect(sender)._open();

        expect(await RewardOracle.paused()).to.be.equal(false);
    });

    it("test _addPauseGuardian: Not owner, expected revert", async () => {
        const sender = manager;
        const newPauseGuardian = await accounts[0].getAddress();
        expect(await RewardOracle.isPauseGuardian(newPauseGuardian)).to.be.equal(false);

        await expect(RewardOracle.connect(sender)._addPauseGuardian(newPauseGuardian)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _addPauseGuardian: is owner, success", async () => {
        const sender = owner;
        const newPauseGuardian = await accounts[0].getAddress();
        const pauseGuardians = await RewardOracle.pauseGuardians();
        expect(pauseGuardians.includes(newPauseGuardian)).to.be.equal(false);

        await RewardOracle.connect(sender)._addPauseGuardian(newPauseGuardian);
        expect(await RewardOracle.isPauseGuardian(newPauseGuardian)).to.be.equal(true);
    });

    it("test _removePauseGuardian: Not owner, expected revert", async () => {
        const sender = pauseGuardian;
        const pauseGuardianAddr = await accounts[0].getAddress();
        expect(await RewardOracle.isPauseGuardian(pauseGuardianAddr)).to.be.equal(true);

        await expect(RewardOracle.connect(sender)._removePauseGuardian(pauseGuardianAddr)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _removePauseGuardian: is owner, success", async () => {
        const sender = owner;
        const newPauseGuardian = await accounts[0].getAddress();
        expect(await RewardOracle.isPauseGuardian(newPauseGuardian)).to.be.equal(true);

        await RewardOracle.connect(sender)._removePauseGuardian(newPauseGuardian);
        expect(await RewardOracle.isPauseGuardian(newPauseGuardian)).to.be.equal(false);
    });

    it("test _addManager: Not owner, expected revert", async () => {
        const sender = manager;
        const newManager = await accounts[0].getAddress();
        expect(await RewardOracle.isManager(newManager)).to.be.equal(false);

        await expect(RewardOracle.connect(sender)._addManager(newManager)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _addManager: is owner, success", async () => {
        const sender = owner;
        const newManager = await accounts[0].getAddress();
        expect(await RewardOracle.isManager(newManager)).to.be.equal(false);

        await RewardOracle.connect(sender)._addManager(newManager);
        expect(await RewardOracle.isManager(newManager)).to.be.equal(true);
    });

    it("test _removeManager: Not owner, expected revert", async () => {
        const sender = pauseGuardian;
        const pauseGuardianAddr = await accounts[0].getAddress();
        expect(await RewardOracle.isManager(pauseGuardianAddr)).to.be.equal(true);

        await expect(RewardOracle.connect(sender)._removeManager(pauseGuardianAddr)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _removeManager: is owner, success", async () => {
        const sender = owner;
        const newManager = await accounts[0].getAddress();
        const managers = await RewardOracle.managers();
        expect(managers.includes(newManager)).to.be.equal(true);

        await RewardOracle.connect(sender)._removeManager(newManager);
        expect(await RewardOracle.isManager(newManager)).to.be.equal(false);
    });

    it("test _setInterestRateLimitPerEpoch: Not owner, expected revert", async () => {
        const sender = accounts[0];
        const annualInterestRate = Ether;
        await expect(RewardOracle.connect(sender)._setInterestRateLimitPerEpoch(annualInterestRate)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _setInterestRateLimitPerEpoch: is owner interestRatePerEpoch > EPOCH_INTEREST_RATE_MAX, expected revert", async () => {
        const sender = owner;

        const annualInterestRate = Ether.mul(TWO);
        const interestRatePerEpoch = annualInterestRate.div(EPOCH_PER_YEAR);
        expect(interestRatePerEpoch.eq(await RewardOracle.interestRateLimitPerEpoch())).to.be.equal(false);
        expect(interestRatePerEpoch).to.be.gt(EPOCH_INTEREST_RATE_MAX);

        await expect(RewardOracle.connect(sender)._setInterestRateLimitPerEpoch(annualInterestRate)).to.be.revertedWith(
            "_setInterestRateLimitPerEpoch: Interest rate too large"
        );
    });
    it("test _setInterestRateLimitPerEpoch: is owner, set the same interestRatePerEpoch, expected revert", async () => {
        const sender = owner;

        const interestRatePerEpoch = await RewardOracle.interestRateLimitPerEpoch();
        const annualInterestRate = interestRatePerEpoch.mul(EPOCH_PER_YEAR);

        await expect(RewardOracle.connect(sender)._setInterestRateLimitPerEpoch(annualInterestRate)).to.be.revertedWith(
            "_setInterestRateLimitPerEpoch: Cannot set the same value"
        );
    });

    it("test _setInterestRateLimitPerEpoch: is owner, success", async () => {
        const sender = owner;

        const annualInterestRate = Ether.div(TWO);
        const interestRatePerEpoch = annualInterestRate.div(EPOCH_PER_YEAR);
        expect(interestRatePerEpoch.eq(await RewardOracle.interestRateLimitPerEpoch())).to.be.equal(false);
        expect(interestRatePerEpoch).to.be.lte(EPOCH_INTEREST_RATE_MAX);

        await RewardOracle.connect(sender)._setInterestRateLimitPerEpoch(annualInterestRate);
        expect(interestRatePerEpoch).to.be.equal(await RewardOracle.interestRateLimitPerEpoch());
    });

    it("test _setValidatorLimitPerEpoch: Not owner, expected revert", async () => {
        const sender = accounts[0];

        const validatorLimitPerEpoch = TWO;
        expect(validatorLimitPerEpoch.eq(await RewardOracle.validatorLimitPerEpoch())).to.be.equal(false);

        await expect(
            RewardOracle.connect(sender)._setValidatorLimitPerEpoch(validatorLimitPerEpoch)
        ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("test _setValidatorLimitPerEpoch: is owner, set the same validatorLimitPerEpoch, expected revert", async () => {
        const sender = owner;

        const validatorLimitPerEpoch = await RewardOracle.validatorLimitPerEpoch();

        await expect(
            RewardOracle.connect(sender)._setValidatorLimitPerEpoch(validatorLimitPerEpoch)
        ).to.be.revertedWith("_setValidatorLimitPerEpoch: Cannot set the same value");
    });

    it("test _setValidatorLimitPerEpoch: is owner, success", async () => {
        const sender = owner;

        const validatorLimitPerEpoch = TWO;
        expect(validatorLimitPerEpoch.eq(await RewardOracle.validatorLimitPerEpoch())).to.be.equal(false);

        await RewardOracle.connect(sender)._setValidatorLimitPerEpoch(validatorLimitPerEpoch);
        expect(validatorLimitPerEpoch).to.be.equal(await RewardOracle.validatorLimitPerEpoch());
    });

    it("test submitEpochReward: is manager, paused, expected revert", async () => {
        const sender = manager;

        const senderAddr = await sender.getAddress();
        expect(await RewardOracle.isManager(senderAddr)).to.be.equal(true);
        await RewardOracle._close();
        expect(await RewardOracle.paused()).to.be.equal(true);

        const epochId = ONE;
        const activatedValidatorCount = TWO;
        const rewardIncrement = Ether;

        await expect(
            RewardOracle.connect(sender).submitEpochReward(epochId, activatedValidatorCount, rewardIncrement)
        ).to.be.revertedWith("Pausable: paused");
    });

    it("test submitEpochReward: Not manager, non-pause, expected revert", async () => {
        const sender = accounts[0];

        const senderAddr = await sender.getAddress();
        expect(await RewardOracle.isManager(senderAddr)).to.be.equal(false);

        await RewardOracle._open();
        expect(await RewardOracle.paused()).to.be.equal(false);

        const epochId = ONE;
        const activatedValidatorCount = TWO;
        const rewardIncrement = Ether;

        await expect(
            RewardOracle.connect(sender).submitEpochReward(epochId, activatedValidatorCount, rewardIncrement)
        ).to.be.revertedWith("onlyManager: caller is not manager");
    });
});
