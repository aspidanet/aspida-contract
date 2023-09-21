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
    dETHBalance: BigNumber;
    sdETHBalance: BigNumber;
    sdETHBalanceUnderlying: BigNumber;
}

export interface Action {
    func: string;
    args: Args;
    sender: Signer;
}

export interface Args {
    dETHAmount: BigNumber;
    sdETHAmount: BigNumber;
    receiver: string;
    owner: string;
}

export function copyUserState(userState: UserState): UserState {
    const result: UserState = {
        address: userState.address,
        dETHBalance: userState.dETHBalance,
        sdETHBalance: userState.sdETHBalance,
        sdETHBalanceUnderlying: userState.sdETHBalanceUnderlying,
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

export async function getUserState(sdETH: Contract, user: Signer) {
    const userAddress = await user.getAddress();

    const dETH = await ethers.getContractAt("dETH", await sdETH.asset());
    const userState: UserState = {
        address: userAddress,
        dETHBalance: await dETH.balanceOf(userAddress),
        sdETHBalance: await sdETH.balanceOf(userAddress),
        sdETHBalanceUnderlying: await sdETH.maxWithdraw(userAddress),
    };
    return userState;
}

export async function getState(sdETH: Contract, sender: Signer, receiver: Signer, owner: Signer) {
    const senderState = await getUserState(sdETH, sender);
    const receiverState = await getUserState(sdETH, receiver);
    const ownerState = await getUserState(sdETH, owner);

    const dETH = await ethers.getContractAt("dETH", await sdETH.asset());

    const state: State = {
        sender: senderState.address,
        receiver: receiverState.address,
        owner: ownerState.address,
        totalSupply: await sdETH.totalSupply(),
        totalAssets: await sdETH.totalAssets(),
        totalUnderlying: await dETH.balanceOf(sdETH.address),
        duration: await sdETH.duration(),
        rewardRate: await sdETH.rewardRate(),
        periodFinish: await sdETH.periodFinish(),
        lastUpdateTime: await sdETH.lastUpdateTime(),
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

export async function executeAndCalcExpected(sdETH: Contract, preState: State, action: Action) {
    let expected: State = preState;
    switch (action.func) {
        case "deposit(uint256,address)":
            await sdETH.connect(action.sender)[action.func](action.args.dETHAmount, action.args.receiver);
            expected = await calcExpectedDeposit(preState, action);
            break;
        case "withdraw(uint256,address,address)":
            await sdETH
                .connect(action.sender)
                [action.func](action.args.dETHAmount, action.args.receiver, action.args.owner);
            expected = await calcExpectedWithdraw(preState, action);
            break;
        case "mint(uint256,address)":
            await sdETH.connect(action.sender)[action.func](action.args.sdETHAmount, action.args.receiver);
            expected = await calcExpectedMint(preState, action);
            break;
        case "redeem(uint256,address,address)":
            await sdETH
                .connect(action.sender)
                [action.func](action.args.sdETHAmount, action.args.receiver, action.args.owner);
            expected = await calcExpectedRedeem(preState, action);
            break;
        default:
            break;
    }
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

    const increaseShares = convertToShares(preState.totalSupply, expected.totalAssets, action.args.dETHAmount, false);

    expected.totalSupply = preState.totalSupply.add(increaseShares);
    expected.totalAssets = expected.totalAssets.add(action.args.dETHAmount);
    expected.totalUnderlying = preState.totalUnderlying.add(action.args.dETHAmount);

    expected.account[sender].dETHBalance = preState.account[sender].dETHBalance.sub(action.args.dETHAmount);
    expected.account[sender].sdETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[sender].sdETHBalance,
        false
    );

    expected.account[receiver].sdETHBalance = preState.account[receiver].sdETHBalance.add(increaseShares);
    expected.account[receiver].sdETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[receiver].sdETHBalance,
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

    const increaseAssets = convertToAssets(preState.totalSupply, expected.totalAssets, action.args.sdETHAmount, true);

    expected.totalSupply = preState.totalSupply.add(action.args.sdETHAmount);
    expected.totalAssets = expected.totalAssets.add(increaseAssets);
    expected.totalUnderlying = preState.totalUnderlying.add(increaseAssets);

    expected.account[sender].dETHBalance = preState.account[sender].dETHBalance.sub(increaseAssets);
    expected.account[sender].sdETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[sender].sdETHBalance,
        false
    );

    expected.account[receiver].sdETHBalance = preState.account[receiver].sdETHBalance.add(action.args.sdETHAmount);
    expected.account[receiver].sdETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[receiver].sdETHBalance,
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

    const decreaseShares = convertToShares(preState.totalSupply, expected.totalAssets, action.args.dETHAmount, true);
    expected.totalSupply = preState.totalSupply.sub(decreaseShares);
    expected.totalAssets = expected.totalAssets.sub(action.args.dETHAmount);
    expected.totalUnderlying = preState.totalUnderlying.sub(action.args.dETHAmount);

    expected.account[sender].sdETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[sender].sdETHBalance,
        false
    );

    expected.account[receiver].dETHBalance = preState.account[receiver].dETHBalance.add(action.args.dETHAmount);
    expected.account[receiver].sdETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[receiver].sdETHBalance,
        false
    );

    expected.account[owner].sdETHBalance = preState.account[owner].sdETHBalance.sub(decreaseShares);
    expected.account[owner].sdETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[owner].sdETHBalance,
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
        action.args.sdETHAmount,
        false
    );

    expected.totalSupply = preState.totalSupply.sub(action.args.sdETHAmount);
    expected.totalAssets = expected.totalAssets.sub(decreaseAssets);
    expected.totalUnderlying = preState.totalUnderlying.sub(decreaseAssets);

    expected.account[sender].sdETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[sender].sdETHBalance,
        false
    );

    expected.account[receiver].dETHBalance = preState.account[receiver].dETHBalance.add(decreaseAssets);
    expected.account[receiver].sdETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[receiver].sdETHBalance,
        false
    );

    expected.account[owner].sdETHBalance = preState.account[owner].sdETHBalance.sub(action.args.sdETHAmount);
    expected.account[owner].sdETHBalanceUnderlying = convertToAssets(
        expected.totalSupply,
        expected.totalAssets,
        expected.account[owner].sdETHBalance,
        false
    );

    expect(expected.totalAssets).to.be.lte(expected.totalUnderlying);

    return expected;
}
