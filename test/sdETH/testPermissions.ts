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

describe("Test sdETH permissions", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let dETH: Contract;
    let sdETH: Contract;

    let libraryTestData: LibraryTestData;

    async function init() {
        const initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        dETH = initData.dETH;
        sdETH = initData.sdETH;

        libraryTestData = {
            owner: owner,
            manager: manager,
            pauseGuardian: pauseGuardian,
            accounts: accounts,
            contract: sdETH,
        };

        await dETH._addManager(await owner.getAddress());
    }

    before(async function () {
        await init();
    });

    it("test initialize: Already initialized, expected revert", async () => {
        await expect(sdETH.initialize("Aspida Stake Ether", "sdETH", dETH.address)).to.be.revertedWith(
            "Initializable: contract is already initialized"
        );
    });

    it("test decimals: sdETH.decimals = dETH.decimals, success", async () => {
        expect(await sdETH.decimals()).to.be.equal(await dETH.decimals());
    });

    it("test testPauseGuardian, success", async () => {
        await testPauseGuardian(libraryTestData, "sdETH");
    });

    it("test _setDuration: Not owner, expected revert", async () => {
        const sender = manager;
        const currentDuration = await sdETH.duration();
        const duration = currentDuration.add(DAY);

        await expect(sdETH.connect(sender)._setDuration(duration)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _setDuration: is owner, success", async () => {
        const sender = owner;
        const currentDuration = await sdETH.duration();
        const duration = currentDuration.add(DAY);

        await sdETH.connect(sender)._setDuration(duration);
        expect(await sdETH.duration()).to.be.equal(duration);
    });

    it("test _setDuration: is owner, duration = 0, expected revert", async () => {
        const sender = owner;
        const duration = ZERO;

        const currentDuration = await sdETH.duration();
        expect(duration).to.be.lt(currentDuration);

        await expect(sdETH.connect(sender)._setDuration(duration)).to.be.revertedWith(
            "_setDurationInternal: Invalid duration"
        );
    });

    it("test _setDuration: is owner, duration = currentDuration, expected revert", async () => {
        const sender = owner;
        const duration = await sdETH.duration();

        await expect(sdETH.connect(sender)._setDuration(duration)).to.be.revertedWith(
            "_setDurationInternal: Invalid duration"
        );
    });

    it("test _speedUpReward: Not owner, expected revert", async () => {
        const sender = manager;
        const currentDuration = await sdETH.duration();
        const duration = currentDuration.add(DAY);
        const reward = Ether;

        await expect(sdETH.connect(sender)._speedUpReward(reward, duration)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _speedUpReward: is owner, duration = 0, expected revert", async () => {
        const sender = owner;
        const duration = ZERO;
        const reward = Ether;

        await expect(sdETH.connect(sender)._speedUpReward(reward, duration)).to.be.revertedWith(
            "_speedUpReward: Invalid duration"
        );
    });

    it("test _speedUpReward: is owner, duration = 0, expected revert", async () => {
        const sender = owner;
        const duration = DAY;

        await dETH.mint(sdETH.address, Ether);
        const availableReward = await sdETH.availableReward();
        const reward = availableReward.add(ONE);

        await expect(sdETH.connect(sender)._speedUpReward(reward, duration)).to.be.revertedWith(
            "_speedUpReward: Invalid reward"
        );
    });

    it("test _speedUpReward: next period, success", async () => {
        const sender = owner;
        const duration = DAY;

        await increaseTime(
            Number(
                (await sdETH.periodFinish()).sub(utils.parseUnits((await getCurrentTime()).toString(), 0)).toString()
            )
        );

        await dETH.mint(sdETH.address, Ether);
        const availableReward = await sdETH.availableReward();
        const reward = availableReward.div(TWO);

        const currentDuration = await sdETH.duration();

        await sdETH.connect(sender)._speedUpReward(reward, duration);

        const currentTime = utils.parseUnits((await getCurrentTime()).toString(), 0);
        expect(await sdETH.duration()).to.be.equal(currentDuration);
        expect(await sdETH.rewardRate()).to.be.equal(reward.div(duration));
        expect(await sdETH.periodFinish()).to.be.equal(currentTime.add(duration));
        expect(await sdETH.lastUpdateTime()).to.be.equal(currentTime);
    });
});
