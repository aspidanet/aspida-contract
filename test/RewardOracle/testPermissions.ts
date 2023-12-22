import { Signer, Contract } from "ethers";
import { expect } from "chai";

import { fixtureDefault } from "../utils/fixtures";

import { MAX, ZERO, ONE, TWO, NegativeOne, Ether, AddressZero, AbiCoder } from "../utils/constants";

import { LibraryTestData, testManable, testPauseGuardian } from "../Library/testLibrary";

const SECONDS_PER_SLOT = ethers.utils.parseUnits("12", "wei");
const SLOT_PER_EPOCH = ethers.utils.parseUnits("32", "wei");
const EPOCH_PER_YEAR = ethers.utils.parseUnits("31536000", "wei").div(SECONDS_PER_SLOT.mul(SLOT_PER_EPOCH)); // 3600 * 24 * 365
const EPOCH_INTEREST_RATE_MAX = Ether.div(EPOCH_PER_YEAR);

describe("Test RewardOracle permissions", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let dETH: Contract;
    let CorePrimary: Contract;
    let RewardOracle: Contract;

    let libraryTestData: LibraryTestData;

    async function init() {
        const initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        dETH = initData.dETH;
        CorePrimary = initData.CorePrimary;
        RewardOracle = initData.RewardOracle;

        libraryTestData = {
            owner: owner,
            manager: manager,
            pauseGuardian: pauseGuardian,
            accounts: accounts,
            contract: RewardOracle,
        };
    }

    before(async function () {
        await init();
    });

    it("test initialize: Already initialized, expected revert", async () => {
        await expect(RewardOracle.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("test testManable, success", async () => {
        await testManable(libraryTestData, "RewardOracle");
    });

    it("test testPauseGuardian, success", async () => {
        await testPauseGuardian(libraryTestData, "RewardOracle");
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

    it("test _recapLoss: Not owner, expected revert", async () => {
        const sender = accounts[0];

        await expect(RewardOracle.connect(sender)._recapLoss(Ether)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _recapLoss: is owner, insufficient balance, expected revert", async () => {
        const sender = owner;

        const treasury = await CorePrimary.treasury();
        expect(await sender.getAddress()).to.be.equal(treasury);

        await dETH.connect(sender).approve(RewardOracle.address, MAX);

        const income = await dETH.balanceOf(treasury);
        const loss = income.add(ONE);

        await expect(RewardOracle.connect(sender)._recapLoss(loss)).to.be.revertedWith(
            "ERC20: burn amount exceeds balance"
        );
    });

    it("test _recapLoss: is owner, insufficient allowance, expected revert", async () => {
        const sender = owner;

        const treasury = await CorePrimary.treasury();
        expect(await sender.getAddress()).to.be.equal(treasury);

        const income = Ether;
        await dETH.connect(manager).mint(treasury, income);

        const loss = income;

        await dETH.connect(sender).approve(RewardOracle.address, loss.sub(ONE));

        await expect(RewardOracle.connect(sender)._recapLoss(loss)).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("test _recapLoss: is owner, success", async () => {
        const sender = owner;

        const treasury = await CorePrimary.treasury();
        expect(await sender.getAddress()).to.be.equal(treasury);

        await dETH.connect(sender).approve(RewardOracle.address, MAX);

        const income = await dETH.balanceOf(treasury);

        const loss = income;

        await expect(RewardOracle.connect(sender)._recapLoss(loss)).changeTokenBalances(
            dETH,
            [RewardOracle.address, treasury],
            [ZERO, loss.mul(NegativeOne)]
        );
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

    it("test zeroEpochTimestamp: check zeroEpochTimestamp, success", async () => {
        expect(await RewardOracle.zeroEpochTimestamp()).to.be.equal(1606824023);
    });
});
