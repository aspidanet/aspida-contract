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
import { randomRange } from "../utils/helper";

import { ActionTestData, UserState, Action, getState, getUserState, executeAndCalcExpected } from "./sdETH";
import {
    testDepositRevert,
    testDeposit,
    testMintRevert,
    testMint,
    testWithdrawRevert,
    testWithdraw,
    testRedeemRevert,
    testRedeem,
    testExtractAll,
} from "./action";

describe("Test sdETH unit test", () => {
    let initData: ActionTestData;
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let dETH: Contract;
    let sdETH: Contract;

    async function init() {
        initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        dETH = initData.dETH;
        sdETH = initData.sdETH;

        await dETH._addManager(await owner.getAddress());
    }

    before(async function () {
        await init();
        const mintAmount = utils.parseEther("100000000");
        for (let index = 0; index < accounts.length; index++) {
            const accountAddr = await accounts[index].getAddress();
            await dETH.mint(accountAddr, mintAmount);
            await dETH.connect(accounts[index]).approve(sdETH.address, MAX);
        }
    });

    it("test deposit: deposit revert", async () => {
        await testDepositRevert(initData, "deposit revert");
    });

    it("test deposit: first rewardRate = 0", async () => {
        await testDeposit(initData, {}, "first rewardRate = 0");
    });

    it("test mint: mint revert", async () => {
        await testMintRevert(initData, "mint revert");
    });

    it("test mint: rewardRate = 0", async () => {
        await testMint(initData, {}, "rewardRate = 0");
    });

    it("test withdraw: withdraw revert", async () => {
        await testWithdrawRevert(initData, "withdraw revert");
    });

    it("test withdraw: rewardRate = 0", async () => {
        await testWithdraw(initData, {}, "rewardRate = 0");
    });

    it("test redeem: redeem revert", async () => {
        await testRedeemRevert(initData, "redeem revert");
    });

    it("test redeem: rewardRate = 0", async () => {
        await testRedeem(initData, {}, "rewardRate = 0");
    });

    it("test distribute rewards", async () => {
        const content = "rewardAmount > 0 rewardRate = 0";
        const intervention = {};

        await testMint(
            initData,
            {
                supplyReward: true,
            },
            content
        );
        await testWithdraw(initData, intervention, content);
        await testRedeem(initData, intervention, content);
        await testDeposit(initData, intervention, content);
    });

    it("test rewardRate > 0", async () => {
        const content = "rewardRate > 0";
        const intervention = {};

        await testDeposit(
            initData,
            {
                speedUp: true,
            },
            content
        );
        await testRedeem(initData, intervention, content);
        await testWithdraw(initData, intervention, content);
        await testMint(initData, intervention, content);
    });

    it("test halved", async () => {
        const content = "halved";
        const intervention = {
            halved: true,
        };

        await testDeposit(initData, intervention, content);
        await testRedeem(initData, intervention, content);
        await testWithdraw(initData, intervention, content);
        await testMint(initData, intervention, content);
    });

    it("test stopDistribution", async () => {
        const content = "stopDistribution";
        const intervention = {
            stopDistribution: true,
        };

        await testDeposit(initData, intervention, content);
        await testRedeem(initData, intervention, content);
        await testWithdraw(initData, intervention, content);
        await testMint(initData, intervention, content);
    });

    it("test nextPeriod", async () => {
        const content = "nextPeriod";
        const intervention = {
            nextPeriod: true,
        };

        await testDeposit(initData, intervention, content);
        await testRedeem(initData, intervention, content);
        await testWithdraw(initData, intervention, content);
        await testMint(initData, intervention, content);
    });

    const times = 10;
    const interventionActions = ["supplyReward", "speedUp", "halved", "stopDistribution", "nextPeriod"];
    const actions = [testDeposit, testRedeem, testWithdraw, testMint];

    for (let index = 0; index <= times; index++) {
        it("test random test", async () => {
            if (index == times) {
                await testExtractAll(initData);
                return;
            }
            const interventionKey = interventionActions[randomRange(0, interventionActions.length)];
            const content = `${index} : ${interventionKey}`;

            let intervention: Record<string, boolean> = {};
            intervention[interventionKey] = true;
            await actions[randomRange(0, actions.length)](initData, intervention, content);
        });
    }

    for (let index = 0; index <= times; index++) {
        it("test random test", async () => {
            if (index == times) {
                await testExtractAll(initData);
                return;
            }
            const interventionKey = interventionActions[randomRange(0, interventionActions.length)];
            const content = `${index} : ${interventionKey}`;

            let intervention: Record<string, boolean> = {};
            intervention[interventionKey] = true;
            await actions[randomRange(0, actions.length)](initData, intervention, content);
        });
    }
});
