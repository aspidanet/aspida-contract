import { ethers } from "hardhat";

export const MAX = ethers.constants.MaxUint256;
export const ZERO = ethers.constants.Zero;
export const ONE = ethers.constants.One;
export const TWO = ethers.constants.Two;
export const NegativeOne = ethers.constants.NegativeOne;

export const SECOND = ethers.constants.One;
export const HOUR = SECOND.mul(3600);
export const DAY = HOUR.mul(24);
export const WEEK = DAY.mul(7);
export const YEAR = DAY.mul(365);

export const Ether = ethers.constants.WeiPerEther;

export const AddressZero = ethers.constants.AddressZero;

export const AbiCoder = ethers.utils.defaultAbiCoder;
