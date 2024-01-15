import { Signer, Contract, utils } from "ethers";
import { expect } from "chai";

import { fixtureDefault } from "../utils/fixtures";
import {
    MAX,
    ZERO,
    ONE,
    TWO,
    NegativeOne,
    SECOND,
    HOUR,
    DAY,
    WEEK,
    YEAR,
    Ether,
    AddressZero,
    AbiCoder,
} from "../utils/constants";
import { getCurrentTime, increaseTime } from "../utils/helper";

import { LibraryTestData, testPauseGuardian } from "../Library/testLibrary";

describe("Test saETH permissions", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let aETH: Contract;
    let saETH: Contract;

    let libraryTestData: LibraryTestData;

    async function init() {
        const initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        aETH = initData.aETH;
        saETH = initData.saETH;

        libraryTestData = {
            owner: owner,
            manager: manager,
            pauseGuardian: pauseGuardian,
            accounts: accounts,
            contract: saETH,
        };

        await aETH._addManager(await owner.getAddress());
    }

    before(async function () {
        await init();
    });

    it("test initialize: Already initialized, expected revert", async () => {
        await expect(saETH.initialize("Aspida Stake Ether", "saETH", aETH.address)).to.be.revertedWith(
            "Initializable: contract is already initialized"
        );
    });

    it("test decimals: saETH.decimals = aETH.decimals, success", async () => {
        expect(await saETH.decimals()).to.be.equal(await aETH.decimals());
    });

    it("test testPauseGuardian, success", async () => {
        await testPauseGuardian(libraryTestData, "saETH");
    });

    it("test _setDuration: Not owner, expected revert", async () => {
        const sender = manager;
        const currentDuration = await saETH.duration();
        const duration = currentDuration.add(DAY);

        await expect(saETH.connect(sender)._setDuration(duration)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _setDuration: is owner, success", async () => {
        const sender = owner;
        const currentDuration = await saETH.duration();
        const duration = currentDuration.add(DAY);

        await saETH.connect(sender)._setDuration(duration);
        expect(await saETH.duration()).to.be.equal(duration);
    });

    it("test _setDuration: is owner, duration = 0, expected revert", async () => {
        const sender = owner;
        const duration = ZERO;

        const currentDuration = await saETH.duration();
        expect(duration).to.be.lt(currentDuration);

        await expect(saETH.connect(sender)._setDuration(duration)).to.be.revertedWith(
            "_setDurationInternal: Invalid duration"
        );
    });

    it("test _setDuration: is owner, duration = currentDuration, expected revert", async () => {
        const sender = owner;
        const duration = await saETH.duration();

        await expect(saETH.connect(sender)._setDuration(duration)).to.be.revertedWith(
            "_setDurationInternal: Invalid duration"
        );
    });

    it("test _speedUpReward: Not owner, expected revert", async () => {
        const sender = manager;
        const currentDuration = await saETH.duration();
        const duration = currentDuration.add(DAY);
        const reward = Ether;

        await expect(saETH.connect(sender)._speedUpReward(reward, duration)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _speedUpReward: is owner, duration = 0, expected revert", async () => {
        const sender = owner;
        const duration = ZERO;
        const reward = Ether;

        await expect(saETH.connect(sender)._speedUpReward(reward, duration)).to.be.revertedWith(
            "_speedUpReward: Invalid duration"
        );
    });

    it("test _speedUpReward: is owner, duration = 0, expected revert", async () => {
        const sender = owner;
        const duration = DAY;

        await aETH.mint(saETH.address, Ether);
        const availableReward = await saETH.availableReward();
        const reward = availableReward.add(ONE);

        await expect(saETH.connect(sender)._speedUpReward(reward, duration)).to.be.revertedWith(
            "_speedUpReward: Invalid reward"
        );
    });

    it("test _speedUpReward: next period, success", async () => {
        const sender = owner;
        const duration = DAY;

        await increaseTime(
            Number(
                (await saETH.periodFinish()).sub(utils.parseUnits((await getCurrentTime()).toString(), 0)).toString()
            )
        );

        await aETH.mint(saETH.address, Ether);
        const availableReward = await saETH.availableReward();
        const reward = availableReward.div(TWO);

        const currentDuration = await saETH.duration();

        await saETH.connect(sender)._speedUpReward(reward, duration);

        const currentTime = utils.parseUnits((await getCurrentTime()).toString(), 0);
        expect(await saETH.duration()).to.be.equal(currentDuration);
        expect(await saETH.rewardRate()).to.be.equal(reward.div(duration));
        expect(await saETH.periodFinish()).to.be.equal(currentTime.add(duration));
        expect(await saETH.lastUpdateTime()).to.be.equal(currentTime);
    });
});
