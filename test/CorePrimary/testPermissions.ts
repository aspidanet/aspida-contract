import { Signer, Contract, utils } from "ethers";
import { expect } from "chai";

import { deployContract, fixtureDefault } from "../utils/fixtures";
import { MAX, ZERO, ONE, TWO, NegativeOne, Ether, AddressZero, AbiCoder } from "../utils/constants";

import { LibraryTestData, testManable, testPauseGuardian } from "../Library/testLibrary";

describe("Test CorePrimary permissions", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let dETH: Contract;
    let sdETH: Contract;
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
        dETH = initData.dETH;
        sdETH = initData.sdETH;
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

    it("test _setActionLimit: Not owner, expected revert", async () => {
        const sender = manager;
        const actionId = ZERO;
        const limit = Ether;
        const actionData = await CorePrimary.actionData(actionId);
        expect(actionData.limit.eq(limit)).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._setActionLimit(actionId, limit)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _setActionLimit: is owner, success", async () => {
        const sender = owner;
        const actionId = ZERO;
        const limit = Ether;
        const actionData = await CorePrimary.actionData(actionId);
        expect(actionData.limit.eq(limit)).to.be.equal(false);

        await CorePrimary.connect(sender)._setActionLimit(actionId, limit);
        const currentActionData = await CorePrimary.actionData(actionId);
        expect(currentActionData.limit).to.be.equal(limit);
        expect(currentActionData.threshold).to.be.equal(actionData.threshold);
        expect(currentActionData.latestIndex).to.be.equal(actionData.latestIndex);
        expect(currentActionData.accumulated).to.be.equal(actionData.accumulated);
    });

    it("test _setActionLimit: is owner, same limit, expected revert", async () => {
        const sender = owner;
        const actionId = ZERO;

        const actionData = await CorePrimary.actionData(actionId);
        const limit = actionData.limit;

        await expect(CorePrimary.connect(sender)._setActionLimit(actionId, limit)).to.be.revertedWith(
            "_setActionLimitInternal: Cannot set the same value"
        );
    });

    it("test _setActionLimit: is owner, actionId invalid, expected revert", async () => {
        const sender = owner;
        const actionId = utils.parseUnits("2", 0);
        const limit = Ether;

        await expect(CorePrimary.connect(sender)._setActionLimit(actionId, limit)).to.be.reverted;
    });

    it("test _setActionThreshold: Not owner, expected revert", async () => {
        const sender = manager;
        const actionId = ZERO;
        const threshold = Ether;
        const actionData = await CorePrimary.actionData(actionId);
        expect(actionData.threshold.eq(threshold)).to.be.equal(false);

        await expect(CorePrimary.connect(sender)._setActionThreshold(actionId, threshold)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _setActionThreshold: is owner, success", async () => {
        const sender = owner;
        const actionId = ONE;
        const threshold = Ether;
        const actionData = await CorePrimary.actionData(actionId);
        expect(actionData.threshold.eq(threshold)).to.be.equal(false);

        await CorePrimary.connect(sender)._setActionThreshold(actionId, threshold);
        const currentActionData = await CorePrimary.actionData(actionId);
        expect(currentActionData.threshold).to.be.equal(threshold);
        expect(currentActionData.limit).to.be.equal(actionData.limit);
        expect(currentActionData.latestIndex).to.be.equal(actionData.latestIndex);
        expect(currentActionData.accumulated).to.be.equal(actionData.accumulated);
        expect(await CorePrimary.withdrawThreshold()).to.be.equal(threshold);
    });

    it("test _setActionThreshold: is owner, same threshold, expected revert", async () => {
        const sender = owner;
        const actionId = ZERO;

        const actionData = await CorePrimary.actionData(actionId);
        const threshold = actionData.threshold;

        await expect(CorePrimary.connect(sender)._setActionThreshold(actionId, threshold)).to.be.revertedWith(
            "_setActionThresholdInternal: Cannot set the same value"
        );
    });

    it("test _setActionThreshold: is owner, actionId invalid, expected revert", async () => {
        const sender = owner;
        const actionId = utils.parseUnits("2", 0);
        const threshold = Ether;

        await expect(CorePrimary.connect(sender)._setActionThreshold(actionId, threshold)).to.be.reverted;
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
        expect(await Strategy.dETH()).to.be.equal(await CorePrimary.dETH());

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

        const epochId = (await RewardOracle.lastEpochId()).add(epochCount);
        const validatorCount = utils.parseUnits("2000", 0);
        const amount = Ether;

        const treasuryRatio = await CorePrimary.treasuryRatio();
        const treasuryAmount = treasuryRatio.mul(amount).div(Ether);
        expect(treasuryRatio.gt(ZERO)).to.be.equal(true);

        await expect(
            RewardOracle.connect(manager).submitEpochReward(epochId, validatorCount, amount)
        ).changeTokenBalances(
            dETH,
            [CorePrimary.address, RewardOracle.address, await CorePrimary.treasury(), sdETH.address],
            [ZERO, ZERO, treasuryAmount, amount.sub(treasuryAmount)]
        );
    });

    it("test supplyReward: is rewardOracle, treasuryRatio = 0, success", async () => {
        const epochCount = utils.parseUnits("200", 0);
        const epochId = (await RewardOracle.lastEpochId()).add(epochCount);
        const validatorCount = utils.parseUnits("2000", 0);
        const amount = Ether;

        const treasuryRatio = ZERO;
        const treasuryAmount = treasuryRatio.mul(amount).div(Ether);
        await CorePrimary._setTreasuryRatio(treasuryRatio);

        await expect(
            RewardOracle.connect(manager).submitEpochReward(epochId, validatorCount, amount)
        ).changeTokenBalances(
            dETH,
            [CorePrimary.address, RewardOracle.address, await CorePrimary.treasury(), sdETH.address],
            [ZERO, ZERO, treasuryAmount, amount.sub(treasuryAmount)]
        );
    });

    it("test supplyReward: is rewardOracle, treasuryRatio = 100%, success", async () => {
        const epochCount = utils.parseUnits("200", 0);
        const epochId = (await RewardOracle.lastEpochId()).add(epochCount);
        const validatorCount = utils.parseUnits("2000", 0);
        const amount = Ether;

        const treasuryRatio = Ether;
        const treasuryAmount = treasuryRatio.mul(amount).div(Ether);
        await CorePrimary._setTreasuryRatio(treasuryRatio);

        await expect(
            RewardOracle.connect(manager).submitEpochReward(epochId, validatorCount, amount)
        ).changeTokenBalances(
            dETH,
            [CorePrimary.address, RewardOracle.address, await CorePrimary.treasury(), sdETH.address],
            [ZERO, ZERO, treasuryAmount, amount.sub(treasuryAmount)]
        );
    });

    it("test strategyMinting: Not strategy, expected revert", async () => {
        const sender = manager;
        const receiver = await accounts[0].getAddress();
        const amount = Ether;

        await expect(CorePrimary.connect(sender).strategyMinting(receiver, amount)).to.be.revertedWith(
            "isStrategy: invalid strategy address"
        );
    });

    it("test strategyMinting: is strategy, success", async () => {
        const receiver = await accounts[0].getAddress();
        const amount = Ether;

        await expect(Strategy.strategyMinting(receiver, amount)).changeTokenBalances(
            dETH,
            [Strategy.address, CorePrimary.address, receiver],
            [ZERO, ZERO, amount]
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
});
