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

import { ActionTestData, UserState, getUserState } from "./corePrimary";
import {
    transfertoEth,
    testSubmitRevert,
    testSubmit,
    testWithdrawRevert,
    testWithdraw,
    testClaimRevert,
    testClaimByAddress,
    testClaimByQueueId,
} from "./action";

describe("Test CorePrimary unit test", () => {
    let initData: ActionTestData;
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let aETH: Contract;
    let saETH: Contract;
    let CorePrimary: Contract;

    async function init() {
        initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        aETH = initData.aETH;
        saETH = initData.saETH;
        CorePrimary = initData.CorePrimary;

        await aETH._addManager(await owner.getAddress());
    }

    before(async function () {
        await init();
        const mintAmount = utils.parseEther("10000");
        for (let index = 0; index < accounts.length; index++) {
            const accountAddr = await accounts[index].getAddress();
            // await aETH.mint(accountAddr, mintAmount);
            await aETH.connect(accounts[index]).approve(CorePrimary.address, MAX);
            await saETH.connect(accounts[index]).approve(CorePrimary.address, MAX);
        }
    });

    it("test submit: revert", async () => {
        await testSubmitRevert(initData);
    });

    it("test submit: reserveRatio = 0", async () => {
        await testSubmit(initData, {}, "reserveRatio = 0");
    });

    it("test withdraw: revert", async () => {
        await testWithdrawRevert(initData);
    });

    it("test withdraw: reserveRatio = 0", async () => {
        await testWithdraw(initData, {}, "reserveRatio = 0");
    });

    it("test: reserveRatio = 100%", async () => {
        await testSubmit(initData, { reserveRatio: Ether }, "reserveRatio = 100%");
        await testWithdraw(initData, {}, "reserveRatio = 100%");
    });

    it("test Claim: revert", async () => {
        await testClaimRevert(initData);
    });

    it("test Claim: Sufficient amount", async () => {
        await testClaimByQueueId(initData, { supplyClaim: true }, "Sufficient amount");
        await testClaimByAddress(initData, { supplyClaim: true }, "Sufficient amount");
    });

    it("test receive: transfertoEth", async () => {
        await transfertoEth(owner, CorePrimary, Ether);
    });

    const times = 20;
    const enables = [true, false];
    const actions = [testSubmit, testWithdraw, testClaimByAddress, testClaimByQueueId];

    for (let index = 0; index <= times; index++) {
        it("test random test", async () => {
            if (index == times) {
                await testClaimByAddress(initData, {}, "Claim");
                return;
            }
            const intervention = {
                reserveRatio: utils.parseEther((randomRange(0, 100) / 100).toString()),
                supplyClaim: enables[randomRange(0, 1)],
            };
            const content = `(random:${index})`;
            await actions[randomRange(0, actions.length)](initData, intervention, content);
        });
    }
});
