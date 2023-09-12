const { network, ethers } = require("hardhat");
const { expect } = require("chai");
import { utils, BigNumber } from "ethers";

// Simulate to mine new blocks.
export async function increaseBlock(blockNumber: number) {
    while (blockNumber > 0) {
        blockNumber--;
        await network.provider.request({
            method: "evm_mine",
            params: [],
        });
    }
}

// Simulate the time passed.
export async function increaseTime(time: number) {
    await network.provider.request({
        method: "evm_increaseTime",
        params: [time],
    });
}

// Mine blocks manually.
export async function mineManually(passBlocks: number) {
    await increaseBlock(passBlocks);
    await increaseTime(passBlocks);
}

// Get current block number.
export async function getBlock() {
    const rawBlockNumber = await network.provider.request({
        method: "eth_blockNumber",
        params: [],
    });
    return Number(rawBlockNumber.toString());
}

// Get current timestamp
export async function getCurrentTime() {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    return block.timestamp;
}

export async function verifyAllowError(value0: BigNumber, value1: BigNumber, errorFactor: number) {
    // For 0 values no error allowed
    if (value0.isZero() || value1.isZero()) {
        expect(Number(value0.toString())).to.closeTo(Number(value1.toString()), 10000);
        return;
    }

    let ratio = parseFloat(utils.formatEther(value0.mul(utils.parseEther("1")).div(value1)));

    expect(ratio).to.be.closeTo(1.0, errorFactor);
}

export function getInitializerData(ImplFactory: any, args: any[], initializer: any) {
    if (initializer === false) {
        return "0x";
    } else {
        initializer = "initialize";
    }

    const allowNoInitialization = initializer === undefined && args.length === 0;

    try {
        const fragment = ImplFactory.interface.getFunction(initializer);
        return ImplFactory.interface.encodeFunctionData(fragment, args);
    } catch (e) {
        if (e instanceof Error) {
            if (allowNoInitialization && e.message.includes("no matching function")) {
                return "0x";
            }
        }
        throw e;
    }
}

export function getCallData(ImplFactory: any, fragment: any, args: any[]) {
    return ImplFactory.interface.encodeFunctionData(fragment, args);
}

export function convertDecimals(amount: BigNumber, amountUnitIn: BigNumber, amountUnitOut: BigNumber) {
    return amount.mul(amountUnitOut).div(amountUnitIn);
}
