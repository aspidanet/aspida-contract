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
    aETH: Contract;
    saETH: Contract;
}

export interface State {
    sender: string;
    receiver: string;
    owner: string;
    totalSupply: BigNumber;
    totalAssets: BigNumber;
    totalUnderlying: BigNumber;
    duration: BigNumber;
    rewardRate: BigNumber;
    periodFinish: BigNumber;
    lastUpdateTime: BigNumber;
    account: Record<string, UserState>;
}

export interface UserState {
    address: string;
    aETHBalance: BigNumber;
    saETHBalance: BigNumber;
    saETHBalanceUnderlying: BigNumber;
}

export interface Action {
    func: string;
    args: Args;
    sender: Signer;
}

export interface Args {
    aETHAmount: BigNumber;
    saETHAmount: BigNumber;
    receiver: string;
    owner: string;
}

export function copyUserState(userState: UserState): UserState {
    const result: UserState = {
        address: userState.address,
        aETHBalance: userState.aETHBalance,
        saETHBalance: userState.saETHBalance,
        saETHBalanceUnderlying: userState.saETHBalanceUnderlying,
    };
    return result;
}
export function copyState(state: State): State {
    const result: State = {
        sender: state.sender,
        receiver: state.receiver,
        owner: state.owner,
        totalSupply: state.totalSupply,
        totalAssets: state.totalAssets,
        totalUnderlying: state.totalUnderlying,
        duration: state.duration,
        rewardRate: state.rewardRate,
        periodFinish: state.periodFinish,
        lastUpdateTime: state.lastUpdateTime,
        account: {
            [state.sender]: copyUserState(state.account[state.sender]),
            [state.receiver]: copyUserState(state.account[state.receiver]),
            [state.owner]: copyUserState(state.account[state.owner]),
        },
    };
    return result;
}

export async function getUserState(saETH: Contract, user: Signer) {
    const userAddress = await user.getAddress();

    const aETH = await ethers.getContractAt("aETH", await saETH.asset());
    const userState: UserState = {
        address: userAddress,
        aETHBalance: await aETH.balanceOf(userAddress),
        saETHBalance: await saETH.balanceOf(userAddress),
        saETHBalanceUnderlying: await saETH.maxWithdraw(userAddress),
    };
    return userState;
}

export async function getState(saETH: Contract, sender: Signer, receiver: Signer, owner: Signer) {
    const senderState = await getUserState(saETH, sender);
    const receiverState = await getUserState(saETH, receiver);
    const ownerState = await getUserState(saETH, owner);

    const aETH = await ethers.getContractAt("aETH", await saETH.asset());

    const state: State = {
        sender: senderState.address,
        receiver: receiverState.address,
        owner: ownerState.address,
        totalSupply: await saETH.totalSupply(),
        totalAssets: await saETH.totalAssets(),
        totalUnderlying: await aETH.balanceOf(saETH.address),
        duration: await saETH.duration(),
        rewardRate: await saETH.rewardRate(),
        periodFinish: await saETH.periodFinish(),
        lastUpdateTime: await saETH.lastUpdateTime(),
        account: {
            [senderState.address]: senderState,
            [ownerState.address]: ownerState,
            [receiverState.address]: receiverState,
        },
    };
    return state;
}

export function mulDiv(x: BigNumber, y: BigNumber, denominator: BigNumber, roundingUp: boolean) {
    const factor = roundingUp ? denominator.sub(ONE) : ZERO;
    return x.mul(y).add(factor).div(denominator);
}

export function convertToShares(
    totalSupply: BigNumber,
    totalAssets: BigNumber,
    assets: BigNumber,
    roundingUp: boolean
) {
    return mulDiv(assets, totalSupply.add(ONE), totalAssets.add(ONE), roundingUp);
}

export function convertToAssets(
    totalSupply: BigNumber,
    totalAssets: BigNumber,
    shares: BigNumber,
    roundingUp: boolean
) {
    return mulDiv(shares, totalAssets.add(ONE), totalSupply.add(ONE), roundingUp);
}

export function calcIncreaseRewards(state: State, timestamp: BigNumber) {
    const updateTime = timestamp.lt(state.periodFinish) ? timestamp : state.periodFinish;
    const duration = updateTime.gt(state.lastUpdateTime) ? updateTime.sub(state.lastUpdateTime) : ZERO;
    return state.rewardRate.mul(duration);
}

export function calcUpdatedData(state: State, timestamp: BigNumber) {
    const periodFinish = timestamp.lt(state.periodFinish) ? state.periodFinish : state.duration.add(timestamp);
    const rewardRate = timestamp.gt(state.periodFinish)
        ? state.totalUnderlying.sub(state.totalAssets).div(state.duration)
        : state.rewardRate;
    return {
        rewardRate: rewardRate,
        periodFinish: periodFinish,
    };
}

export async function executeAndCalcExpected(saETH: Contract, preState: State, action: Action) {
    let expected: State = preState;
    switch (action.func) {
        case "deposit(uint256,address)":
            await saETH.connect(action.sender)[action.func](action.args.aETHAmount, action.args.receiver);
            expected = await calcExpectedDeposit(preState, action);
            break;
        case "withdraw(uint256,address,address)":
            await saETH
                .connect(action.sender)
                [action.func](action.args.aETHAmount, action.args.receiver, action.args.owner);
            expected = await calcExpectedWithdraw(preState, action);
            break;
        case "mint(uint256,address)":
            await saETH.connect(action.sender)[action.func](action.args.saETHAmount, action.args.receiver);
            expected = await calcExpectedMint(preState, action);
            break;
        case "redeem(uint256,address,address)":
            await saETH
                .connect(action.sender)
                [action.func](action.args.saETHAmount, action.args.receiver, action.args.owner);
            expected = await calcExpectedRedeem(preState, action);
            break;
        default:
            break;
    }
    // console.log(`\nrewardRate:----------------`);
    // console.log(`pre rewardRate:        ${preState.rewardRate}`);
    // console.log(`expected rewardRate:   ${expected.rewardRate}`);
    // console.log(`rewardRate:----------------end\n`);
    return expected;
}

export async function calcExpectedDeposit(preState: State, action: Action) {
    const sender = await action.sender.getAddress();
    const receiver = action.args.receiver;
    const owner = action.args.owner;

    let expected: State = copyState(preState);

    const timestamp = utils.parseUnits((await getCurrentTime()).toString(), 0);
    const increaseRewards = preState.totalSupply.eq(ZERO) ? ZERO : calcIncreaseRewards(preState, timestamp);

    expected.totalAssets = preState.totalAssets.add(increaseRewards);
    const updatedData = calcUpdatedData(expected, timestamp);
    expected.rewardRate = updatedData.rewardRate;
    expected.periodFinish = updatedData.periodFinish;
    expected.lastUpdateTime = timestamp;

    const increaseShares = convertToShares(preState.totalSupply, expected.totalAssets, action.args.aETHAmount, false);

    expected.totalSupply = preState.totalSupply.add(increaseShares);
    expected.totalAssets = expected.totalAssets.add(action.args.aETHAmount);
    expected.totalUnderlying = preState.totalUnderlying.add(action.args.aETHAmount);

    expected.account[sender].aETHBalance = preState.account[sender].aETHBalance.sub(action.args.aETHAmount);
    expected.account[sender].saETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[sender].saETHBalance,
        false
    );

    expected.account[receiver].saETHBalance = preState.account[receiver].saETHBalance.add(increaseShares);
    expected.account[receiver].saETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[receiver].saETHBalance,
        false
    );

    expect(expected.totalAssets).to.be.lte(expected.totalUnderlying);

    return expected;
}

export async function calcExpectedMint(preState: State, action: Action) {
    const sender = await action.sender.getAddress();
    const receiver = action.args.receiver;
    const owner = action.args.owner;

    let expected: State = copyState(preState);

    const timestamp = utils.parseUnits((await getCurrentTime()).toString(), 0);
    const increaseRewards = preState.totalSupply.eq(ZERO) ? ZERO : calcIncreaseRewards(preState, timestamp);

    expected.totalAssets = preState.totalAssets.add(increaseRewards);
    const updatedData = calcUpdatedData(expected, timestamp);
    expected.rewardRate = updatedData.rewardRate;
    expected.periodFinish = updatedData.periodFinish;
    expected.lastUpdateTime = timestamp;

    const increaseAssets = convertToAssets(preState.totalSupply, expected.totalAssets, action.args.saETHAmount, true);

    expected.totalSupply = preState.totalSupply.add(action.args.saETHAmount);
    expected.totalAssets = expected.totalAssets.add(increaseAssets);
    expected.totalUnderlying = preState.totalUnderlying.add(increaseAssets);

    expected.account[sender].aETHBalance = preState.account[sender].aETHBalance.sub(increaseAssets);
    expected.account[sender].saETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[sender].saETHBalance,
        false
    );

    expected.account[receiver].saETHBalance = preState.account[receiver].saETHBalance.add(action.args.saETHAmount);
    expected.account[receiver].saETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[receiver].saETHBalance,
        false
    );

    expect(expected.totalAssets).to.be.lte(expected.totalUnderlying);

    return expected;
}

export async function calcExpectedWithdraw(preState: State, action: Action) {
    const sender = await action.sender.getAddress();
    const receiver = action.args.receiver;
    const owner = action.args.owner;

    let expected: State = copyState(preState);

    const timestamp = utils.parseUnits((await getCurrentTime()).toString(), 0);
    const increaseRewards = preState.totalSupply.eq(ZERO) ? ZERO : calcIncreaseRewards(preState, timestamp);

    expected.totalAssets = preState.totalAssets.add(increaseRewards);
    const updatedData = calcUpdatedData(expected, timestamp);
    expected.rewardRate = updatedData.rewardRate;
    expected.periodFinish = updatedData.periodFinish;
    expected.lastUpdateTime = timestamp;

    const decreaseShares = convertToShares(preState.totalSupply, expected.totalAssets, action.args.aETHAmount, true);
    expected.totalSupply = preState.totalSupply.sub(decreaseShares);
    expected.totalAssets = expected.totalSupply.eq(ZERO) ? ZERO : expected.totalAssets.sub(action.args.aETHAmount);
    expected.totalUnderlying = preState.totalUnderlying.sub(action.args.aETHAmount);

    expected.account[sender].saETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[sender].saETHBalance,
        false
    );

    expected.account[receiver].aETHBalance = preState.account[receiver].aETHBalance.add(action.args.aETHAmount);
    expected.account[receiver].saETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[receiver].saETHBalance,
        false
    );

    expected.account[owner].saETHBalance = preState.account[owner].saETHBalance.sub(decreaseShares);
    expected.account[owner].saETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[owner].saETHBalance,
        false
    );

    expect(expected.totalAssets).to.be.lte(expected.totalUnderlying);

    return expected;
}

export async function calcExpectedRedeem(preState: State, action: Action) {
    const sender = await action.sender.getAddress();
    const receiver = action.args.receiver;
    const owner = action.args.owner;

    let expected: State = copyState(preState);

    const timestamp = utils.parseUnits((await getCurrentTime()).toString(), 0);
    const increaseRewards = preState.totalSupply.eq(ZERO) ? ZERO : calcIncreaseRewards(preState, timestamp);

    expected.totalAssets = preState.totalAssets.add(increaseRewards);
    const updatedData = calcUpdatedData(expected, timestamp);
    expected.rewardRate = updatedData.rewardRate;
    expected.periodFinish = updatedData.periodFinish;
    expected.lastUpdateTime = timestamp;

    const decreaseAssets = convertToAssets(
        preState.totalSupply,
        preState.totalAssets.add(increaseRewards),
        action.args.saETHAmount,
        false
    );

    expected.totalSupply = preState.totalSupply.sub(action.args.saETHAmount);
    expected.totalAssets = expected.totalSupply.eq(ZERO) ? ZERO : expected.totalAssets.sub(decreaseAssets);
    expected.totalUnderlying = preState.totalUnderlying.sub(decreaseAssets);

    expected.account[sender].saETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[sender].saETHBalance,
        false
    );

    expected.account[receiver].aETHBalance = preState.account[receiver].aETHBalance.add(decreaseAssets);
    expected.account[receiver].saETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[receiver].saETHBalance,
        false
    );

    expected.account[owner].saETHBalance = preState.account[owner].saETHBalance.sub(action.args.saETHAmount);
    expected.account[owner].saETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[owner].saETHBalance,
        false
    );

    expect(expected.totalAssets).to.be.lte(expected.totalUnderlying);

    return expected;
}
