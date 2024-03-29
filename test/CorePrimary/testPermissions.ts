import { Signer, Contract, BigNumber, utils } from "ethers";
import { expect } from "chai";

import { deployContract, fixtureDefault } from "../utils/fixtures";
import { MAX, ZERO, ONE, TWO, NegativeOne, Ether, AddressZero, AbiCoder } from "../utils/constants";
import { getCurrentTime, mineManually } from "../utils/helper";

import { LibraryTestData, testManable, testPauseGuardian } from "../Library/testLibrary";

describe("Test CorePrimary permissions", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let aETH: Contract;
    let saETH: Contract;
    let CorePrimary: Contract;
    let RewardOracle: Contract;
    let MockCore: Contract;
    let Strategy: Contract;
    let FakeStrategy: Contract;

    let libraryTestData: LibraryTestData;

    async function init() {
        const initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        aETH = initData.aETH;
        saETH = initData.saETH;
        CorePrimary = initData.CorePrimary;
        RewardOracle = initData.RewardOracle;

        Strategy = await deployContract("MockStrategy", [CorePrimary.address]);
        MockCore = await deployContract("MockCore", []);
        FakeStrategy = await deployContract("MockStrategy", [MockCore.address]);

        libraryTestData = {
            owner: owner,
            manager: manager,
            pauseGuardian: pauseGuardian,
            accounts: accounts,
            contract: CorePrimary,
        };
    }

    async function forward(epochId: BigNumber) {
        const SECONDS_PER_SLOT = ethers.utils.parseUnits("12", "wei");
        const SLOT_PER_EPOCH = ethers.utils.parseUnits("32", "wei");
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

    before(async function () {
        await init();
    });

    it("test initialize: Already initialized, expected revert", async () => {
        await expect(CorePrimary.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("test testManable, success", async () => {
        await testManable(libraryTestData, "CorePrimary");
    });

    it("test testPauseGuardian, success", async () => {
        await testPauseGuardian(libraryTestData, "CorePrimary");
    });

    it("test _setTreasury: Not owner, expected revert", async () => {
        const sender = manager;
        const newTreasury = await accounts[0].getAddress();
        expect((await CorePrimary.treasury()) == newTreasury).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._setTreasury(newTreasury)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _setTreasury: is owner, success", async () => {
        const sender = owner;
        const newTreasury = await accounts[0].getAddress();
        expect((await CorePrimary.treasury()) == newTreasury).to.be.equal(false);

        await CorePrimary.connect(sender)._setTreasury(newTreasury);
        expect(await CorePrimary.treasury()).to.be.equal(newTreasury);
    });

    it("test _setTreasury: is owner, newTreasury is zero address, expected revert", async () => {
        const sender = owner;
        const newTreasury = AddressZero;
        expect((await CorePrimary.treasury()) == newTreasury).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._setTreasury(newTreasury)).to.be.revertedWith(
            "_setTreasuryInternal: Invalid treasury"
        );
    });

    it("test _setTreasury: is owner, newTreasury = treasury, expected revert", async () => {
        const sender = owner;
        const newTreasury = await CorePrimary.treasury();

        await expect(CorePrimary.connect(sender)._setTreasury(newTreasury)).to.be.revertedWith(
            "_setTreasuryInternal: Invalid treasury"
        );
    });

    it("test _setTreasuryRatio: Not owner, expected revert", async () => {
        const sender = manager;
        const newTreasuryRatio = Ether.div(TWO);
        expect((await CorePrimary.treasuryRatio()).eq(newTreasuryRatio)).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._setTreasuryRatio(newTreasuryRatio)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _setTreasuryRatio: is owner, success", async () => {
        const sender = owner;
        const newTreasuryRatio = Ether.div(TWO);
        expect((await CorePrimary.treasuryRatio()).eq(newTreasuryRatio)).to.be.equal(false);

        await CorePrimary.connect(sender)._setTreasuryRatio(newTreasuryRatio);
        expect(await CorePrimary.treasuryRatio()).to.be.equal(newTreasuryRatio);
    });

    it("test _setTreasuryRatio: is owner, newTreasuryRatio exceeds max value, expected revert", async () => {
        const sender = owner;
        const newTreasuryRatio = Ether.add(ONE);
        expect((await CorePrimary.treasuryRatio()).eq(newTreasuryRatio)).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._setTreasuryRatio(newTreasuryRatio)).to.be.revertedWith(
            "_setTreasuryRatioInternal: TreasuryRatio too large"
        );
    });

    it("test _setTreasuryRatio: is owner, newTreasuryRatio = treasury, expected revert", async () => {
        const sender = owner;
        const newTreasuryRatio = await CorePrimary.treasuryRatio();

        await expect(CorePrimary.connect(sender)._setTreasuryRatio(newTreasuryRatio)).to.be.revertedWith(
            "_setTreasuryRatioInternal: Cannot set the same value"
        );
    });

    it("test _setReserveRatio: Not owner, expected revert", async () => {
        const sender = manager;
        const newReserveRatio = Ether.div(TWO);
        expect((await CorePrimary.reserveRatio()).eq(newReserveRatio)).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._setReserveRatio(newReserveRatio)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _setReserveRatio: is owner, success", async () => {
        const sender = owner;
        const newReserveRatio = Ether.div(TWO);
        expect((await CorePrimary.reserveRatio()).eq(newReserveRatio)).to.be.equal(false);

        await CorePrimary.connect(sender)._setReserveRatio(newReserveRatio);
        expect(await CorePrimary.reserveRatio()).to.be.equal(newReserveRatio);
    });

    it("test _setReserveRatio: is owner, newReserveRatio exceeds max value, expected revert", async () => {
        const sender = owner;
        const newReserveRatio = Ether.add(ONE);
        expect((await CorePrimary.reserveRatio()).eq(newReserveRatio)).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._setReserveRatio(newReserveRatio)).to.be.revertedWith(
            "_setReserveRatioInternal: ReserveRatio too large"
        );
    });

    it("test _setReserveRatio: is owner, newReserveRatio = reserveRatio, expected revert", async () => {
        const sender = owner;
        const newReserveRatio = await CorePrimary.reserveRatio();

        await expect(CorePrimary.connect(sender)._setReserveRatio(newReserveRatio)).to.be.revertedWith(
            "_setReserveRatioInternal: Cannot set the same value"
        );
    });

    it("test _addStrategy: Not owner, expected revert", async () => {
        const sender = manager;
        const strategy = Strategy.address;

        const strategists = await CorePrimary.strategists();
        expect(strategists.includes(strategy)).to.be.equal(false);
        expect(await Strategy.aETH()).to.be.equal(await CorePrimary.aETH());

        await expect(CorePrimary.connect(sender)._addStrategy(strategy)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _addStrategy: is owner, success", async () => {
        const sender = owner;
        const strategy = Strategy.address;

        const strategists = await CorePrimary.strategists();
        expect(strategists.includes(strategy)).to.be.equal(false);

        await CorePrimary.connect(sender)._addStrategy(strategy);
        expect((await CorePrimary.strategists()).includes(strategy)).to.be.equal(true);
    });

    it("test _addStrategy: is owner, strategy is zero address, expected revert", async () => {
        const sender = owner;
        const strategy = AddressZero;

        const strategists = await CorePrimary.strategists();
        expect(strategists.includes(strategy)).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._addStrategy(strategy)).to.be.revertedWith(
            "_addStrategyInternal: invalid strategy address"
        );
    });

    it("test _addStrategy: is owner, invalid strategy address, expected revert", async () => {
        const sender = owner;
        const strategy = FakeStrategy.address;

        const strategists = await CorePrimary.strategists();
        expect(strategists.includes(strategy)).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._addStrategy(strategy)).to.be.revertedWith(
            "_addStrategyInternal: invalid strategy address"
        );
    });

    it("test _addStrategy: is owner, strategy added, expected revert", async () => {
        const sender = owner;
        const strategy = (await CorePrimary.strategists())[0];

        await expect(CorePrimary.connect(sender)._addStrategy(strategy)).to.be.revertedWith(
            "_addStrategyInternal: Strategy has been added"
        );
    });

    it("test _removeStrategy: Not owner, expected revert", async () => {
        const sender = manager;

        const strategists = await CorePrimary.strategists();
        const strategy = strategists[0];

        await expect(CorePrimary.connect(sender)._removeStrategy(strategy)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _removeStrategy: is owner, success", async () => {
        const sender = owner;
        const strategy = Strategy.address;

        const strategists = await CorePrimary.strategists();
        expect(strategists.includes(strategy)).to.be.equal(true);

        await CorePrimary.connect(sender)._removeStrategy(strategy);
        expect((await CorePrimary.strategists()).includes(strategy)).to.be.equal(false);
    });

    it("test _removeStrategy: is owner, strategy removed, expected revert", async () => {
        const sender = owner;
        const strategy = Strategy.address;

        const strategists = await CorePrimary.strategists();
        expect(strategists.includes(strategy)).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._removeStrategy(strategy)).to.be.revertedWith(
            "_removeStrategyInternal: Strategy has been removed"
        );
    });

    it("test _releaseStrategyReserve: Not owner, expected revert", async () => {
        const sender = manager;

        expect(await CorePrimary.reserveRatio()).to.be.gt(ZERO);

        const ethValue = Ether;
        await expect(CorePrimary.connect(sender)["submit()"]({ value: ethValue })).changeEtherBalances(
            [CorePrimary.address, sender],
            [ethValue, ethValue.mul(NegativeOne)]
        );

        const strategyReserve = await CorePrimary.strategyReserve();
        expect(strategyReserve).to.be.gt(ZERO);

        const releaseAmount = strategyReserve.div(TWO);

        await expect(CorePrimary.connect(sender)._releaseStrategyReserve(releaseAmount)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _releaseStrategyReserve: is owner, success", async () => {
        const sender = owner;

        const strategyReserve = await CorePrimary.strategyReserve();
        expect(strategyReserve).to.be.gt(ZERO);

        const releaseAmount = strategyReserve.div(TWO);

        await expect(CorePrimary.connect(sender)._releaseStrategyReserve(releaseAmount)).changeEtherBalances(
            [CorePrimary.address, sender],
            [ZERO, ZERO]
        );

        expect(await CorePrimary.strategyReserve()).to.be.equal(strategyReserve.sub(releaseAmount));
    });

    it("test _disableRewardOracle: Not owner, expected revert", async () => {
        const sender = manager;
        const rewardOracle = await CorePrimary.rewardOracle();

        await expect(CorePrimary.connect(sender)._disableRewardOracle()).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _disableRewardOracle: is owner, success", async () => {
        const sender = owner;
        await CorePrimary.connect(sender)._disableRewardOracle();
        expect(await CorePrimary.rewardOracle()).to.be.equal(AddressZero);
    });

    it("test _setRewardOracle: Not owner, expected revert", async () => {
        const sender = manager;
        const rewardOracle = RewardOracle.address;
        expect((await CorePrimary.rewardOracle()) == rewardOracle).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._setRewardOracle(rewardOracle)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _setRewardOracle: is owner, success", async () => {
        const sender = owner;
        const rewardOracle = RewardOracle.address;
        expect((await CorePrimary.rewardOracle()) == rewardOracle).to.be.equal(false);

        await CorePrimary.connect(sender)._setRewardOracle(rewardOracle);
        expect(await CorePrimary.rewardOracle()).to.be.equal(rewardOracle);
    });

    it("test _setRewardOracle: is owner, rewardOracle is zero address, expected revert", async () => {
        const sender = owner;
        const rewardOracle = AddressZero;
        expect((await CorePrimary.rewardOracle()) == rewardOracle).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._setRewardOracle(rewardOracle)).to.be.reverted;
    });

    it("test _setRewardOracle: is owner, repeat setup, expected revert", async () => {
        const sender = owner;
        const rewardOracle = await CorePrimary.rewardOracle();

        await expect(CorePrimary.connect(sender)._setRewardOracle(rewardOracle)).to.be.revertedWith(
            "_setRewardOracle: Invalid reward oracle address"
        );
    });

    it("test _setRewardOracle: is owner, Invalid reward oracle, expected revert", async () => {
        const sender = owner;
        const rewardOracle = FakeStrategy.address;

        await expect(CorePrimary.connect(sender)._setRewardOracle(rewardOracle)).to.be.revertedWith(
            "_setRewardOracle: Invalid reward oracle address"
        );
    });

    it("test _depositIntoStrategy: Not owner, expected revert", async () => {
        const sender = manager;

        const strategy = Strategy.address;
        await CorePrimary._addStrategy(strategy);

        const strategyReserve = await CorePrimary.strategyReserve();
        const ethAmount = strategyReserve.div(TWO);

        await expect(CorePrimary.connect(sender)._depositIntoStrategy(strategy, ethAmount)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _depositIntoStrategy: is owner, invalid strategy, expected revert", async () => {
        const sender = owner;

        const strategy = FakeStrategy.address;
        const strategists = await CorePrimary.strategists();
        expect(strategists.includes(strategy)).to.be.equal(false);

        const strategyReserve = await CorePrimary.strategyReserve();
        const ethAmount = strategyReserve.div(TWO);

        await expect(CorePrimary.connect(sender)._depositIntoStrategy(strategy, ethAmount)).to.be.revertedWith(
            "isStrategy: invalid strategy address"
        );
    });

    it("test _depositIntoStrategy: is owner, success", async () => {
        const sender = owner;

        const strategy = (await CorePrimary.strategists())[0];

        const strategyReserve = await CorePrimary.strategyReserve();
        const ethAmount = strategyReserve.div(TWO);

        expect(await CorePrimary.depositStrategy()).to.be.equal(ZERO);

        await expect(CorePrimary.connect(sender)._depositIntoStrategy(strategy, ethAmount)).changeEtherBalances(
            [CorePrimary.address, strategy, sender],
            [ethAmount.mul(NegativeOne), ethAmount, ZERO]
        );

        expect(await CorePrimary.strategyReserve()).to.be.equal(strategyReserve.sub(ethAmount));
        expect(await CorePrimary.depositStrategy()).to.be.equal(ethAmount);
        expect(await CorePrimary.receiveStrategy()).to.be.equal(ZERO);
    });

    it("test supplyReward: Not rewardOracle, expected revert", async () => {
        const sender = manager;
        const amount = Ether;

        await expect(CorePrimary.connect(sender).supplyReward(amount)).to.be.revertedWith(
            "onlyRewardOracle: caller is not the rewardOracle"
        );
    });

    it("test supplyReward: is rewardOracle, success", async () => {
        const epochCount = utils.parseUnits("200", 0);
        await RewardOracle._setValidatorLimitPerEpoch(epochCount);

        const startEpochId = await RewardOracle.lastEpochId();
        const epochId = startEpochId.add(epochCount);
        const validatorCount = utils.parseUnits("2000", 0);
        const amount = Ether;

        const treasuryRatio = await CorePrimary.treasuryRatio();
        const treasuryAmount = treasuryRatio.mul(amount).div(Ether);
        expect(treasuryRatio.gt(ZERO)).to.be.equal(true);

        await forward(epochId);
        await expect(
            RewardOracle.connect(manager).submitEpochReward(startEpochId, epochId, validatorCount, amount)
        ).changeTokenBalances(
            aETH,
            [CorePrimary.address, RewardOracle.address, await CorePrimary.treasury(), saETH.address],
            [ZERO, ZERO, treasuryAmount, amount.sub(treasuryAmount)]
        );
    });

    it("test supplyReward: is rewardOracle, treasuryRatio = 0, success", async () => {
        const epochCount = utils.parseUnits("200", 0);
        const startEpochId = await RewardOracle.lastEpochId();
        const epochId = startEpochId.add(epochCount);
        const validatorCount = utils.parseUnits("2000", 0);
        const amount = Ether;

        const treasuryRatio = ZERO;
        const treasuryAmount = treasuryRatio.mul(amount).div(Ether);
        await CorePrimary._setTreasuryRatio(treasuryRatio);

        await forward(epochId);
        await expect(
            RewardOracle.connect(manager).submitEpochReward(startEpochId, epochId, validatorCount, amount)
        ).changeTokenBalances(
            aETH,
            [CorePrimary.address, RewardOracle.address, await CorePrimary.treasury(), saETH.address],
            [ZERO, ZERO, treasuryAmount, amount.sub(treasuryAmount)]
        );
    });

    it("test supplyReward: is rewardOracle, treasuryRatio = 100%, success", async () => {
        const epochCount = utils.parseUnits("200", 0);
        const startEpochId = await RewardOracle.lastEpochId();
        const epochId = startEpochId.add(epochCount);
        const validatorCount = utils.parseUnits("2000", 0);
        const amount = Ether;

        const treasuryRatio = Ether;
        const treasuryAmount = treasuryRatio.mul(amount).div(Ether);
        await CorePrimary._setTreasuryRatio(treasuryRatio);

        await forward(epochId);
        await expect(
            RewardOracle.connect(manager).submitEpochReward(startEpochId, epochId, validatorCount, amount)
        ).changeTokenBalances(
            aETH,
            [CorePrimary.address, RewardOracle.address, await CorePrimary.treasury(), saETH.address],
            [ZERO, ZERO, treasuryAmount, amount.sub(treasuryAmount)]
        );
    });

    it("test receiveStrategyEarning: Not strategy, expected revert", async () => {
        const sender = manager;
        const ethValue = Ether;

        await expect(CorePrimary.connect(sender).receiveStrategyEarning({ value: ethValue })).to.be.revertedWith(
            "isStrategy: invalid strategy address"
        );
    });

    it("test receiveStrategyEarning: is strategy, success", async () => {
        const balance = await Strategy.provider.getBalance(Strategy.address);

        const strategyReserve = await CorePrimary.strategyReserve();
        const depositStrategy = await CorePrimary.depositStrategy();
        const receiveStrategy = await CorePrimary.receiveStrategy();

        await expect(Strategy.repayCore()).changeEtherBalances(
            [Strategy.address, CorePrimary.address],
            [balance.mul(NegativeOne), balance]
        );

        expect(await CorePrimary.strategyReserve()).to.be.equal(strategyReserve.add(balance));
        expect(await CorePrimary.depositStrategy()).to.be.equal(depositStrategy);
        expect(await CorePrimary.receiveStrategy()).to.be.equal(receiveStrategy.add(balance));
    });

    it("test Strategy onlyCore: is strategy, expected revert", async () => {
        await expect(Strategy.strategyReceive()).to.be.revertedWith("onlyCore: caller is not the core");
    });

    it("test _recapLoss: Not owner, expected revert", async () => {
        const sender = accounts[0];

        await expect(CorePrimary.connect(sender)._recapLoss(Ether)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _recapLoss: is owner, insufficient balance, expected revert", async () => {
        const sender = owner;
        const newTreasury = await sender.getAddress();
        await CorePrimary.connect(sender)._setTreasury(newTreasury);

        const treasury = await CorePrimary.treasury();
        expect(newTreasury).to.be.equal(treasury);

        await aETH.connect(sender).approve(CorePrimary.address, MAX);

        const income = await aETH.balanceOf(treasury);
        const loss = income.add(ONE);

        await expect(CorePrimary.connect(sender)._recapLoss(loss)).to.be.revertedWith(
            "ERC20: burn amount exceeds balance"
        );
    });

    it("test _recapLoss: is owner, insufficient allowance, expected revert", async () => {
        const sender = owner;

        const treasury = await CorePrimary.treasury();
        expect(await sender.getAddress()).to.be.equal(treasury);

        const income = Ether;
        await aETH.connect(manager).mint(treasury, income);

        const loss = income;

        await aETH.connect(sender).approve(CorePrimary.address, loss.sub(ONE));

        await expect(CorePrimary.connect(sender)._recapLoss(loss)).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("test _recapLoss: is owner, success", async () => {
        const sender = owner;

        const treasury = await CorePrimary.treasury();
        expect(await sender.getAddress()).to.be.equal(treasury);

        await aETH.connect(sender).approve(CorePrimary.address, MAX);

        const income = await aETH.balanceOf(treasury);

        const loss = income;

        await expect(CorePrimary.connect(sender)._recapLoss(loss)).changeTokenBalances(
            aETH,
            [CorePrimary.address, treasury],
            [ZERO, loss.mul(NegativeOne)]
        );
    });
});
