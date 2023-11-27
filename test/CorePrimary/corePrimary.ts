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
import { getCurrentTime } from "../utils/helper";

export interface ActionTestData {
    owner: Signer;
    manager: Signer;
    pauseGuardian: Signer;
    accounts: Signer[];
    dETH: Contract;
    sdETH: Contract;
    CorePrimary: Contract;
}

export interface State {
    sender: string;
    receiver: string;
    balance: BigNumber;
    dETHTotalSupply: BigNumber;
    sdETHTotalSupply: BigNumber;
    submitted: BigNumber;
    reserveRatio: BigNumber;
    strategyReserve: BigNumber;
    totalWithdrawn: BigNumber;
    pendingClaimAmount: BigNumber;
    totalClaimed: BigNumber;
    lastQueueId: BigNumber;
    accumulated: BigNumber;
    submitActionData: ActionData;
    withdrawActionData: ActionData;
    currentIndex: BigNumber;
    account: Record<string, UserState>;
}

export interface ActionData {
    limit: BigNumber;
    threshold: BigNumber;
    latestIndex: BigNumber;
    accumulated: BigNumber;
    remaining: BigNumber;
}

export interface UserState {
    address: string;
    claimData: ClaimData[];
}

export interface ClaimData {
    queueId: BigNumber;
    amount: BigNumber;
    accumulated: BigNumber;
}

export interface Action {
    func: string;
    args: any;
    sender: Signer;
}

export interface ClaimResult {
    amount: BigNumber;
    claimData: ClaimData[];
}

export function copyClaimData(claimData: ClaimData[]): ClaimData[] {
    let result: ClaimData[] = [];
    result.push(...claimData);
    return result;
}

export function copyUserState(userState: UserState): UserState {
    const result: UserState = {
        address: userState.address,
        claimData: copyClaimData(userState.claimData),
    };
    return result;
}

export function copyActionData(actionData: ActionData): ActionData {
    const result: ActionData = {
        limit: actionData.limit,
        threshold: actionData.threshold,
        latestIndex: actionData.latestIndex,
        accumulated: actionData.accumulated,
        remaining: actionData.remaining,
    };
    return result;
}

export function copyState(state: State): State {
    const result: State = {
        sender: state.sender,
        receiver: state.receiver,
        balance: state.balance,
        dETHTotalSupply: state.dETHTotalSupply,
        sdETHTotalSupply: state.sdETHTotalSupply,
        submitted: state.submitted,
        strategyReserve: state.strategyReserve,
        reserveRatio: state.reserveRatio,
        totalWithdrawn: state.totalWithdrawn,
        pendingClaimAmount: state.pendingClaimAmount,
        totalClaimed: state.totalClaimed,
        lastQueueId: state.lastQueueId,
        accumulated: state.accumulated,
        submitActionData: copyActionData(state.submitActionData),
        withdrawActionData: copyActionData(state.withdrawActionData),
        currentIndex: state.currentIndex,
        account: {
            [state.sender]: copyUserState(state.account[state.sender]),
            [state.receiver]: copyUserState(state.account[state.receiver]),
        },
    };
    return result;
}

export async function getUserState(CorePrimary: Contract, user: Signer) {
    const userAddress = await user.getAddress();
    const queueDatas = await CorePrimary.userQueueIds(userAddress);
    let claimData: ClaimData[] = [];
    for (let index = 0; index < queueDatas._ids.length; index++) {
        const item: ClaimData = {
            queueId: queueDatas._ids[index],
            amount: queueDatas._claimAmounts[index],
            accumulated: queueDatas._accumulations[index],
        };
        claimData.push(item);
    }
    claimData.sort(function (a, b) {
        if (a.queueId.lt(b.queueId)) return -1;
        return 1;
    });

    const userState: UserState = {
        address: userAddress,
        claimData: claimData,
    };
    return userState;
}

export async function getState(CorePrimary: Contract, sender: Signer, receiver: Signer) {
    const senderState = await getUserState(CorePrimary, sender);
    const receiverState = await getUserState(CorePrimary, receiver);

    const dETH = await ethers.getContractAt("dETH", await CorePrimary.dETH());
    const sdETH = await ethers.getContractAt("sdETH", await CorePrimary.sdETH());

    const submitActionData = await CorePrimary.actionData(ZERO);
    const submitRemaining = await CorePrimary.submitRemaining();
    const withdrawActionData = await CorePrimary.actionData(ONE);
    const withdrawRemaining = await CorePrimary.withdrawRemaining();
    const timestamp = utils.parseUnits((await getCurrentTime()).toString(), 0);
    const index = timestamp.div(DAY);

    const state: State = {
        sender: senderState.address,
        receiver: receiverState.address,
        balance: await CorePrimary.provider.getBalance(CorePrimary.address),
        dETHTotalSupply: await dETH.totalSupply(),
        sdETHTotalSupply: await sdETH.totalAssets(),
        submitted: await CorePrimary.submitted(),
        strategyReserve: await CorePrimary.strategyReserve(),
        reserveRatio: await CorePrimary.reserveRatio(),
        totalWithdrawn: await CorePrimary.totalWithdrawn(),
        pendingClaimAmount: await CorePrimary.pendingClaimAmount(),
        totalClaimed: await CorePrimary.totalClaimed(),
        lastQueueId: await CorePrimary.lastQueueId(),
        accumulated: await CorePrimary.accumulated(),
        submitActionData: {
            limit: submitActionData.limit,
            threshold: submitActionData.threshold,
            latestIndex: submitActionData.latestIndex,
            accumulated: submitActionData.accumulated,
            remaining: submitRemaining,
        },
        withdrawActionData: {
            limit: withdrawActionData.limit,
            threshold: withdrawActionData.threshold,
            latestIndex: withdrawActionData.latestIndex,
            accumulated: withdrawActionData.accumulated,
            remaining: withdrawRemaining,
        },
        currentIndex: index,
        account: {
            [senderState.address]: senderState,
            [receiverState.address]: receiverState,
        },
    };
    return state;
}

export function calcCanClaim(claimData: ClaimData[], claimable: BigNumber) {
    let claimResult: ClaimResult = {
        amount: ZERO,
        claimData: [],
    };
    for (let index = 0; index < claimData.length; index++) {
        if (claimable.gte(claimData[index].accumulated)) {
            claimResult.amount = claimResult.amount.add(claimData[index].amount);
            claimResult.claimData.push(claimData[index]);
        }
    }
    return claimResult;
}

export function calcCanClaimByQueueIds(claimData: ClaimData[], claimable: BigNumber, queueIds: BigNumber[]) {
    let claimResult: ClaimResult = {
        amount: ZERO,
        claimData: [],
    };
    for (let index = 0; index < claimData.length; index++) {
        if (claimable.gte(claimData[index].accumulated) && queueIds.some((v) => v.eq(claimData[index].queueId))) {
            claimResult.amount = claimResult.amount.add(claimData[index].amount);
            claimResult.claimData.push(claimData[index]);
        }
    }
    return claimResult;
}

export function increaseReserves(reserveRatio: BigNumber, ethValue: BigNumber) {
    return ethValue.mul(reserveRatio).div(Ether);
}

export async function executeAndCalcExpected(CorePrimary: Contract, preState: State, action: Action): Promise<State> {
    let expected: State = preState;
    const dETH = await ethers.getContractAt("dETH", await CorePrimary.dETH());
    const sdETH = await ethers.getContractAt("sdETH", await CorePrimary.sdETH());
    const lock = preState.pendingClaimAmount.add(preState.strategyReserve);
    const claimable = preState.balance.add(preState.totalClaimed).sub(preState.strategyReserve);
    let claimResult: ClaimResult;
    let tx: any;
    let senderETHChange: BigNumber;
    let senderdETHChange: BigNumber;
    let withdrawable = false;

    switch (action.func) {
        case "submit()":
            tx = await CorePrimary.connect(action.sender)[action.func]({ value: action.args.ethValue });
            await expect(tx).to.changeEtherBalances(
                [CorePrimary.address, preState.sender],
                [action.args.ethValue, action.args.ethValue.mul(NegativeOne)]
            );
            await expect(tx).to.changeTokenBalances(
                dETH,
                [CorePrimary.address, preState.sender],
                [ZERO, action.args.ethValue]
            );
            await expect(tx).to.changeTokenBalances(sdETH, [CorePrimary.address, preState.sender], [ZERO, ZERO]);
            expected = await calcExpectedSubmit(preState, action);
            break;
        case "submit(address)":
            tx = await CorePrimary.connect(action.sender)[action.func](action.args.receiver, {
                value: action.args.ethValue,
            });

            senderETHChange = action.args.ethValue.mul(NegativeOne);

            await expect(tx).to.changeEtherBalances(
                [CorePrimary.address, preState.sender, preState.receiver],
                [action.args.ethValue, senderETHChange, preState.sender == preState.receiver ? senderETHChange : ZERO]
            );
            await expect(tx).to.changeTokenBalances(
                dETH,
                [CorePrimary.address, preState.sender, preState.receiver],
                [ZERO, preState.sender == preState.receiver ? action.args.ethValue : ZERO, action.args.ethValue]
            );
            await expect(tx).to.changeTokenBalances(
                sdETH,
                [CorePrimary.address, preState.sender, preState.receiver],
                [ZERO, ZERO, ZERO]
            );
            expected = await calcExpectedSubmit(preState, action);
            break;
        case "submitAndStake(address)":
            tx = await CorePrimary.connect(action.sender)[action.func](action.args.receiver, {
                value: action.args.ethValue,
            });

            senderETHChange = action.args.ethValue.mul(NegativeOne);

            await expect(tx).to.changeEtherBalances(
                [CorePrimary.address, preState.sender, preState.receiver],
                [action.args.ethValue, senderETHChange, preState.sender == preState.receiver ? senderETHChange : ZERO]
            );
            await expect(tx).to.changeTokenBalances(
                dETH,
                [CorePrimary.address, preState.sender, preState.receiver],
                [ZERO, ZERO, ZERO]
            );
            await expect(tx).to.changeTokenBalances(
                sdETH,
                [CorePrimary.address, preState.sender, preState.receiver],
                [ZERO, preState.sender == preState.receiver ? action.args.ethValue : ZERO, action.args.ethValue]
            );
            expected = await calcExpectedSubmitAndStake(preState, action);
            break;
        case "withdraw(uint256)":
            tx = await CorePrimary.connect(action.sender)[action.func](action.args.dETHAmount);

            withdrawable = preState.balance.gte(lock.add(action.args.dETHAmount));
            senderETHChange = withdrawable ? action.args.dETHAmount : ZERO;

            await expect(tx).to.changeEtherBalances(
                [CorePrimary.address, preState.sender],
                [senderETHChange.mul(NegativeOne), senderETHChange]
            );
            await expect(tx).to.changeTokenBalances(
                dETH,
                [CorePrimary.address, preState.sender],
                [ZERO, action.args.dETHAmount.mul(NegativeOne)]
            );
            await expect(tx).to.changeTokenBalances(sdETH, [CorePrimary.address, preState.sender], [ZERO, ZERO]);
            expected = await calcExpectedWithdraw(preState, action);
            break;
        case "withdraw(uint256,address)":
            tx = await CorePrimary.connect(action.sender)[action.func](action.args.dETHAmount, action.args.receiver);

            withdrawable = preState.balance.gte(lock.add(action.args.dETHAmount));
            senderETHChange = withdrawable ? action.args.dETHAmount : ZERO;

            await expect(tx).to.changeEtherBalances(
                [CorePrimary.address, preState.sender, preState.receiver],
                [
                    senderETHChange.mul(NegativeOne),
                    preState.sender == preState.receiver ? senderETHChange : ZERO,
                    senderETHChange,
                ]
            );
            await expect(tx).to.changeTokenBalances(
                dETH,
                [CorePrimary.address, preState.sender, preState.receiver],
                [
                    ZERO,
                    action.args.dETHAmount.mul(NegativeOne),
                    preState.sender == preState.receiver ? action.args.dETHAmount.mul(NegativeOne) : ZERO,
                ]
            );
            await expect(tx).to.changeTokenBalances(
                sdETH,
                [CorePrimary.address, preState.sender, preState.receiver],
                [ZERO, ZERO, ZERO]
            );
            expected = await calcExpectedWithdraw(preState, action);
            break;
        case "redeemUnderlyingAndWithdraw(uint256)":
            tx = await CorePrimary.connect(action.sender)[action.func](action.args.dETHAmount);

            withdrawable = preState.balance.gte(lock.add(action.args.dETHAmount));
            senderETHChange = withdrawable ? action.args.dETHAmount : ZERO;

            await expect(tx).to.changeEtherBalances(
                [CorePrimary.address, preState.sender],
                [senderETHChange.mul(NegativeOne), senderETHChange]
            );
            await expect(tx).to.changeTokenBalances(dETH, [CorePrimary.address, preState.sender], [ZERO, ZERO]);
            await expect(tx).to.changeTokenBalances(
                sdETH,
                [CorePrimary.address, preState.sender],
                [ZERO, action.args.dETHAmount.mul(NegativeOne)]
            );
            expected = await calcExpectedRedeemAndWithdraw(preState, action);
            break;
        case "redeemAndWithdraw(uint256)":
            tx = await CorePrimary.connect(action.sender)[action.func](action.args.sdETHAmount);

            withdrawable = preState.balance.gte(lock.add(action.args.sdETHAmount));
            senderETHChange = withdrawable ? action.args.sdETHAmount : ZERO;

            await expect(tx).to.changeEtherBalances(
                [CorePrimary.address, preState.sender],
                [senderETHChange.mul(NegativeOne), senderETHChange]
            );
            await expect(tx).to.changeTokenBalances(dETH, [CorePrimary.address, preState.sender], [ZERO, ZERO]);
            await expect(tx).to.changeTokenBalances(
                sdETH,
                [CorePrimary.address, preState.sender],
                [ZERO, action.args.sdETHAmount.mul(NegativeOne)]
            );
            expected = await calcExpectedRedeemAndWithdraw(preState, action);
            break;
        case "claim()":
            claimResult = calcCanClaim(preState.account[preState.sender].claimData, claimable);

            tx = await CorePrimary.connect(action.sender)[action.func]();

            await expect(tx).to.changeEtherBalances(
                [CorePrimary.address, preState.sender],
                [claimResult.amount.mul(NegativeOne), claimResult.amount]
            );
            expected = await calcExpectedClaim(preState, action, claimResult);
            break;
        case "claim(address)":
            claimResult = calcCanClaim(preState.account[preState.sender].claimData, claimable);

            tx = await CorePrimary.connect(action.sender)[action.func](action.args.receiver);

            await expect(tx).to.changeEtherBalances(
                [CorePrimary.address, preState.sender, preState.receiver],
                [
                    claimResult.amount.mul(NegativeOne),
                    preState.sender == preState.receiver ? claimResult.amount : ZERO,
                    claimResult.amount,
                ]
            );
            expected = await calcExpectedClaim(preState, action, claimResult);
            break;
        case "claim(uint256[])":
            claimResult = calcCanClaimByQueueIds(
                preState.account[preState.sender].claimData,
                claimable,
                action.args.queueIds
            );

            tx = await CorePrimary.connect(action.sender)[action.func](action.args.queueIds);

            await expect(tx).to.changeEtherBalances(
                [CorePrimary.address, preState.sender],
                [claimResult.amount.mul(NegativeOne), claimResult.amount]
            );
            expected = await calcExpectedClaim(preState, action, claimResult);
            break;
        case "claim(address,uint256[])":
            claimResult = calcCanClaimByQueueIds(
                preState.account[preState.sender].claimData,
                claimable,
                action.args.queueIds
            );

            tx = await CorePrimary.connect(action.sender)[action.func](action.args.receiver, action.args.queueIds);

            await expect(tx).to.changeEtherBalances(
                [CorePrimary.address, preState.sender, preState.receiver],
                [
                    claimResult.amount.mul(NegativeOne),
                    preState.sender == preState.receiver ? claimResult.amount : ZERO,
                    claimResult.amount,
                ]
            );
            expected = await calcExpectedClaim(preState, action, claimResult);
            break;
        default:
            break;
    }
    return expected;
}

export async function calcExpectedSubmit(preState: State, action: Action): Promise<State> {
    let expected: State = copyState(preState);

    expected.balance = preState.balance.add(action.args.ethValue);
    expected.dETHTotalSupply = preState.dETHTotalSupply.add(action.args.ethValue);
    expected.submitted = preState.submitted.add(action.args.ethValue);

    const increaseReserve = increaseReserves(preState.reserveRatio, action.args.ethValue);
    expected.strategyReserve = preState.strategyReserve.add(increaseReserve);

    const timestamp = utils.parseUnits((await getCurrentTime()).toString(), 0);
    const index = timestamp.div(DAY);
    if (preState.submitActionData.limit.gt(ZERO)) {
        expected.submitActionData.remaining = preState.submitActionData.remaining.sub(action.args.ethValue);
        if (!index.eq(preState.submitActionData.latestIndex)) {
            expected.submitActionData.accumulated = preState.submitted;
            expected.submitActionData.latestIndex = index;
        }
        if (!index.eq(preState.currentIndex)) {
            expected.submitActionData.remaining = preState.submitActionData.limit.sub(action.args.ethValue);
            expected.currentIndex = index;
        }
    }

    if (preState.withdrawActionData.limit.gt(ZERO) && !index.eq(preState.currentIndex))
        expected.withdrawActionData.remaining = preState.withdrawActionData.limit;

    return expected;
}

export async function calcExpectedSubmitAndStake(preState: State, action: Action): Promise<State> {
    let expected: State = await calcExpectedSubmit(preState, action);
    expected.sdETHTotalSupply = preState.sdETHTotalSupply.add(action.args.ethValue);

    return expected;
}

export async function calcExpectedWithdraw(preState: State, action: Action): Promise<State> {
    const receiver = action.args.receiver;
    let expected: State = copyState(preState);

    const withdrawable = preState.balance.gte(
        preState.pendingClaimAmount.add(preState.strategyReserve).add(action.args.dETHAmount)
    );

    if (withdrawable) {
        expected.totalWithdrawn = preState.totalWithdrawn.add(action.args.dETHAmount);
        expected.balance = preState.balance.sub(action.args.dETHAmount);
    } else {
        expected.lastQueueId = preState.lastQueueId.add(ONE);
        expected.pendingClaimAmount = preState.pendingClaimAmount.add(action.args.dETHAmount);
        expected.accumulated = preState.accumulated.add(action.args.dETHAmount);
        const item: ClaimData = {
            queueId: expected.lastQueueId,
            amount: action.args.dETHAmount,
            accumulated: expected.accumulated,
        };
        expected.account[receiver].claimData.push(item);
    }

    expected.dETHTotalSupply = preState.dETHTotalSupply.sub(action.args.dETHAmount);

    const timestamp = utils.parseUnits((await getCurrentTime()).toString(), 0);
    const index = timestamp.div(DAY);
    if (preState.withdrawActionData.limit.gt(ZERO)) {
        expected.withdrawActionData.remaining = preState.withdrawActionData.remaining.sub(action.args.dETHAmount);
        if (!index.eq(preState.withdrawActionData.latestIndex)) {
            expected.withdrawActionData.accumulated = preState.totalWithdrawn
                .add(preState.pendingClaimAmount)
                .add(preState.totalClaimed);
            expected.withdrawActionData.latestIndex = index;
        }
        if (!index.eq(preState.currentIndex)) {
            expected.withdrawActionData.remaining = preState.withdrawActionData.limit.sub(action.args.dETHAmount);
            expected.currentIndex = index;
        }
    }
    if (preState.submitActionData.limit.gt(ZERO) && !index.eq(preState.currentIndex))
        expected.submitActionData.remaining = preState.submitActionData.limit;

    return expected;
}

export async function calcExpectedRedeemAndWithdraw(preState: State, action: Action): Promise<State> {
    let expected: State = await calcExpectedWithdraw(preState, action);
    expected.sdETHTotalSupply = preState.sdETHTotalSupply.sub(action.args.dETHAmount);

    return expected;
}

export async function calcExpectedClaim(preState: State, action: Action, claimResult: ClaimResult): Promise<State> {
    let expected: State = copyState(preState);

    expected.balance = preState.balance.sub(claimResult.amount);
    expected.pendingClaimAmount = preState.pendingClaimAmount.sub(claimResult.amount);
    expected.totalClaimed = preState.totalClaimed.add(claimResult.amount);

    const claimDataString = JSON.stringify(claimResult.claimData);
    expected.account[preState.sender].claimData = preState.account[preState.sender].claimData.filter(function (v) {
        return claimDataString.indexOf(JSON.stringify(v)) == -1;
    });

    if (preState.sender != preState.receiver) {
        const senderQueueIds = preState.account[preState.sender].claimData.map((item) => item.queueId);
        const receiverQueueIds = preState.account[preState.receiver].claimData.map((item) => item.queueId);
        const receiverQueueIdsString = JSON.stringify(receiverQueueIds);
        const intersect = senderQueueIds.filter(function (v) {
            return receiverQueueIdsString.indexOf(JSON.stringify(v)) != -1;
        });
        expect(intersect.length).to.be.equal(0);
    }

    const timestamp = utils.parseUnits((await getCurrentTime()).toString(), 0);
    const index = timestamp.div(DAY);
    if (preState.submitActionData.limit.gt(ZERO) && !index.eq(preState.currentIndex))
        expected.submitActionData.remaining = preState.submitActionData.limit;

    if (preState.withdrawActionData.limit.gt(ZERO) && !index.eq(preState.currentIndex))
        expected.withdrawActionData.remaining = preState.withdrawActionData.limit;

    expected.currentIndex = index;

    return expected;
}
