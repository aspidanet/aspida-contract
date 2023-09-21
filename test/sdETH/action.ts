import { Signer, Contract, BigNumber, utils } from "ethers";
import { expect } from "chai";
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

import { getCurrentTime, increaseTime, mineManually } from "../utils/helper";

import { ActionTestData, UserState, Action, getState, getUserState, executeAndCalcExpected } from "./sdETH";

export async function supplyReward(dETH: Contract, sdETH: Contract) {
    const rewardAmount = Ether;
    await dETH.mint(sdETH.address, rewardAmount);

    expect(await sdETH.availableReward()).to.be.gte(rewardAmount);
}

export async function speedUp(dETH: Contract, sdETH: Contract) {
    const rewardRate = await sdETH.rewardRate();
    let availableReward = await sdETH.availableReward();
    if (availableReward.eq(ZERO)) {
        await dETH.mint(sdETH.address, Ether);
        availableReward = await sdETH.availableReward();
    }
    const currentDuration = await sdETH.duration();

    await sdETH._speedUpReward(availableReward, currentDuration);

    expect(await sdETH.rewardRate()).to.be.gt(rewardRate);
}

export async function halved(sdETH: Contract) {
    const rewardRate = await sdETH.rewardRate();
    const availableReward = await sdETH.availableReward();
    const currentDuration = await sdETH.duration();

    await sdETH._speedUpReward(availableReward.div(TWO), currentDuration);

    expect(await sdETH.rewardRate()).to.be.lte(rewardRate);
}

export async function stopDistribution(sdETH: Contract) {
    await sdETH._speedUpReward(ZERO, await sdETH.duration());

    expect(await sdETH.rewardRate()).to.be.equal(ZERO);
}

export async function nextPeriod(sdETH: Contract) {
    const periodFinish = await sdETH.periodFinish();
    const timestamp = utils.parseUnits((await getCurrentTime()).toString(), 0);
    const increaseTime = periodFinish.sub(timestamp);
    await mineManually(1, Number(increaseTime.toString()));

    const availableReward = await sdETH.availableReward();
    const currentDuration = await sdETH.duration();

    await sdETH._speedUpReward(availableReward, currentDuration);

    expect(await sdETH.periodFinish()).to.be.equal(periodFinish.add(increaseTime));
}

export async function changeState(dETH: Contract, sdETH: Contract, intervention: Record<string, boolean>) {
    if (intervention.hasOwnProperty("supplyReward") && intervention.supplyReward) {
        console.log("supplyReward");
        await supplyReward(dETH, sdETH);
    }

    if (intervention.hasOwnProperty("speedUp") && intervention.speedUp) {
        console.log("speedUp");
        await speedUp(dETH, sdETH);
    }

    if (intervention.hasOwnProperty("halved") && intervention.halved) {
        console.log("halved");
        await halved(sdETH);
    }

    if (intervention.hasOwnProperty("stopDistribution") && intervention.stopDistribution) {
        console.log("stopDistribution");
        await stopDistribution(sdETH);
    }

    if (intervention.hasOwnProperty("nextPeriod") && intervention.nextPeriod) {
        console.log("nextPeriod");
        await nextPeriod(sdETH);
    }
}

export async function testDepositRevert(actionTestData: ActionTestData, content: string) {
    describe(`Test sdETH(${content}) deposit test revert`, async () => {
        let owner: Signer;
        let manager: Signer;
        let pauseGuardian: Signer;
        let accounts: Signer[];

        let dETH: Contract;
        let sdETH: Contract;

        before(async function () {
            owner = actionTestData.owner;
            manager = actionTestData.manager;
            pauseGuardian = actionTestData.pauseGuardian;
            accounts = actionTestData.accounts;
            dETH = actionTestData.dETH;
            sdETH = actionTestData.sdETH;
        });

        it(`test deposit(${content}): insufficient allowance, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const dETHAmount = Ether;

            await dETH.connect(sender).approve(sdETH.address, dETHAmount.sub(ONE));

            await expect(sdETH.connect(sender).deposit(dETHAmount, receiverAddress)).to.be.revertedWith(
                "ERC20: insufficient allowance"
            );
        });

        it(`test deposit(${content}): Insufficient amount, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const dETHAmount = (await dETH.balanceOf(await sender.getAddress())).add(ONE);

            await dETH.connect(sender).approve(sdETH.address, MAX);

            await expect(sdETH.connect(sender).deposit(dETHAmount, receiverAddress)).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance"
            );
        });

        it(`test deposit(${content}): paused, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const dETHAmount = await dETH.balanceOf(await sender.getAddress());

            await sdETH._close();
            expect(await sdETH.paused()).to.be.equal(true);

            await expect(sdETH.connect(sender).deposit(dETHAmount, receiverAddress)).to.be.revertedWith(
                "_beforeTokenTransfer: token transfer while paused"
            );

            await sdETH._open();
        });
    });
}

export async function testDeposit(
    actionTestData: ActionTestData,
    intervention: Record<string, boolean>,
    content: string
) {
    describe(`Test sdETH(${content}) deposit test`, async () => {
        let owner: Signer;
        let manager: Signer;
        let pauseGuardian: Signer;
        let accounts: Signer[];

        let dETH: Contract;
        let sdETH: Contract;

        before(async function () {
            owner = actionTestData.owner;
            manager = actionTestData.manager;
            pauseGuardian = actionTestData.pauseGuardian;
            accounts = actionTestData.accounts;
            dETH = actionTestData.dETH;
            sdETH = actionTestData.sdETH;
        });

        it(`test deposit(${content}): intervention, success`, async () => {
            await changeState(dETH, sdETH, intervention);
        });

        it(`test deposit(${content}): sender = receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const sdETHOwner = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);

            const dETHAmount = Ether;
            const action: Action = {
                func: "deposit(uint256,address)",
                sender: sender,
                args: {
                    dETHAmount: dETHAmount,
                    sdETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: AddressZero,
                },
            };

            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test deposit(${content}): sender != receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const sdETHOwner = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);
            const dETHAmount = Ether;
            const action: Action = {
                func: "deposit(uint256,address)",
                sender: sender,
                args: {
                    dETHAmount: dETHAmount,
                    sdETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: AddressZero,
                },
            };
            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test deposit(${content}): input amount = 0, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const sdETHOwner = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);
            const dETHAmount = ZERO;
            const action: Action = {
                func: "deposit(uint256,address)",
                sender: sender,
                args: {
                    dETHAmount: dETHAmount,
                    sdETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: AddressZero,
                },
            };
            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });
    });
}

export async function testMintRevert(actionTestData: ActionTestData, content: string) {
    describe(`Test sdETH(${content}) mint test revert`, async () => {
        let owner: Signer;
        let manager: Signer;
        let pauseGuardian: Signer;
        let accounts: Signer[];

        let dETH: Contract;
        let sdETH: Contract;

        before(async function () {
            owner = actionTestData.owner;
            manager = actionTestData.manager;
            pauseGuardian = actionTestData.pauseGuardian;
            accounts = actionTestData.accounts;
            dETH = actionTestData.dETH;
            sdETH = actionTestData.sdETH;
        });

        it(`test mint(${content}): insufficient allowance, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const sdETHAmount = Ether;
            const dETHAmount = await sdETH.previewMint(sdETHAmount);

            await dETH.connect(sender).approve(sdETH.address, dETHAmount.sub(ONE));

            await expect(sdETH.connect(sender).mint(sdETHAmount, receiverAddress)).to.be.revertedWith(
                "ERC20: insufficient allowance"
            );
        });

        it(`test mint(${content}): Insufficient amount, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const dETHAmount = (await dETH.balanceOf(await sender.getAddress())).add(ONE);
            const sdETHAmount = await sdETH.previewWithdraw(dETHAmount);

            await dETH.connect(sender).approve(sdETH.address, MAX);

            await expect(sdETH.connect(sender).mint(sdETHAmount, receiverAddress)).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance"
            );
        });

        it(`test mint(${content}): paused, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const sdETHAmount = Ether;

            await sdETH._close();
            expect(await sdETH.paused()).to.be.equal(true);

            await expect(sdETH.connect(sender).mint(sdETHAmount, receiverAddress)).to.be.revertedWith(
                "_beforeTokenTransfer: token transfer while paused"
            );

            await sdETH._open();
        });
    });
}

export async function testMint(actionTestData: ActionTestData, intervention: Record<string, boolean>, content: string) {
    describe(`Test sdETH(${content}) mint test`, async () => {
        let owner: Signer;
        let manager: Signer;
        let pauseGuardian: Signer;
        let accounts: Signer[];

        let dETH: Contract;
        let sdETH: Contract;

        before(async function () {
            owner = actionTestData.owner;
            manager = actionTestData.manager;
            pauseGuardian = actionTestData.pauseGuardian;
            accounts = actionTestData.accounts;
            dETH = actionTestData.dETH;
            sdETH = actionTestData.sdETH;
        });

        it(`test mint(${content}): intervention, success`, async () => {
            await changeState(dETH, sdETH, intervention);
        });

        it(`test mint(${content}): sender = receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const sdETHOwner = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);

            const sdETHAmount = Ether;
            const action: Action = {
                func: "mint(uint256,address)",
                sender: sender,
                args: {
                    dETHAmount: ZERO,
                    sdETHAmount: sdETHAmount,
                    receiver: receiverAddress,
                    owner: AddressZero,
                },
            };

            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test mint(${content}): sender != receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const sdETHOwner = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);
            const sdETHAmount = Ether;
            const action: Action = {
                func: "mint(uint256,address)",
                sender: sender,
                args: {
                    dETHAmount: ZERO,
                    sdETHAmount: sdETHAmount,
                    receiver: receiverAddress,
                    owner: AddressZero,
                },
            };
            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test mint(${content}): input amount = 0, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const sdETHOwner = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);
            const sdETHAmount = ZERO;
            const action: Action = {
                func: "mint(uint256,address)",
                sender: sender,
                args: {
                    dETHAmount: ZERO,
                    sdETHAmount: sdETHAmount,
                    receiver: receiverAddress,
                    owner: AddressZero,
                },
            };
            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });
    });
}

export async function testWithdrawRevert(actionTestData: ActionTestData, content: string) {
    describe(`Test sdETH(${content}) withdraw test revert`, async () => {
        let owner: Signer;
        let manager: Signer;
        let pauseGuardian: Signer;
        let accounts: Signer[];

        let dETH: Contract;
        let sdETH: Contract;

        before(async function () {
            owner = actionTestData.owner;
            manager = actionTestData.manager;
            pauseGuardian = actionTestData.pauseGuardian;
            accounts = actionTestData.accounts;
            dETH = actionTestData.dETH;
            sdETH = actionTestData.sdETH;
        });

        it(`test withdraw(${content}): insufficient allowance, expected revert`, async () => {
            const sender = accounts[2];
            const receiver = sender;
            const sdETHOwner = accounts[0];
            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();
            const maxWithdraw = await sdETH.maxWithdraw(sdETHOwnerAddress);
            const withdrawAmount = maxWithdraw;

            const balance = await sdETH.balanceOf(sdETHOwnerAddress);
            await sdETH.connect(sdETHOwner).approve(await sender.getAddress(), balance.sub(ONE));

            await expect(
                sdETH.connect(sender).withdraw(withdrawAmount, receiverAddress, sdETHOwnerAddress)
            ).to.be.revertedWith("ERC20: insufficient allowance");
        });

        it(`test withdraw(${content}): Insufficient amount, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const sdETHOwner = accounts[0];
            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxWithdraw = await sdETH.maxWithdraw(sdETHOwnerAddress);
            const withdrawAmount = maxWithdraw.add(ONE);

            await sdETH.connect(sdETHOwner).approve(await sender.getAddress(), MAX);

            await expect(
                sdETH.connect(sender).withdraw(withdrawAmount, receiverAddress, sdETHOwnerAddress)
            ).to.be.revertedWith("ERC4626: withdraw more than max");
        });

        it(`test withdraw(${content}): Insufficient amount, sender = sdETHOwner, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const sdETHOwner = sender;
            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxWithdraw = await sdETH.maxWithdraw(sdETHOwnerAddress);
            const withdrawAmount = maxWithdraw.add(ONE);

            await expect(
                sdETH.connect(sender).withdraw(withdrawAmount, receiverAddress, sdETHOwnerAddress)
            ).to.be.revertedWith("ERC4626: withdraw more than max");
        });

        it(`test withdraw(${content}): paused, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const sdETHOwner = sender;
            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxWithdraw = await sdETH.maxWithdraw(sdETHOwnerAddress);
            const withdrawAmount = maxWithdraw;

            await sdETH._close();
            expect(await sdETH.paused()).to.be.equal(true);

            await expect(
                sdETH.connect(sender).withdraw(withdrawAmount, receiverAddress, sdETHOwnerAddress)
            ).to.be.revertedWith("_beforeTokenTransfer: token transfer while paused");

            await sdETH._open();
        });
    });
}

export async function testWithdraw(
    actionTestData: ActionTestData,
    intervention: Record<string, boolean>,
    content: string
) {
    describe(`Test sdETH(${content}) withdraw test`, async () => {
        let owner: Signer;
        let manager: Signer;
        let pauseGuardian: Signer;
        let accounts: Signer[];

        let dETH: Contract;
        let sdETH: Contract;

        before(async function () {
            owner = actionTestData.owner;
            manager = actionTestData.manager;
            pauseGuardian = actionTestData.pauseGuardian;
            accounts = actionTestData.accounts;
            dETH = actionTestData.dETH;
            sdETH = actionTestData.sdETH;
        });

        it(`test withdraw(${content}): intervention, success`, async () => {
            await changeState(dETH, sdETH, intervention);
        });

        it(`test withdraw(${content}): sender = receiver, sender = sdETHOwner, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const sdETHOwner = sender;
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);

            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxWithdraw = await sdETH.maxWithdraw(sdETHOwnerAddress);
            const withdrawAmount = maxWithdraw.div(TWO);

            const action: Action = {
                func: "withdraw(uint256,address,address)",
                sender: sender,
                args: {
                    dETHAmount: withdrawAmount,
                    sdETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: sdETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test withdraw(${content}): sender != receiver, sender = sdETHOwner, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const sdETHOwner = sender;
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);

            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxWithdraw = await sdETH.maxWithdraw(sdETHOwnerAddress);
            const withdrawAmount = maxWithdraw.div(TWO);

            const action: Action = {
                func: "withdraw(uint256,address,address)",
                sender: sender,
                args: {
                    dETHAmount: withdrawAmount,
                    sdETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: sdETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test withdraw(${content}): sender != receiver, receiver = sdETHOwner, success`, async () => {
            const sender = accounts[1];
            const receiver = accounts[0];
            const sdETHOwner = receiver;
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);

            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxWithdraw = await sdETH.maxWithdraw(sdETHOwnerAddress);
            const withdrawAmount = maxWithdraw.div(TWO);

            await sdETH.connect(sdETHOwner).approve(await sender.getAddress(), MAX);

            const action: Action = {
                func: "withdraw(uint256,address,address)",
                sender: sender,
                args: {
                    dETHAmount: withdrawAmount,
                    sdETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: sdETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test withdraw(${content}): sender = receiver, receiver != sdETHOwner, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const sdETHOwner = accounts[1];
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);

            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxWithdraw = await sdETH.maxWithdraw(sdETHOwnerAddress);
            const withdrawAmount = maxWithdraw.div(TWO);

            await sdETH.connect(sdETHOwner).approve(await sender.getAddress(), MAX);

            const action: Action = {
                func: "withdraw(uint256,address,address)",
                sender: sender,
                args: {
                    dETHAmount: withdrawAmount,
                    sdETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: sdETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test withdraw(${content}): sender != receiver, sender != sdETHOwner, receiver != sdETHOwner, success`, async () => {
            const sender = accounts[3];
            const receiver = accounts[1];
            const sdETHOwner = accounts[0];
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);

            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxWithdraw = await sdETH.maxWithdraw(sdETHOwnerAddress);
            const withdrawAmount = maxWithdraw.div(TWO);

            await sdETH.connect(sdETHOwner).approve(await sender.getAddress(), MAX);

            const action: Action = {
                func: "withdraw(uint256,address,address)",
                sender: sender,
                args: {
                    dETHAmount: withdrawAmount,
                    sdETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: sdETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });
    });
}

export async function testRedeemRevert(actionTestData: ActionTestData, content: string) {
    describe(`Test sdETH(${content}) redeem test revert`, () => {
        let owner: Signer;
        let manager: Signer;
        let pauseGuardian: Signer;
        let accounts: Signer[];

        let dETH: Contract;
        let sdETH: Contract;

        before(async function () {
            owner = actionTestData.owner;
            manager = actionTestData.manager;
            pauseGuardian = actionTestData.pauseGuardian;
            accounts = actionTestData.accounts;
            dETH = actionTestData.dETH;
            sdETH = actionTestData.sdETH;
        });

        it(`test redeem(${content}): insufficient allowance, expected revert`, async () => {
            const sender = accounts[2];
            const receiver = sender;
            const sdETHOwner = accounts[0];
            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();
            const maxRedeem = await sdETH.maxRedeem(sdETHOwnerAddress);
            const redeemAmount = maxRedeem;

            await sdETH.connect(sdETHOwner).approve(await sender.getAddress(), redeemAmount.sub(ONE));

            await expect(
                sdETH.connect(sender).redeem(redeemAmount, receiverAddress, sdETHOwnerAddress)
            ).to.be.revertedWith("ERC20: insufficient allowance");
        });

        it(`test redeem(${content}): Insufficient amount, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const sdETHOwner = accounts[0];
            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxRedeem = await sdETH.maxRedeem(sdETHOwnerAddress);
            const redeemAmount = maxRedeem.add(ONE);

            await sdETH.connect(sdETHOwner).approve(await sender.getAddress(), MAX);

            await expect(
                sdETH.connect(sender).redeem(redeemAmount, receiverAddress, sdETHOwnerAddress)
            ).to.be.revertedWith("ERC4626: redeem more than max");
        });

        it(`test redeem(${content}): Insufficient amount, sender = sdETHOwner, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const sdETHOwner = sender;
            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxRedeem = await sdETH.maxRedeem(sdETHOwnerAddress);
            const redeemAmount = maxRedeem.add(ONE);

            await expect(
                sdETH.connect(sender).redeem(redeemAmount, receiverAddress, sdETHOwnerAddress)
            ).to.be.revertedWith("ERC4626: redeem more than max");
        });

        it(`test redeem(${content}): paused, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const sdETHOwner = sender;
            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxRedeem = await sdETH.maxRedeem(sdETHOwnerAddress);
            const redeemAmount = maxRedeem;

            await sdETH._close();
            expect(await sdETH.paused()).to.be.equal(true);

            await expect(
                sdETH.connect(sender).redeem(redeemAmount, receiverAddress, sdETHOwnerAddress)
            ).to.be.revertedWith("_beforeTokenTransfer: token transfer while paused");

            await sdETH._open();
        });
    });
}

export async function testRedeem(
    actionTestData: ActionTestData,
    intervention: Record<string, boolean>,
    content: string
) {
    describe(`Test sdETH(${content}) redeem test`, async () => {
        let owner: Signer;
        let manager: Signer;
        let pauseGuardian: Signer;
        let accounts: Signer[];

        let dETH: Contract;
        let sdETH: Contract;

        before(async function () {
            owner = actionTestData.owner;
            manager = actionTestData.manager;
            pauseGuardian = actionTestData.pauseGuardian;
            accounts = actionTestData.accounts;
            dETH = actionTestData.dETH;
            sdETH = actionTestData.sdETH;
        });

        it(`test redeem(${content}): intervention, success`, async () => {
            await changeState(dETH, sdETH, intervention);
        });

        it(`test redeem(${content}): sender = receiver, sender = sdETHOwner, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const sdETHOwner = sender;
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);

            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxRedeem = await sdETH.maxRedeem(sdETHOwnerAddress);
            const redeemAmount = maxRedeem.div(TWO);

            const action: Action = {
                func: "redeem(uint256,address,address)",
                sender: sender,
                args: {
                    dETHAmount: ZERO,
                    sdETHAmount: redeemAmount,
                    receiver: receiverAddress,
                    owner: sdETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test redeem(${content}): sender != receiver, sender = sdETHOwner, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const sdETHOwner = sender;
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);

            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxRedeem = await sdETH.maxRedeem(sdETHOwnerAddress);
            const redeemAmount = maxRedeem.div(TWO);

            const action: Action = {
                func: "redeem(uint256,address,address)",
                sender: sender,
                args: {
                    dETHAmount: ZERO,
                    sdETHAmount: redeemAmount,
                    receiver: receiverAddress,
                    owner: sdETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test redeem(${content}): sender != receiver, receiver = sdETHOwner, success`, async () => {
            const sender = accounts[1];
            const receiver = accounts[0];
            const sdETHOwner = receiver;
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);

            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxRedeem = await sdETH.maxRedeem(sdETHOwnerAddress);
            const redeemAmount = maxRedeem.div(TWO);

            await sdETH.connect(sdETHOwner).approve(await sender.getAddress(), MAX);

            const action: Action = {
                func: "redeem(uint256,address,address)",
                sender: sender,
                args: {
                    dETHAmount: ZERO,
                    sdETHAmount: redeemAmount,
                    receiver: receiverAddress,
                    owner: sdETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test redeem(${content}): sender = receiver, receiver != sdETHOwner, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const sdETHOwner = accounts[1];
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);

            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxRedeem = await sdETH.maxRedeem(sdETHOwnerAddress);
            const redeemAmount = maxRedeem.div(TWO);

            await sdETH.connect(sdETHOwner).approve(await sender.getAddress(), MAX);

            const action: Action = {
                func: "redeem(uint256,address,address)",
                sender: sender,
                args: {
                    dETHAmount: ZERO,
                    sdETHAmount: redeemAmount,
                    receiver: receiverAddress,
                    owner: sdETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test redeem(${content}): sender != receiver, sender != sdETHOwner, receiver != sdETHOwner, success`, async () => {
            const sender = accounts[3];
            const receiver = accounts[1];
            const sdETHOwner = accounts[0];
            const preState = await getState(sdETH, sender, receiver, sdETHOwner);

            const receiverAddress = await receiver.getAddress();
            const sdETHOwnerAddress = await sdETHOwner.getAddress();

            const maxRedeem = await sdETH.maxRedeem(sdETHOwnerAddress);
            const redeemAmount = maxRedeem.div(TWO);

            await sdETH.connect(sdETHOwner).approve(await sender.getAddress(), MAX);

            const action: Action = {
                func: "redeem(uint256,address,address)",
                sender: sender,
                args: {
                    dETHAmount: ZERO,
                    sdETHAmount: redeemAmount,
                    receiver: receiverAddress,
                    owner: sdETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(sdETH, preState, action);
            const postState = await getState(sdETH, sender, receiver, sdETHOwner);
            expect(expected).to.deep.equal(postState);
        });
    });
}
