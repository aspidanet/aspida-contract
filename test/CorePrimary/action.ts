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

import { getCurrentTime, increaseTime, mineManually, randomRange } from "../utils/helper";

import { ActionTestData, UserState, Action, getState, getUserState, executeAndCalcExpected } from "./corePrimary";

export async function setReserveRatio(CorePrimary: Contract, reserveRatio: BigNumber) {
    const currentReserveRatio = await CorePrimary.reserveRatio();
    if (currentReserveRatio.eq(reserveRatio)) return;

    await CorePrimary._setReserveRatio(reserveRatio);

    expect(await CorePrimary.reserveRatio()).to.be.equal(reserveRatio);
}

export async function setActionLimit(CorePrimary: Contract, actionId: BigNumber, limit: BigNumber) {
    const actionData = await CorePrimary.actionData(actionId);
    if (actionData.limit.eq(limit)) return;
    await CorePrimary._setActionLimit(actionId, limit);

    expect((await CorePrimary.actionData(actionId)).limit).to.be.equal(limit);
}

export async function refreshLimit(CorePrimary: Contract) {
    const timestamp = utils.parseUnits((await getCurrentTime()).toString(), 0);
    const increaseTime = timestamp.add(DAY).div(DAY).mul(DAY).sub(timestamp);
    await mineManually(1, Number(increaseTime.toString()));

    const dETH = await ethers.getContractAt("dETH", await CorePrimary.dETH());
    await dETH.approve(CorePrimary.address, MAX);

    expect(utils.parseUnits((await getCurrentTime()).toString(), 0).div(DAY)).to.be.gt(timestamp.div(DAY));
}

export async function releaseStrategyReserve(CorePrimary: Contract, releaseAmount: BigNumber) {
    const strategyReserve = await CorePrimary.strategyReserve();
    if (strategyReserve.gte(releaseAmount)) {
        await CorePrimary._releaseStrategyReserve(releaseAmount);
        expect(await CorePrimary.strategyReserve()).to.be.equal(strategyReserve.sub(releaseAmount));
    }
}

export async function supplyClaim(CorePrimary: Contract) {
    const pendingClaimAmount = await CorePrimary.pendingClaimAmount();
    const claimableAmount = await CorePrimary.claimableAmount();
    if (pendingClaimAmount.gt(claimableAmount)) {
        console.log(`supply claim amount: ${utils.formatEther(pendingClaimAmount.sub(claimableAmount))}`);
        await releaseStrategyReserve(CorePrimary, pendingClaimAmount.sub(claimableAmount));
        expect(pendingClaimAmount).to.be.equal(await CorePrimary.claimableAmount());
    }
}

export async function transfertoEth(owner: Signer, CorePrimary: Contract, amount: BigNumber) {
    const claimableAmount = await CorePrimary.claimableAmount();
    const received = await CorePrimary.received();

    await owner.sendTransaction({
        to: CorePrimary.address,
        value: amount,
    });
    expect(claimableAmount.add(amount)).to.be.equal(await CorePrimary.claimableAmount());
    expect(received.add(amount)).to.be.equal(await CorePrimary.received());
}

export async function changeState(CorePrimary: Contract, intervention: any) {
    if (intervention.hasOwnProperty("reserveRatio")) {
        console.log(`set reserveRatio ${utils.formatEther(intervention.reserveRatio.mul(Ether).div(Ether))}`);
        await setReserveRatio(CorePrimary, intervention.reserveRatio);
    }

    if (intervention.hasOwnProperty("submitLimit")) {
        console.log(`set submitLimit ${utils.formatEther(intervention.submitLimit)}`);
        await setActionLimit(CorePrimary, ZERO, intervention.submitLimit);
    }

    if (intervention.hasOwnProperty("withdrawLimit")) {
        console.log(`set withdrawLimit ${utils.formatEther(intervention.withdrawLimit)}`);
        await setActionLimit(CorePrimary, ONE, intervention.withdrawLimit);
    }

    if (intervention.hasOwnProperty("refreshLimit") && intervention.refreshLimit) {
        console.log("refreshLimit");
        await refreshLimit(CorePrimary);
    }

    if (intervention.hasOwnProperty("supplyClaim") && intervention.supplyClaim) {
        console.log("supplyClaim");
        await supplyClaim(CorePrimary);
    }
}

export async function testSubmitRevert(actionTestData: ActionTestData) {
    describe(`Test CorePrimary submit test revert`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const CorePrimary: Contract = actionTestData.CorePrimary;

        it(`test submit() : value = 0, expected revert`, async () => {
            const sender = accounts[0];
            const ethValue = ZERO;

            await expect(CorePrimary.connect(sender)["submit()"]({ value: ethValue })).to.be.revertedWith(
                "_submit: ETH cannot be 0"
            );
        });

        it(`test submit() : submitLimit > 0, value > submitRemaining, expected revert`, async () => {
            const sender = accounts[0];

            const limit = Ether;
            await CorePrimary._setActionLimit(ZERO, limit);
            const actionData = await CorePrimary.actionData(ZERO);
            expect(actionData.limit).to.be.equal(limit);

            const submitRemaining = await CorePrimary.submitRemaining();
            const ethValue = submitRemaining.add(ONE);

            await expect(CorePrimary.connect(sender)["submit()"]({ value: ethValue })).to.be.revertedWith(
                "_checkActionLimit: Limit exceeded"
            );

            await CorePrimary._setActionLimit(ZERO, ZERO);
        });

        it(`test submit(): paused, expected revert`, async () => {
            const sender = accounts[0];
            const ethValue = Ether;

            await CorePrimary._close();
            expect(await CorePrimary.paused()).to.be.equal(true);

            await expect(CorePrimary.connect(sender)["submit()"]({ value: ethValue })).to.be.revertedWith(
                "Pausable: paused"
            );

            await CorePrimary._open();
        });

        it(`test submit(address): paused, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const ethValue = Ether;

            await CorePrimary._close();
            expect(await CorePrimary.paused()).to.be.equal(true);

            await expect(
                CorePrimary.connect(sender)["submit(address)"](receiverAddress, { value: ethValue })
            ).to.be.revertedWith("Pausable: paused");

            await CorePrimary._open();
        });

        it(`test submitAndStake(address): paused, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const ethValue = Ether;

            await CorePrimary._close();
            expect(await CorePrimary.paused()).to.be.equal(true);

            await expect(
                CorePrimary.connect(sender)["submitAndStake(address)"](receiverAddress, { value: ethValue })
            ).to.be.revertedWith("Pausable: paused");

            await CorePrimary._open();
        });
    });
}

export async function testSubmit(actionTestData: ActionTestData, intervention: any, content: string) {
    describe(`Test CorePrimary submit ${content} test`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const CorePrimary: Contract = actionTestData.CorePrimary;

        it(`test submit : intervention ${content}, success`, async () => {
            await changeState(CorePrimary, intervention);
        });

        it(`test submit() : ${content}, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const submitLimit = preState.submitActionData.remaining.div(TWO);
            if (submitLimit.eq(ZERO)) {
                console.log("submit limit exceeded!");
                return;
            }

            const ethValue = Ether.gt(submitLimit) ? submitLimit : Ether;
            const action: Action = {
                func: "submit()",
                sender: sender,
                args: {
                    ethValue: ethValue,
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });

        it(`test submit(address) : ${content}, sender = receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const submitLimit = preState.submitActionData.remaining.div(TWO);
            if (submitLimit.eq(ZERO)) {
                console.log("submit limit exceeded!");
                return;
            }

            const ethValue = Ether.gt(submitLimit) ? submitLimit : Ether;
            const action: Action = {
                func: "submit(address)",
                sender: sender,
                args: {
                    ethValue: ethValue,
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });

        it(`test submit(address) : ${content}, sender != receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const submitLimit = preState.submitActionData.remaining.div(TWO);
            if (submitLimit.eq(ZERO)) {
                console.log("submit limit exceeded!");
                return;
            }

            const ethValue = Ether.gt(submitLimit) ? submitLimit : Ether;
            const action: Action = {
                func: "submit(address)",
                sender: sender,
                args: {
                    ethValue: ethValue,
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });

        it(`test submitAndStake(address) : ${content}, sender = receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const submitLimit = preState.submitActionData.remaining.div(TWO);
            if (submitLimit.eq(ZERO)) {
                console.log("submit limit exceeded!");
                return;
            }

            const ethValue = Ether.gt(submitLimit) ? submitLimit : Ether;
            const action: Action = {
                func: "submitAndStake(address)",
                sender: sender,
                args: {
                    ethValue: ethValue,
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });

        it(`test submitAndStake(address) : ${content}, sender != receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const submitLimit = preState.submitActionData.remaining.div(TWO);
            if (submitLimit.eq(ZERO)) {
                console.log("submit limit exceeded!");
                return;
            }

            const ethValue = Ether.gt(submitLimit) ? submitLimit : Ether;
            const action: Action = {
                func: "submitAndStake(address)",
                sender: sender,
                args: {
                    ethValue: ethValue,
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });
    });
}

export async function testWithdrawRevert(actionTestData: ActionTestData) {
    await testWithdrawInsufficientAmountRevert(actionTestData);
    await testWithdrawGeneralRevert("withdraw(uint256)", actionTestData.dETH, actionTestData);
    await testWithdrawGeneralRevert("redeemAndWithdraw(uint256)", actionTestData.sdETH, actionTestData);
    await testWithdrawGeneralRevert("redeemUnderlyingAndWithdraw(uint256)", actionTestData.sdETH, actionTestData);
}

export async function testWithdrawGeneralRevert(action: string, token: Contract, actionTestData: ActionTestData) {
    describe(`Test CorePrimary ${action} test revert`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const Token: Contract = token;
        const CorePrimary: Contract = actionTestData.CorePrimary;

        it(`test ${action}: insufficient allowance, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const amount = await Token.balanceOf(receiverAddress);
            expect(amount).to.be.gt(ZERO);

            await Token.connect(sender).approve(CorePrimary.address, amount.sub(ONE));

            await expect(CorePrimary.connect(sender)[action](amount)).to.be.revertedWith(
                "ERC20: insufficient allowance"
            );
        });

        // it(`test ${action}: Insufficient amount, expected revert`, async () => {
        //     const sender = accounts[0];
        //     const receiver = sender;
        //     const receiverAddress: string = await receiver.getAddress();
        //     const amount = (await Token.balanceOf(receiverAddress)).add(ONE);

        //     await Token.connect(sender).approve(CorePrimary.address, MAX);

        //     await expect(CorePrimary.connect(sender)[action](amount)).to.be.revertedWith(
        //         "ERC4626: redeem more than max"
        //     );
        // });

        it(`test ${action}: amount = 0, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const amount = ZERO;

            await Token.connect(sender).approve(CorePrimary.address, MAX);

            await expect(CorePrimary.connect(sender)[action](amount)).to.be.revertedWith(
                "_withdraw: withdraw amount cannot be 0"
            );
        });

        it(`test ${action} : withdrawLimit > 0, amount > withdrawRemaining, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const balance = await Token.balanceOf(receiverAddress);
            expect(balance).to.be.gt(ZERO);

            const limit = Ether.div(TWO);
            await CorePrimary._setActionLimit(ONE, limit);
            const actionData = await CorePrimary.actionData(ONE);
            expect(actionData.limit).to.be.equal(limit);

            const withdrawRemaining = await CorePrimary.withdrawRemaining();
            const amount = withdrawRemaining.add(ONE);

            await expect(CorePrimary.connect(sender)[action](amount)).to.be.revertedWith(
                "_checkActionLimit: Limit exceeded"
            );

            await CorePrimary._setActionLimit(ONE, ZERO);
        });

        it(`test ${action} : withdrawThreshold > 0, amount < withdrawThreshold, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const balance = await Token.balanceOf(receiverAddress);
            expect(balance).to.be.gt(ZERO);

            const threshold = Ether.div(TWO);
            await CorePrimary._setActionThreshold(ONE, threshold);
            const actionData = await CorePrimary.actionData(ONE);
            expect(actionData.threshold).to.be.equal(threshold);

            const withdrawThreshold = await CorePrimary.withdrawThreshold();
            const amount = withdrawThreshold.sub(ONE);

            await expect(CorePrimary.connect(sender)[action](amount)).to.be.revertedWith(
                "_checkActionThreshold: Amount exceeds threshold"
            );

            await CorePrimary._setActionThreshold(ONE, ZERO);
        });

        it(`test ${action}: paused, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const balance = await Token.balanceOf(receiverAddress);
            const amount = balance.div(TWO);

            await Token.connect(sender).approve(CorePrimary.address, MAX);

            await CorePrimary._close();
            expect(await CorePrimary.paused()).to.be.equal(true);

            await expect(CorePrimary.connect(sender)[action](amount)).to.be.revertedWith("Pausable: paused");

            await CorePrimary._open();
        });

        // it(`test withdraw(uint256): value > 0, expected revert`, async () => {
        //     const sender = accounts[0];
        //     const receiver = sender;
        //     const receiverAddress: string = await receiver.getAddress();
        //     const balance = await dETH.balanceOf(receiverAddress);
        //     const dETHAmount = balance.div(TWO);

        //     await dETH.connect(sender).approve(CorePrimary.address, MAX);

        //     await expect(CorePrimary.connect(sender)["withdraw(uint256)"](dETHAmount, { value: ONE })).to.be.reverted;

        //     await CorePrimary._open();
        // });
    });
}

export async function testWithdrawInsufficientAmountRevert(actionTestData: ActionTestData) {
    describe(`Test CorePrimary withdraw test revert`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const dETH: Contract = actionTestData.dETH;
        const sdETH: Contract = actionTestData.sdETH;
        const CorePrimary: Contract = actionTestData.CorePrimary;

        it(`test withdraw(uint256): Insufficient amount, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const dETHAmount = (await dETH.balanceOf(receiverAddress)).add(ONE);

            await dETH.connect(sender).approve(CorePrimary.address, MAX);

            await expect(CorePrimary.connect(sender)["withdraw(uint256)"](dETHAmount)).to.be.revertedWith(
                "ERC20: burn amount exceeds balance"
            );
        });

        it(`test redeemAndWithdraw(uint256): Insufficient amount, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const sdETHAmount = (await sdETH.balanceOf(receiverAddress)).add(ONE);

            await dETH.connect(sender).approve(CorePrimary.address, MAX);

            await expect(CorePrimary.connect(sender)["redeemAndWithdraw(uint256)"](sdETHAmount)).to.be.revertedWith(
                "ERC4626: redeem more than max"
            );
        });

        it(`test redeemUnderlyingAndWithdraw(uint256): Insufficient amount, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const sdETHAmount = (await sdETH.balanceOf(receiverAddress)).add(ONE);

            await dETH.connect(sender).approve(CorePrimary.address, MAX);

            await expect(
                CorePrimary.connect(sender)["redeemUnderlyingAndWithdraw(uint256)"](sdETHAmount)
            ).to.be.revertedWith("ERC4626: withdraw more than max");
        });
    });
}

export async function testWithdraw(actionTestData: ActionTestData, intervention: any, content: string) {
    describe(`Test CorePrimary withdraw ${content} test`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const dETH: Contract = actionTestData.dETH;
        const sdETH: Contract = actionTestData.sdETH;
        const CorePrimary: Contract = actionTestData.CorePrimary;

        it(`test withdraw : intervention ${content}, success`, async () => {
            await changeState(CorePrimary, intervention);
        });

        it(`test withdraw(uint256) : ${content}, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const withdrawLimit = preState.withdrawActionData.remaining.div(TWO);
            if (withdrawLimit.eq(ZERO)) {
                console.log("withdraw limit exceeded!");
                return;
            }

            const balance = await dETH.balanceOf(receiverAddress);
            const amount = balance.div(TWO);
            const dETHAmount = amount.gt(withdrawLimit) ? withdrawLimit : amount;
            const action: Action = {
                func: "withdraw(uint256)",
                sender: sender,
                args: {
                    dETHAmount: dETHAmount,
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });

        it(`test withdraw(uint256,address) : ${content}, sender = receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const withdrawLimit = preState.withdrawActionData.remaining.div(TWO);
            if (withdrawLimit.eq(ZERO)) {
                console.log("withdraw limit exceeded!");
                return;
            }

            const balance = await dETH.balanceOf(receiverAddress);
            const amount = balance.div(TWO);
            const dETHAmount = amount.gt(withdrawLimit) ? withdrawLimit : amount;
            const action: Action = {
                func: "withdraw(uint256,address)",
                sender: sender,
                args: {
                    dETHAmount: dETHAmount,
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });

        it(`test withdraw(uint256,address) : ${content}, sender != receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[2];
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const withdrawLimit = preState.withdrawActionData.remaining.div(TWO);
            if (withdrawLimit.eq(ZERO)) {
                console.log("withdraw limit exceeded!");
                return;
            }

            const balance = await dETH.balanceOf(await sender.getAddress());
            const amount = balance.div(TWO);
            const dETHAmount = amount.gt(withdrawLimit) ? withdrawLimit : amount;
            const action: Action = {
                func: "withdraw(uint256,address)",
                sender: sender,
                args: {
                    dETHAmount: dETHAmount,
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });

        it(`test redeemUnderlyingAndWithdraw(uint256) : ${content}, success`, async () => {
            const sender = accounts[1];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const withdrawLimit = preState.withdrawActionData.remaining.div(TWO);
            if (withdrawLimit.eq(ZERO)) {
                console.log("withdraw limit exceeded!");
                return;
            }

            const balance = await sdETH.maxWithdraw(receiverAddress);
            const amount = balance.div(TWO);
            const dETHAmount = amount.gt(withdrawLimit) ? withdrawLimit : amount;
            const action: Action = {
                func: "redeemUnderlyingAndWithdraw(uint256)",
                sender: sender,
                args: {
                    dETHAmount: dETHAmount,
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });

        it(`test redeemAndWithdraw(uint256) : ${content}, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const withdrawLimit = preState.withdrawActionData.remaining.div(TWO);
            if (withdrawLimit.eq(ZERO)) {
                console.log("withdraw limit exceeded!");
                return;
            }

            const balance = await sdETH.maxRedeem(receiverAddress);
            const amount = balance.div(TWO);
            const sdETHAmount = amount.gt(withdrawLimit) ? withdrawLimit : amount;
            const action: Action = {
                func: "redeemAndWithdraw(uint256)",
                sender: sender,
                args: {
                    dETHAmount: sdETHAmount,
                    sdETHAmount: sdETHAmount,
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });
    });
}

export async function testClaimRevert(actionTestData: ActionTestData) {
    describe(`Test CorePrimary claim test revert`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const CorePrimary: Contract = actionTestData.CorePrimary;

        it(`test claim() : queueIds length = 0, expected revert`, async () => {
            const sender = accounts[3];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();

            const claimData = await CorePrimary.claimDataByAddress(receiverAddress);
            expect(claimData._ids.length).to.be.equal(0);

            await expect(CorePrimary.connect(sender)["claim()"]()).to.be.revertedWith(
                "_claimByQueueId: Queue list cannot be empty"
            );
        });

        it(`test claim(address) : claimable amount = 0, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();

            const claimData = await CorePrimary.claimDataByAddress(receiverAddress);
            expect(claimData._ids.length).to.be.gt(0);
            expect(claimData._claimStatuses[0]).to.be.equal(false);

            await expect(CorePrimary.connect(sender)["claim(address)"](receiverAddress)).to.be.revertedWith(
                "_claimByQueueId: No claim amount"
            );
        });

        it(`test claim(uint256[]) : Sender queue id does not exist, expected revert`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();

            const claimData = await CorePrimary.claimDataByAddress(receiverAddress);
            const lastQueueId = await CorePrimary.lastQueueId();
            const queueId = lastQueueId.add(ONE);
            expect(JSON.stringify(claimData._ids).indexOf(JSON.stringify(queueId))).to.be.equal(-1);

            await expect(CorePrimary.connect(sender)["claim(uint256[])"]([queueId])).to.be.revertedWith(
                "_claimByQueueId: No claim amount"
            );
        });

        it(`test claim(address,uint256[]) : Sender queue id does not exist, queue id can claim, expected revert`, async () => {
            const sender = accounts[1];
            const receiver = accounts[0];
            const receiverAddress: string = await receiver.getAddress();

            const claimData = await CorePrimary.claimDataByAddress(receiverAddress);
            const queueId = claimData._ids[0];
            expect(claimData._ids.length).to.be.gt(0);

            await supplyClaim(CorePrimary);

            await expect(
                CorePrimary.connect(sender)["claim(address,uint256[])"](receiverAddress, [queueId])
            ).to.be.revertedWith("_claimByQueueId: Queue id does not exist");
        });

        it(`test claim(): paused, expected revert`, async () => {
            await CorePrimary._close();
            expect(await CorePrimary.paused()).to.be.equal(true);

            const sender = accounts[0];

            await expect(CorePrimary.connect(sender)["claim()"]()).to.be.revertedWith("Pausable: paused");

            await CorePrimary._open();
        });

        it(`test claim(address): paused, expected revert`, async () => {
            await CorePrimary._close();
            expect(await CorePrimary.paused()).to.be.equal(true);

            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();

            await expect(CorePrimary.connect(sender)["claim(address)"](receiverAddress)).to.be.revertedWith(
                "Pausable: paused"
            );

            await CorePrimary._open();
        });

        it(`test claim(uint256[]): paused, expected revert`, async () => {
            await CorePrimary._close();
            expect(await CorePrimary.paused()).to.be.equal(true);

            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const claimData = await CorePrimary.claimDataByAddress(receiverAddress);

            await expect(CorePrimary.connect(sender)["claim(uint256[])"](claimData._ids)).to.be.revertedWith(
                "Pausable: paused"
            );

            await CorePrimary._open();
        });

        it(`test claim(address,uint256[]): paused, expected revert`, async () => {
            await CorePrimary._close();
            expect(await CorePrimary.paused()).to.be.equal(true);

            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const claimData = await CorePrimary.claimDataByAddress(receiverAddress);

            await expect(
                CorePrimary.connect(sender)["claim(address,uint256[])"](receiverAddress, claimData._ids)
            ).to.be.revertedWith("Pausable: paused");

            await CorePrimary._open();
        });
    });
}

export function claimDataSort(claimData: any) {
    let claimDataSort: any[] = [];
    for (let index = 0; index < claimData._ids.length; index++) {
        const item = {
            queueId: claimData._ids[index],
            status: claimData._claimStatuses[index],
        };
        claimDataSort.push(item);
    }
    claimDataSort.sort(function (a, b) {
        if (a.queueId.lt(b.queueId)) return -1;
        return 1;
    });

    return claimDataSort;
}

export function checkClaimStatus(claimData: any) {
    const claimDataObj: any[] = claimDataSort(claimData);

    let claimStatus = false;
    let preclaimStatus = false;
    for (let index = 0; index < claimDataObj.length; index++) {
        if (claimDataObj[index].status) claimStatus = claimDataObj[index].status;

        if (index > 0 && claimDataObj[index].status) {
            if (!preclaimStatus) {
                console.log("data error!!!");
            }
        }
        preclaimStatus = claimDataObj[index].status;
    }
    return claimStatus;
}

export function filterClaimStatus(claimData: any) {
    let claimAmount = ZERO;
    let queueIds: BigNumber[] = [];
    for (let index = 0; index < claimData._ids.length; index++) {
        if (claimData._claimStatuses[index]) {
            claimAmount = claimAmount.add(claimData._claimAmounts[index]);
            queueIds.push(claimData._ids[index]);
        }
    }
    return { queueIds: queueIds, amount: claimAmount };
}

export async function testClaimByAddress(actionTestData: ActionTestData, intervention: any, content: string) {
    describe(`Test CorePrimary Claim by address ${content} test`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const CorePrimary: Contract = actionTestData.CorePrimary;

        it(`test Claim by address : intervention ${content}, success`, async () => {
            await changeState(CorePrimary, intervention);
        });

        it(`test claim() : ${content}, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const claimData = await CorePrimary.claimDataByAddress(receiverAddress);
            if (claimData._ids.length == 0) {
                console.log("No claim data!");
                return;
            }
            if (!checkClaimStatus(claimData)) {
                console.log("Insufficient claim amount!");
                return;
            }

            const action: Action = {
                func: "claim()",
                sender: sender,
                args: {
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });

        it(`test claim(address) : ${content} sender = receiver, success`, async () => {
            const sender = accounts[1];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const claimData = await CorePrimary.claimDataByAddress(receiverAddress);
            if (claimData._ids.length == 0) {
                console.log("No claim data!");
                return;
            }
            if (!checkClaimStatus(claimData)) {
                console.log("Insufficient claim amount!");
                return;
            }

            const action: Action = {
                func: "claim(address)",
                sender: sender,
                args: {
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });

        it(`test claim(address) : ${content} sender != receiver, success`, async () => {
            const sender = accounts[2];
            const receiver = accounts[0];
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const claimData = await CorePrimary.claimDataByAddress(await sender.getAddress());
            if (claimData._ids.length == 0) {
                console.log("No claim data!");
                return;
            }
            if (!checkClaimStatus(claimData)) {
                console.log("Insufficient claim amount!");
                return;
            }

            const action: Action = {
                func: "claim(address)",
                sender: sender,
                args: {
                    receiver: receiverAddress,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });
    });
}

export async function testClaimByQueueId(actionTestData: ActionTestData, intervention: any, content: string) {
    describe(`Test CorePrimary Claim by queueId ${content} test`, async () => {
        const accounts: Signer[] = actionTestData.accounts;
        const CorePrimary: Contract = actionTestData.CorePrimary;

        it(`test Claim by queueId: intervention ${content}, success`, async () => {
            await changeState(CorePrimary, intervention);
        });

        it(`test claim(uint256[]) : ${content}, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const claimData = await CorePrimary.claimDataByAddress(receiverAddress);
            if (claimData._ids.length == 0) {
                console.log("No claim data!");
                return;
            }

            const claimQueueIdData = filterClaimStatus(claimData);
            if (claimQueueIdData.queueIds.length == 0) {
                console.log("Insufficient claim amount!");
                return;
            }

            const queueIds = [claimQueueIdData.queueIds[randomRange(0, claimQueueIdData.queueIds.length)]];

            const action: Action = {
                func: "claim(uint256[])",
                sender: sender,
                args: {
                    receiver: receiverAddress,
                    queueIds: queueIds,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });

        it(`test claim(address,uint256[]) : ${content}, sender = receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = sender;
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const claimData = await CorePrimary.claimDataByAddress(receiverAddress);
            if (claimData._ids.length == 0) {
                console.log("No claim data!");
                return;
            }

            const claimQueueIdData = filterClaimStatus(claimData);
            if (claimQueueIdData.queueIds.length == 0) {
                console.log("Insufficient claim amount!");
                return;
            }

            const queueIds = [claimQueueIdData.queueIds[randomRange(0, claimQueueIdData.queueIds.length)]];

            const action: Action = {
                func: "claim(address,uint256[])",
                sender: sender,
                args: {
                    receiver: receiverAddress,
                    queueIds: queueIds,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });

        it(`test claim(address,uint256[]) : ${content}, sender != receiver, success`, async () => {
            const sender = accounts[0];
            const receiver = accounts[1];
            const receiverAddress: string = await receiver.getAddress();
            const preState = await getState(CorePrimary, sender, receiver);

            const claimData = await CorePrimary.claimDataByAddress(await sender.getAddress());
            if (claimData._ids.length == 0) {
                console.log("No claim data!");
                return;
            }

            const claimQueueIdData = filterClaimStatus(claimData);
            if (claimQueueIdData.queueIds.length == 0) {
                console.log("Insufficient claim amount!");
                return;
            }

            const queueIds = [claimQueueIdData.queueIds[randomRange(0, claimQueueIdData.queueIds.length)]];

            const action: Action = {
                func: "claim(address,uint256[])",
                sender: sender,
                args: {
                    receiver: receiverAddress,
                    queueIds: queueIds,
                },
            };

            const expected = await executeAndCalcExpected(CorePrimary, preState, action);
            const postState = await getState(CorePrimary, sender, receiver);
            expect(expected).to.deep.equal(postState);
        });
    });
}
