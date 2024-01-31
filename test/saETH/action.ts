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

import { ActionTestData, UserState, Action, getState, getUserState, executeAndCalcExpected } from "./saETH";

export async function supplyReward(saETH: Contract) {
    const aETH = await ethers.getContractAt("aETH", await saETH.asset());
    const rewardAmount = Ether;
    await aETH.mint(saETH.address, rewardAmount);
    await saETH.mint(ZERO, await saETH.owner());

    expect(await saETH.availableReward()).to.be.gte(rewardAmount);
}

export async function speedUp(saETH: Contract) {
    const rewardRate = await saETH.rewardRate();
    const currentDuration = await saETH.duration();
    const constRewardRate = rewardRate.eq(ZERO) ? Ether.div(currentDuration) : rewardRate;
    const expectedReward = constRewardRate.mul(TWO).mul(currentDuration);

    const aETH = await ethers.getContractAt("aETH", await saETH.asset());
    const totalUnderlying = await aETH.balanceOf(saETH.address);
    const totalAssets = await saETH.totalAssets();
    expect(totalUnderlying).to.be.gte(totalAssets);

    const expectedAvailableReward = totalUnderlying.sub(totalAssets);
    const supplyReward = expectedReward.sub(expectedAvailableReward);
    if (supplyReward.gt(ZERO)) await aETH.mint(saETH.address, supplyReward);

    const reward = supplyReward.add(expectedAvailableReward).sub(constRewardRate.mul(TWO));
    const availableReward = await saETH.availableReward();
    expect(availableReward).to.be.gt(reward);

    await saETH._speedUpReward(reward, currentDuration);

    expect(await saETH.rewardRate()).to.be.gt(rewardRate);
}

export async function halved(saETH: Contract) {
    const rewardRate = await saETH.rewardRate();
    const availableReward = await saETH.availableReward();
    const currentDuration = await saETH.duration();

    await saETH._speedUpReward(availableReward.div(TWO), currentDuration);
}

export async function stopDistribution(saETH: Contract) {
    await saETH._speedUpReward(ZERO, await saETH.duration());

    expect(await saETH.rewardRate()).to.be.equal(ZERO);
}

export async function nextPeriod(saETH: Contract) {
    const periodFinish = await saETH.periodFinish();
    const timestamp = utils.parseUnits((await getCurrentTime()).toString(), 0);
    const increaseTime = periodFinish.sub(timestamp);
    await mineManually(1, Number(increaseTime.toString()));

    const rewardAmount = Ether;
    const aETH = await ethers.getContractAt("aETH", await saETH.asset());
    await aETH.mint(saETH.address, rewardAmount);

    const currentDuration = await saETH.duration();
    await saETH._speedUpReward(rewardAmount, currentDuration);

    const currentPeriodFinish = await saETH.periodFinish();

    expect(currentPeriodFinish).to.be.equal(
        utils.parseUnits((await getCurrentTime()).toString(), 0).add(currentDuration)
    );
    expect(currentPeriodFinish).to.be.gte(periodFinish.add(increaseTime));
}

export async function changeState(saETH: Contract, intervention: any) {
    if (intervention.hasOwnProperty("supplyReward") && intervention.supplyReward) {
        console.log("supplyReward");
        await supplyReward(saETH);
    }

    if (intervention.hasOwnProperty("speedUp") && intervention.speedUp) {
        console.log("speedUp");
        await speedUp(saETH);
    }

    if (intervention.hasOwnProperty("halved") && intervention.halved) {
        console.log("halved");
        await halved(saETH);
    }

    if (intervention.hasOwnProperty("stopDistribution") && intervention.stopDistribution) {
        console.log("stopDistribution");
        await stopDistribution(saETH);
    }

    if (intervention.hasOwnProperty("nextPeriod") && intervention.nextPeriod) {
        console.log("nextPeriod");
        await nextPeriod(saETH);
    }
}

export async function testDepositRevert(actionTestData: ActionTestData, content: string) {
    describe(`Test saETH(${content}) deposit test revert`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const aETH: Contract = actionTestData.aETH;
        const saETH: Contract = actionTestData.saETH;

        it(`test deposit(${content}): insufficient allowance, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const aETHAmount = Ether;

            await aETH.connect(sender).approve(saETH.address, aETHAmount.sub(ONE));

            await expect(saETH.connect(sender).deposit(aETHAmount, receiverAddress)).to.be.revertedWith(
                "ERC20: insufficient allowance"
            );
        });

        it(`test deposit(${content}): Insufficient amount, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const aETHAmount = (await aETH.balanceOf(await sender.getAddress())).add(ONE);

            await aETH.connect(sender).approve(saETH.address, MAX);

            await expect(saETH.connect(sender).deposit(aETHAmount, receiverAddress)).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance"
            );
        });

        it(`test deposit(${content}): paused, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const aETHAmount = await aETH.balanceOf(await sender.getAddress());

            await saETH._close();
            expect(await saETH.paused()).to.be.equal(true);

            await expect(saETH.connect(sender).deposit(aETHAmount, receiverAddress)).to.be.revertedWith(
                "_beforeTokenTransfer: token transfer while paused"
            );

            await saETH._open();
        });
    });
}

export async function testDeposit(actionTestData: ActionTestData, intervention: any, content: string) {
    describe(`Test saETH(${content}) deposit test`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const saETH: Contract = actionTestData.saETH;

        it(`test deposit(${content}): intervention, success`, async () => {
            await changeState(saETH, intervention);
        });

        it(`test deposit(${content}): sender = receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const saETHOwner = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(saETH, sender, receiver, saETHOwner);

            const aETHAmount = Ether;
            const action: Action = {
                func: "deposit(uint256,address)",
                sender: sender,
                args: {
                    aETHAmount: aETHAmount,
                    saETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: AddressZero,
                },
            };

            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test deposit(${content}): sender != receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const saETHOwner = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(saETH, sender, receiver, saETHOwner);
            const aETHAmount = Ether;
            const action: Action = {
                func: "deposit(uint256,address)",
                sender: sender,
                args: {
                    aETHAmount: aETHAmount,
                    saETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: AddressZero,
                },
            };
            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test deposit(${content}): input amount = 0, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const saETHOwner = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(saETH, sender, receiver, saETHOwner);
            const aETHAmount = ZERO;
            const action: Action = {
                func: "deposit(uint256,address)",
                sender: sender,
                args: {
                    aETHAmount: aETHAmount,
                    saETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: AddressZero,
                },
            };
            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });
    });
}

export async function testMintRevert(actionTestData: ActionTestData, content: string) {
    describe(`Test saETH(${content}) mint test revert`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const aETH: Contract = actionTestData.aETH;
        const saETH: Contract = actionTestData.saETH;

        it(`test mint(${content}): insufficient allowance, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const saETHAmount = Ether;
            const aETHAmount = await saETH.previewMint(saETHAmount);

            await aETH.connect(sender).approve(saETH.address, aETHAmount.sub(ONE));

            await expect(saETH.connect(sender).mint(saETHAmount, receiverAddress)).to.be.revertedWith(
                "ERC20: insufficient allowance"
            );
        });

        it(`test mint(${content}): Insufficient amount, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const aETHAmount = (await aETH.balanceOf(await sender.getAddress())).add(ONE);
            const saETHAmount = await saETH.previewWithdraw(aETHAmount);

            await aETH.connect(sender).approve(saETH.address, MAX);

            await expect(saETH.connect(sender).mint(saETHAmount, receiverAddress)).to.be.revertedWith(
                "ERC20: transfer amount exceeds balance"
            );
        });

        it(`test mint(${content}): paused, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const saETHAmount = Ether;

            await saETH._close();
            expect(await saETH.paused()).to.be.equal(true);

            await expect(saETH.connect(sender).mint(saETHAmount, receiverAddress)).to.be.revertedWith(
                "_beforeTokenTransfer: token transfer while paused"
            );

            await saETH._open();
        });
    });
}

export async function testMint(actionTestData: ActionTestData, intervention: any, content: string) {
    describe(`Test saETH(${content}) mint test`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const saETH: Contract = actionTestData.saETH;

        it(`test mint(${content}): intervention, success`, async () => {
            await changeState(saETH, intervention);
        });

        it(`test mint(${content}): sender = receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const saETHOwner = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(saETH, sender, receiver, saETHOwner);

            const saETHAmount = Ether;
            const action: Action = {
                func: "mint(uint256,address)",
                sender: sender,
                args: {
                    aETHAmount: ZERO,
                    saETHAmount: saETHAmount,
                    receiver: receiverAddress,
                    owner: AddressZero,
                },
            };

            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test mint(${content}): sender != receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const saETHOwner = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(saETH, sender, receiver, saETHOwner);
            const saETHAmount = Ether;
            const action: Action = {
                func: "mint(uint256,address)",
                sender: sender,
                args: {
                    aETHAmount: ZERO,
                    saETHAmount: saETHAmount,
                    receiver: receiverAddress,
                    owner: AddressZero,
                },
            };
            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test mint(${content}): input amount = 0, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const saETHOwner = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(saETH, sender, receiver, saETHOwner);
            const saETHAmount = ZERO;
            const action: Action = {
                func: "mint(uint256,address)",
                sender: sender,
                args: {
                    aETHAmount: ZERO,
                    saETHAmount: saETHAmount,
                    receiver: receiverAddress,
                    owner: AddressZero,
                },
            };
            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });
    });
}

export async function testWithdrawRevert(actionTestData: ActionTestData, content: string) {
    describe(`Test saETH(${content}) withdraw test revert`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const saETH: Contract = actionTestData.saETH;

        it(`test withdraw(${content}): insufficient allowance, expected revert`, async () => {
            const sender = accounts[2];
            const receiver = sender;
            const saETHOwner = accounts[0];
            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();
            const maxWithdraw = await saETH.maxWithdraw(saETHOwnerAddress);
            const withdrawAmount = maxWithdraw;

            const balance = await saETH.balanceOf(saETHOwnerAddress);
            await saETH.connect(saETHOwner).approve(await sender.getAddress(), balance.sub(ONE));

            await expect(
                saETH.connect(sender).withdraw(withdrawAmount, receiverAddress, saETHOwnerAddress)
            ).to.be.revertedWith("ERC20: insufficient allowance");
        });

        it(`test withdraw(${content}): Insufficient amount, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const saETHOwner = accounts[0];
            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxWithdraw = await saETH.maxWithdraw(saETHOwnerAddress);
            const withdrawAmount = maxWithdraw.add(ONE);

            await saETH.connect(saETHOwner).approve(await sender.getAddress(), MAX);

            await expect(
                saETH.connect(sender).withdraw(withdrawAmount, receiverAddress, saETHOwnerAddress)
            ).to.be.revertedWith("ERC4626: withdraw more than max");
        });

        it(`test withdraw(${content}): Insufficient amount, sender = saETHOwner, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const saETHOwner = sender;
            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxWithdraw = await saETH.maxWithdraw(saETHOwnerAddress);
            const withdrawAmount = maxWithdraw.add(ONE);

            await expect(
                saETH.connect(sender).withdraw(withdrawAmount, receiverAddress, saETHOwnerAddress)
            ).to.be.revertedWith("ERC4626: withdraw more than max");
        });

        it(`test withdraw(${content}): paused, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const saETHOwner = sender;
            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxWithdraw = await saETH.maxWithdraw(saETHOwnerAddress);
            const withdrawAmount = maxWithdraw;

            await saETH._close();
            expect(await saETH.paused()).to.be.equal(true);

            await expect(
                saETH.connect(sender).withdraw(withdrawAmount, receiverAddress, saETHOwnerAddress)
            ).to.be.revertedWith("_beforeTokenTransfer: token transfer while paused");

            await saETH._open();
        });
    });
}

export async function testWithdraw(actionTestData: ActionTestData, intervention: any, content: string) {
    describe(`Test saETH(${content}) withdraw test`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const saETH: Contract = actionTestData.saETH;

        it(`test withdraw(${content}): intervention, success`, async () => {
            await changeState(saETH, intervention);
        });

        it(`test withdraw(${content}): sender = receiver, sender = saETHOwner, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const saETHOwner = sender;
            const preState = await getState(saETH, sender, receiver, saETHOwner);

            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxWithdraw = await saETH.maxWithdraw(saETHOwnerAddress);
            const withdrawAmount = maxWithdraw.div(TWO);

            const action: Action = {
                func: "withdraw(uint256,address,address)",
                sender: sender,
                args: {
                    aETHAmount: withdrawAmount,
                    saETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: saETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test withdraw(${content}): sender != receiver, sender = saETHOwner, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const saETHOwner = sender;
            const preState = await getState(saETH, sender, receiver, saETHOwner);

            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxWithdraw = await saETH.maxWithdraw(saETHOwnerAddress);
            const withdrawAmount = maxWithdraw.div(TWO);

            const action: Action = {
                func: "withdraw(uint256,address,address)",
                sender: sender,
                args: {
                    aETHAmount: withdrawAmount,
                    saETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: saETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test withdraw(${content}): sender != receiver, receiver = saETHOwner, success`, async () => {
            const sender = accounts[1];
            const receiver = accounts[0];
            const saETHOwner = receiver;
            const preState = await getState(saETH, sender, receiver, saETHOwner);

            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxWithdraw = await saETH.maxWithdraw(saETHOwnerAddress);
            const withdrawAmount = maxWithdraw.div(TWO);

            await saETH.connect(saETHOwner).approve(await sender.getAddress(), MAX);

            const action: Action = {
                func: "withdraw(uint256,address,address)",
                sender: sender,
                args: {
                    aETHAmount: withdrawAmount,
                    saETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: saETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test withdraw(${content}): sender = receiver, receiver != saETHOwner, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const saETHOwner = accounts[1];
            const preState = await getState(saETH, sender, receiver, saETHOwner);

            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxWithdraw = await saETH.maxWithdraw(saETHOwnerAddress);
            const withdrawAmount = maxWithdraw.div(TWO);

            await saETH.connect(saETHOwner).approve(await sender.getAddress(), MAX);

            const action: Action = {
                func: "withdraw(uint256,address,address)",
                sender: sender,
                args: {
                    aETHAmount: withdrawAmount,
                    saETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: saETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test withdraw(${content}): sender != receiver, sender != saETHOwner, receiver != saETHOwner, success`, async () => {
            const sender = accounts[3];
            const receiver = accounts[1];
            const saETHOwner = accounts[0];
            const preState = await getState(saETH, sender, receiver, saETHOwner);

            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxWithdraw = await saETH.maxWithdraw(saETHOwnerAddress);
            const withdrawAmount = maxWithdraw.div(TWO);

            await saETH.connect(saETHOwner).approve(await sender.getAddress(), MAX);

            const action: Action = {
                func: "withdraw(uint256,address,address)",
                sender: sender,
                args: {
                    aETHAmount: withdrawAmount,
                    saETHAmount: ZERO,
                    receiver: receiverAddress,
                    owner: saETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });
    });
}

export async function testRedeemRevert(actionTestData: ActionTestData, content: string) {
    describe(`Test saETH(${content}) redeem test revert`, () => {
        const accounts: Signer[] = actionTestData.accounts;
        const saETH: Contract = actionTestData.saETH;

        it(`test redeem(${content}): insufficient allowance, expected revert`, async () => {
            const sender = accounts[2];
            const receiver = sender;
            const saETHOwner = accounts[0];
            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();
            const maxRedeem = await saETH.maxRedeem(saETHOwnerAddress);
            const redeemAmount = maxRedeem;

            await saETH.connect(saETHOwner).approve(await sender.getAddress(), redeemAmount.sub(ONE));

            await expect(
                saETH.connect(sender).redeem(redeemAmount, receiverAddress, saETHOwnerAddress)
            ).to.be.revertedWith("ERC20: insufficient allowance");
        });

        it(`test redeem(${content}): Insufficient amount, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const saETHOwner = accounts[0];
            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxRedeem = await saETH.maxRedeem(saETHOwnerAddress);
            const redeemAmount = maxRedeem.add(ONE);

            await saETH.connect(saETHOwner).approve(await sender.getAddress(), MAX);

            await expect(
                saETH.connect(sender).redeem(redeemAmount, receiverAddress, saETHOwnerAddress)
            ).to.be.revertedWith("ERC4626: redeem more than max");
        });

        it(`test redeem(${content}): Insufficient amount, sender = saETHOwner, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const saETHOwner = sender;
            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxRedeem = await saETH.maxRedeem(saETHOwnerAddress);
            const redeemAmount = maxRedeem.add(ONE);

            await expect(
                saETH.connect(sender).redeem(redeemAmount, receiverAddress, saETHOwnerAddress)
            ).to.be.revertedWith("ERC4626: redeem more than max");
        });

        it(`test redeem(${content}): paused, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const saETHOwner = sender;
            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxRedeem = await saETH.maxRedeem(saETHOwnerAddress);
            const redeemAmount = maxRedeem;

            await saETH._close();
            expect(await saETH.paused()).to.be.equal(true);

            await expect(
                saETH.connect(sender).redeem(redeemAmount, receiverAddress, saETHOwnerAddress)
            ).to.be.revertedWith("_beforeTokenTransfer: token transfer while paused");

            await saETH._open();
        });
    });
}

export async function testRedeem(actionTestData: ActionTestData, intervention: any, content: string) {
    describe(`Test saETH(${content}) redeem test`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const saETH: Contract = actionTestData.saETH;

        it(`test redeem(${content}): intervention, success`, async () => {
            await changeState(saETH, intervention);
        });

        it(`test redeem(${content}): sender = receiver, sender = saETHOwner, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const saETHOwner = sender;
            const preState = await getState(saETH, sender, receiver, saETHOwner);

            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxRedeem = await saETH.maxRedeem(saETHOwnerAddress);
            const redeemAmount = maxRedeem.div(TWO);

            const action: Action = {
                func: "redeem(uint256,address,address)",
                sender: sender,
                args: {
                    aETHAmount: ZERO,
                    saETHAmount: redeemAmount,
                    receiver: receiverAddress,
                    owner: saETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test redeem(${content}): sender != receiver, sender = saETHOwner, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const saETHOwner = sender;
            const preState = await getState(saETH, sender, receiver, saETHOwner);

            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxRedeem = await saETH.maxRedeem(saETHOwnerAddress);
            const redeemAmount = maxRedeem.div(TWO);

            const action: Action = {
                func: "redeem(uint256,address,address)",
                sender: sender,
                args: {
                    aETHAmount: ZERO,
                    saETHAmount: redeemAmount,
                    receiver: receiverAddress,
                    owner: saETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test redeem(${content}): sender != receiver, receiver = saETHOwner, success`, async () => {
            const sender = accounts[1];
            const receiver = accounts[0];
            const saETHOwner = receiver;
            const preState = await getState(saETH, sender, receiver, saETHOwner);

            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxRedeem = await saETH.maxRedeem(saETHOwnerAddress);
            const redeemAmount = maxRedeem.div(TWO);

            await saETH.connect(saETHOwner).approve(await sender.getAddress(), MAX);

            const action: Action = {
                func: "redeem(uint256,address,address)",
                sender: sender,
                args: {
                    aETHAmount: ZERO,
                    saETHAmount: redeemAmount,
                    receiver: receiverAddress,
                    owner: saETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test redeem(${content}): sender = receiver, receiver != saETHOwner, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const saETHOwner = accounts[1];
            const preState = await getState(saETH, sender, receiver, saETHOwner);

            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxRedeem = await saETH.maxRedeem(saETHOwnerAddress);
            const redeemAmount = maxRedeem.div(TWO);

            await saETH.connect(saETHOwner).approve(await sender.getAddress(), MAX);

            const action: Action = {
                func: "redeem(uint256,address,address)",
                sender: sender,
                args: {
                    aETHAmount: ZERO,
                    saETHAmount: redeemAmount,
                    receiver: receiverAddress,
                    owner: saETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });

        it(`test redeem(${content}): sender != receiver, sender != saETHOwner, receiver != saETHOwner, success`, async () => {
            const sender = accounts[3];
            const receiver = accounts[1];
            const saETHOwner = accounts[0];
            const preState = await getState(saETH, sender, receiver, saETHOwner);

            const receiverAddress = await receiver.getAddress();
            const saETHOwnerAddress = await saETHOwner.getAddress();

            const maxRedeem = await saETH.maxRedeem(saETHOwnerAddress);
            const redeemAmount = maxRedeem.div(TWO);

            await saETH.connect(saETHOwner).approve(await sender.getAddress(), MAX);

            const action: Action = {
                func: "redeem(uint256,address,address)",
                sender: sender,
                args: {
                    aETHAmount: ZERO,
                    saETHAmount: redeemAmount,
                    receiver: receiverAddress,
                    owner: saETHOwnerAddress,
                },
            };

            const expected = await executeAndCalcExpected(saETH, preState, action);
            const postState = await getState(saETH, sender, receiver, saETHOwner);
            expect(expected).to.deep.equal(postState);
        });
    });
}

export async function testExtractAll(actionTestData: ActionTestData) {
    describe(`Test saETH redeem all test`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const saETH: Contract = actionTestData.saETH;

        it(`test all users redeem:  success`, async () => {
            for (let index = 0; index < accounts.length; index++) {
                const sender = accounts[index];
                const senderAddress = await sender.getAddress();

                const balance = await saETH.balanceOf(senderAddress);
                if (balance.eq(ZERO)) continue;

                const preState = await getState(saETH, sender, sender, sender);

                const action: Action = {
                    func: "redeem(uint256,address,address)",
                    sender: sender,
                    args: {
                        aETHAmount: ZERO,
                        saETHAmount: balance,
                        receiver: senderAddress,
                        owner: senderAddress,
                    },
                };

                const expected = await executeAndCalcExpected(saETH, preState, action);
                const postState = await getState(saETH, sender, sender, sender);
                expect(expected).to.deep.equal(postState);
            }
        });

        it(`test no asset status check: , success`, async () => {
            const sender = accounts[0];
            const postState = await getState(saETH, sender, sender, sender);
            expect(postState.totalSupply).to.be.equal(ZERO);
        });
    });
}
