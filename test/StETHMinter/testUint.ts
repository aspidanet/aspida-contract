import { Signer, Contract } from "ethers";
import { expect } from "chai";

import { fixtureDefault } from "../utils/fixtures";
import { MAX, ZERO, ONE, TWO, NegativeOne, Ether, AddressZero, AbiCoder } from "../utils/constants";

describe("Test StETHMinter unit test", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let aETH: Contract;
    let MockstETH: Contract;
    let StETHMinter: Contract;

    async function init() {
        const initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        aETH = initData.aETH;
        MockstETH = initData.MockstETH;
        StETHMinter = initData.StETHMinter;

        expect(await StETHMinter.aETH()).to.be.equal(aETH.address);
        expect(await StETHMinter.depositAsset()).to.be.equal(MockstETH.address);
    }

    before(async function () {
        await init();
    });

    it("test deposit(uint256,address): insufficient allowance, expected revert", async () => {
        const sender = accounts[0];
        const senderAddr = await sender.getAddress();
        const receiver = senderAddr;
        const amount = Ether;

        expect(await MockstETH.allowance(senderAddr, StETHMinter.address)).to.be.lt(amount);

        await expect(StETHMinter.connect(sender)["deposit(uint256,address)"](amount, receiver)).to.be.revertedWith(
            "TransferHelper: TRANSFER_FROM_FAILED"
        );
    });

    it("test deposit(uint256,address): Sufficient allowance, not enough balance, expected revert", async () => {
        const sender = accounts[0];
        const senderAddr = await sender.getAddress();
        const receiver = senderAddr;
        const amount = Ether;

        const balance = await MockstETH.balanceOf(senderAddr);
        expect(amount).to.be.gt(balance);

        await MockstETH.connect(sender).approve(StETHMinter.address, amount);
        expect(await MockstETH.allowance(senderAddr, StETHMinter.address)).to.be.gte(amount);

        await expect(StETHMinter.connect(sender)["deposit(uint256,address)"](amount, receiver)).to.be.revertedWith(
            "TransferHelper: TRANSFER_FROM_FAILED"
        );
    });

    it("test deposit(uint256,address): Balance and allowance are sufficient, insufficient aETH capacity, expected revert", async () => {
        const sender = accounts[0];
        const senderAddr = await sender.getAddress();
        const receiver = senderAddr;
        const amount = Ether;

        await MockstETH.mint(senderAddr, amount);
        const balance = await MockstETH.balanceOf(senderAddr);
        expect(amount).to.be.lte(balance);

        await MockstETH.connect(sender).approve(StETHMinter.address, amount);
        expect(await MockstETH.allowance(senderAddr, StETHMinter.address)).to.be.gte(amount);

        await expect(StETHMinter.connect(sender)["deposit(uint256,address)"](amount, receiver)).to.be.revertedWith(
            "_checkMintCap: Minter mint capacity reached"
        );
    });

    it("test deposit(uint256,address): Balance and allowance are sufficient, sufficient aETH capacity, success", async () => {
        const sender = accounts[0];
        const senderAddr = await sender.getAddress();
        const receiver = senderAddr;
        const amount = Ether;

        const balance = await MockstETH.balanceOf(senderAddr);
        expect(amount).to.be.lte(balance);

        await MockstETH.connect(sender).approve(StETHMinter.address, amount);
        expect(await MockstETH.allowance(senderAddr, StETHMinter.address)).to.be.gte(amount);

        await aETH._setMinterCap(StETHMinter.address, amount.mul(100));
        const senderBalance = await aETH.balanceOf(senderAddr);
        const receiverBalance = await aETH.balanceOf(receiver);
        const totalSupply = await aETH.totalSupply();
        const depositCap = await StETHMinter.depositCap();
        const depositAmount = await StETHMinter.depositAmount();
        expect(depositCap.sub(depositAmount)).to.be.gte(amount);

        await expect(StETHMinter.connect(sender)["deposit(uint256,address)"](amount, receiver)).changeTokenBalances(
            MockstETH,
            [await StETHMinter.receiver(), senderAddr],
            [amount, amount.mul(NegativeOne)]
        );
        const aETHAmount = await StETHMinter.convertToAETH(amount);
        expect(await aETH.balanceOf(senderAddr)).to.be.gte(senderBalance.add(aETHAmount));
        expect(await aETH.balanceOf(receiver)).to.be.gte(receiverBalance.add(aETHAmount));
        expect(await aETH.totalSupply()).to.be.gte(totalSupply.add(aETHAmount));
        expect(await StETHMinter.depositAmount()).to.be.gte(depositAmount.add(aETHAmount));
        expect(await StETHMinter.depositCap()).to.be.gte(depositCap);
    });

    it("test deposit(uint256,address): receiver != sender, success", async () => {
        const sender = accounts[0];
        const senderAddr = await sender.getAddress();
        const receiver = await accounts[1].getAddress();
        const amount = Ether;

        await MockstETH.mint(senderAddr, amount);
        const balance = await MockstETH.balanceOf(senderAddr);
        expect(amount).to.be.lte(balance);

        await MockstETH.connect(sender).approve(StETHMinter.address, amount);
        expect(await MockstETH.allowance(senderAddr, StETHMinter.address)).to.be.gte(amount);

        const senderBalance = await aETH.balanceOf(senderAddr);
        const receiverBalance = await aETH.balanceOf(receiver);
        const totalSupply = await aETH.totalSupply();
        const depositCap = await StETHMinter.depositCap();
        const depositAmount = await StETHMinter.depositAmount();
        expect(depositCap.sub(depositAmount)).to.be.gte(amount);

        await expect(StETHMinter.connect(sender)["deposit(uint256,address)"](amount, receiver)).changeTokenBalances(
            MockstETH,
            [await StETHMinter.receiver(), senderAddr],
            [amount, amount.mul(NegativeOne)]
        );
        const aETHAmount = await StETHMinter.convertToAETH(amount);
        expect(await aETH.balanceOf(senderAddr)).to.be.gte(senderBalance);
        expect(await aETH.balanceOf(receiver)).to.be.gte(receiverBalance.add(aETHAmount));
        expect(await aETH.totalSupply()).to.be.gte(totalSupply.add(aETHAmount));
        expect(await StETHMinter.depositAmount()).to.be.gte(depositAmount.add(aETHAmount));
        expect(await StETHMinter.depositCap()).to.be.gte(depositCap);
    });

    it("test deposit(uint256): Balance and allowance are sufficient, sufficient aETH capacity, success", async () => {
        const sender = accounts[0];
        const senderAddr = await sender.getAddress();
        const amount = Ether;

        await MockstETH.mint(senderAddr, amount);
        const balance = await MockstETH.balanceOf(senderAddr);
        expect(amount).to.be.lte(balance);

        await MockstETH.connect(sender).approve(StETHMinter.address, amount);
        expect(await MockstETH.allowance(senderAddr, StETHMinter.address)).to.be.gte(amount);

        const senderBalance = await aETH.balanceOf(senderAddr);
        const totalSupply = await aETH.totalSupply();
        const depositCap = await StETHMinter.depositCap();
        const depositAmount = await StETHMinter.depositAmount();
        expect(depositCap.sub(depositAmount)).to.be.gte(amount);

        await expect(StETHMinter.connect(sender)["deposit(uint256)"](amount)).changeTokenBalances(
            MockstETH,
            [await StETHMinter.receiver(), senderAddr],
            [amount, amount.mul(NegativeOne)]
        );
        const aETHAmount = await StETHMinter.convertToAETH(amount);
        expect(await aETH.balanceOf(senderAddr)).to.be.gte(senderBalance.add(aETHAmount));
        expect(await aETH.totalSupply()).to.be.gte(totalSupply.add(aETHAmount));
        expect(await StETHMinter.depositAmount()).to.be.gte(depositAmount.add(aETHAmount));
        expect(await StETHMinter.depositCap()).to.be.gte(depositCap);
    });

    it("test deposit(uint256,address): paused, expected revert", async () => {
        const sender = accounts[0];
        const senderAddr = await sender.getAddress();
        const receiver = senderAddr;
        const amount = Ether;

        await MockstETH.mint(senderAddr, amount);
        const balance = await MockstETH.balanceOf(senderAddr);
        expect(amount).to.be.lte(balance);

        await MockstETH.connect(sender).approve(StETHMinter.address, amount);
        expect(await MockstETH.allowance(senderAddr, StETHMinter.address)).to.be.gte(amount);

        const senderBalance = await aETH.balanceOf(senderAddr);
        const receiverBalance = await aETH.balanceOf(receiver);
        const totalSupply = await aETH.totalSupply();
        const depositCap = await StETHMinter.depositCap();
        const depositAmount = await StETHMinter.depositAmount();
        expect(depositCap.sub(depositAmount)).to.be.gte(amount);

        await StETHMinter._close();
        expect(await StETHMinter.paused()).to.be.equal(true);

        await expect(StETHMinter.connect(sender)["deposit(uint256,address)"](amount, receiver)).to.be.revertedWith(
            "Pausable: paused"
        );
        const aETHAmount = await StETHMinter.convertToAETH(ZERO);
        expect(await aETH.balanceOf(senderAddr)).to.be.gte(senderBalance.add(aETHAmount));
        expect(await aETH.balanceOf(receiver)).to.be.gte(receiverBalance.add(aETHAmount));
        expect(await aETH.totalSupply()).to.be.gte(totalSupply.add(aETHAmount));
        expect(await StETHMinter.depositAmount()).to.be.gte(depositAmount.add(aETHAmount));
        expect(await StETHMinter.depositCap()).to.be.gte(depositCap);
    });

    it("test deposit(uint256): paused, expected revert", async () => {
        const sender = accounts[0];
        const senderAddr = await sender.getAddress();
        const amount = Ether;

        await MockstETH.mint(senderAddr, amount);
        const balance = await MockstETH.balanceOf(senderAddr);
        expect(amount).to.be.lte(balance);

        await MockstETH.connect(sender).approve(StETHMinter.address, amount);
        expect(await MockstETH.allowance(senderAddr, StETHMinter.address)).to.be.gte(amount);

        const senderBalance = await aETH.balanceOf(senderAddr);
        const totalSupply = await aETH.totalSupply();
        const depositCap = await StETHMinter.depositCap();
        const depositAmount = await StETHMinter.depositAmount();
        expect(depositCap.sub(depositAmount)).to.be.gte(amount);

        expect(await StETHMinter.paused()).to.be.equal(true);

        await expect(StETHMinter.connect(sender)["deposit(uint256)"](amount)).to.be.revertedWith("Pausable: paused");
        const aETHAmount = await StETHMinter.convertToAETH(ZERO);
        expect(await aETH.balanceOf(senderAddr)).to.be.gte(senderBalance.add(aETHAmount));
        expect(await aETH.totalSupply()).to.be.gte(totalSupply.add(aETHAmount));
        expect(await StETHMinter.depositAmount()).to.be.gte(depositAmount.add(aETHAmount));
        expect(await StETHMinter.depositCap()).to.be.gte(depositCap);
    });
    // it("test deposit(uint256,address): Not approved, expected revert", async () => {
    //     const sender = accounts[0];
    //     const senderAddr = await sender.getAddress();
    //     const receiver = senderAddr;
    //     const balance = await MockstETH.balanceOf(senderAddr);
    //     const amount = balance;
    //     await expect(StETHMinter.deposit()).to.be.revertedWith("Initializable: contract is already initialized");
    // });
    // it("test deposit(uint256,address): Not approved, expected revert", async () => {
    //     const sender = accounts[0];
    //     const senderAddr = await sender.getAddress();
    //     const receiver = senderAddr;
    //     const balance = await MockstETH.balanceOf(senderAddr);
    //     const amount = balance;
    //     await expect(StETHMinter.deposit()).to.be.revertedWith("Initializable: contract is already initialized");
    // });
});
