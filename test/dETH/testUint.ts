import { Signer, Contract } from "ethers";
import { expect } from "chai";

import { fixtureDefault } from "../utils/fixtures";
import { MAX, ZERO, ONE, TWO, NegativeOne, Ether, AddressZero, AbiCoder } from "../utils/constants";

describe("Test dETH unit test", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let dETH: Contract;

    async function init() {
        const initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        dETH = initData.dETH;
    }

    before(async function () {
        await init();
    });

    it("test mint: not a manager, expected revert", async () => {
        const sender = accounts[0];
        const receiver = await sender.getAddress();
        const amount = Ether;

        await expect(dETH.connect(sender).mint(receiver, amount)).to.be.revertedWith(
            "onlyManager: caller is not manager"
        );
    });

    it("test mint: is the manager, success", async () => {
        const sender = manager;
        const receiver = await accounts[0].getAddress();
        const amount = Ether;
        await expect(dETH.connect(sender).mint(receiver, amount)).changeTokenBalances(
            dETH,
            [dETH.address, sender, receiver],
            [ZERO, ZERO, amount]
        );
    });

    it("test mint: Mint amount is 0, success", async () => {
        const sender = manager;
        const receiver = await accounts[0].getAddress();
        const amount = ZERO;
        await expect(dETH.connect(sender).mint(receiver, amount)).changeTokenBalances(
            dETH,
            [sender, receiver],
            [ZERO, amount]
        );
    });

    it("test mint: Mint to this contract, success", async () => {
        const sender = manager;
        const receiver = dETH.address;
        const amount = Ether;
        await expect(dETH.connect(sender).mint(receiver, amount)).changeTokenBalances(
            dETH,
            [sender, receiver],
            [ZERO, amount]
        );
    });

    it("test mint: Remove manager, expected revert", async () => {
        const sender = manager;
        const receiver = await accounts[0].getAddress();
        const amount = Ether;
        await dETH._removeManager(await manager.getAddress());
        await expect(dETH.connect(sender).mint(receiver, amount)).to.be.revertedWith(
            "onlyManager: caller is not manager"
        );
    });

    it("test burnFrom: sender != account Not approved, expected revert", async () => {
        const sender = accounts[1];
        const account = await accounts[0].getAddress();
        const amount = await dETH.balanceOf(account);
        await expect(dETH.connect(sender).burnFrom(account, amount)).to.be.revertedWith(
            "ERC20: insufficient allowance"
        );
    });

    it("test burnFrom: sender != account Insufficient approved amount, expected revert", async () => {
        const sender = accounts[1];
        const holder = accounts[0];

        const account = await holder.getAddress();
        const amount = await dETH.balanceOf(account);
        await dETH.connect(holder).approve(await sender.getAddress(), amount.sub(ONE));

        await expect(dETH.connect(sender).burnFrom(account, amount)).to.be.revertedWith(
            "ERC20: insufficient allowance"
        );
    });

    it("test burnFrom: sender != account approved amount is sufficient, success", async () => {
        const sender = accounts[1];
        const holder = accounts[0];

        const account = await holder.getAddress();
        const amount = (await dETH.balanceOf(account)).div(TWO);
        await dETH.connect(holder).approve(await sender.getAddress(), amount);

        await expect(dETH.connect(sender).burnFrom(account, amount)).changeTokenBalances(
            dETH,
            [sender, account],
            [ZERO, amount.mul(NegativeOne)]
        );
    });

    it("test burnFrom: sender == account, success", async () => {
        const sender = accounts[0];
        const account = await sender.getAddress();
        const amount = (await dETH.balanceOf(account)).div(TWO);
        await expect(dETH.connect(sender).burnFrom(account, amount)).changeTokenBalances(
            dETH,
            [sender, account],
            [amount.mul(NegativeOne), amount.mul(NegativeOne)]
        );
    });

    it("test burnFrom: sender == account amount = 0, success", async () => {
        const sender = accounts[0];
        const account = await sender.getAddress();
        const amount = ZERO;
        await expect(dETH.connect(sender).burnFrom(account, amount)).changeTokenBalances(
            dETH,
            [sender, account],
            [amount.mul(NegativeOne), amount.mul(NegativeOne)]
        );
    });

    it("test minterMint: minter's mintCap = 0 amount = 0, success", async () => {
        const minter = accounts[0];
        const receiver = await minter.getAddress();

        const mintCap = await dETH.mintCap(receiver);
        const mintAmount = await dETH.mintAmount(receiver);
        expect(mintCap).to.be.gte(mintAmount);

        const amount = mintCap.sub(mintAmount);
        await expect(dETH.connect(minter).minterMint(receiver, amount)).changeTokenBalances(
            dETH,
            [minter, receiver],
            [amount, amount]
        );
    });

    it("test minterMint: minter's mintCap < amount + mintAmount, expected revert", async () => {
        const minter = accounts[0];
        const receiver = await minter.getAddress();

        const mintCap = await dETH.mintCap(receiver);
        const mintAmount = await dETH.mintAmount(receiver);
        const amount = Ether;
        expect(mintCap).to.be.lt(mintAmount.add(amount));

        await expect(dETH.connect(minter).minterMint(receiver, amount)).to.be.revertedWith(
            "_checkMintCap: Minter mint capacity reached"
        );
    });

    it("test minterMint: minter's mintCap > amount + mintAmount, success", async () => {
        const minter = accounts[0];
        const receiver = await minter.getAddress();

        const mintCap = Ether.mul(TWO);
        await dETH._setMinterCap(receiver, mintCap);

        const mintAmount = await dETH.mintAmount(receiver);
        const amount = Ether;
        expect(mintCap).to.be.gt(mintAmount.add(amount));

        await expect(dETH.connect(minter).minterMint(receiver, amount)).changeTokenBalances(
            dETH,
            [minter, receiver],
            [amount, amount]
        );
    });

    it("test minterMint: minter's mintCap = amount + mintAmount, success", async () => {
        const minter = accounts[0];
        const minterAddr = await accounts[0].getAddress();
        const receiver = await accounts[1].getAddress();

        const mintCap = await dETH.mintCap(minterAddr);
        const mintAmount = await dETH.mintAmount(minterAddr);
        const amount = mintCap.sub(mintAmount);
        expect(amount).to.be.gt(ZERO);

        await expect(dETH.connect(minter).minterMint(receiver, amount)).changeTokenBalances(
            dETH,
            [minter, receiver],
            [ZERO, amount]
        );

        expect(await dETH.mintCap(minterAddr)).to.be.equal(await dETH.mintAmount(minterAddr));
    });

    it("test minterMint: minter's mintCap < amount + mintAmount, expected revert", async () => {
        const minter = accounts[0];
        const minterAddr = await accounts[0].getAddress();
        const receiver = await accounts[1].getAddress();

        const mintCap = await dETH.mintCap(minterAddr);
        const mintAmount = await dETH.mintAmount(minterAddr);
        expect(mintCap).to.be.equal(mintAmount);

        const amount = ONE;
        await expect(dETH.connect(minter).minterMint(receiver, amount)).to.be.revertedWith(
            "_checkMintCap: Minter mint capacity reached"
        );

        expect(await dETH.mintCap(minterAddr)).to.be.equal(await dETH.mintAmount(minterAddr));
    });

    it("test minterBurn: minter's mintCap = 0, amount > 0, expected revert", async () => {
        const minter = accounts[1];
        const minterAddr = await minter.getAddress();

        const mintCap = await dETH.mintCap(minterAddr);
        const mintAmount = await dETH.mintAmount(minterAddr);
        expect(mintCap).to.be.equal(ZERO);
        expect(mintAmount).to.be.equal(ZERO);

        const amount = await dETH.balanceOf(minterAddr);
        expect(amount).to.be.gt(ZERO);
        await expect(dETH.connect(minter).minterBurn(amount)).to.be.reverted;

        expect(await dETH.mintCap(minterAddr)).to.be.equal(await dETH.mintAmount(minterAddr));
    });

    it("test minterBurn: minter's mintCap > 0, mintAmount > amount, success", async () => {
        const minter = accounts[0];
        const minterAddr = await minter.getAddress();

        const mintCap = await dETH.mintCap(minterAddr);
        const mintAmount = await dETH.mintAmount(minterAddr);
        const amount = (await dETH.balanceOf(minterAddr)).div(TWO);
        expect(mintCap).to.be.gt(ZERO);
        expect(amount).to.be.gt(ZERO);
        expect(mintAmount).to.be.gt(amount);

        await expect(dETH.connect(minter).minterBurn(amount)).changeTokenBalances(
            dETH,
            [minter],
            [amount.mul(NegativeOne)]
        );
    });

    it("test pause: transfer, expected revert", async () => {
        await dETH._close();

        const sender = accounts[0];
        const receiver = await accounts[1].getAddress();

        const amount = (await dETH.balanceOf(await sender.getAddress())).div(TWO);
        expect(amount).to.be.gt(ZERO);
        await expect(dETH.connect(sender).transfer(receiver, amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });

    it("test pause: transferFrom, expected revert", async () => {
        const sender = accounts[0];
        const from = accounts[1];
        const fromAddr = await from.getAddress();
        const receiver = await sender.getAddress();

        const amount = (await dETH.balanceOf(fromAddr)).div(TWO);
        expect(amount).to.be.gt(ZERO);

        await dETH.connect(from).approve(receiver, amount);
        expect(await dETH.allowance(fromAddr, receiver)).to.be.equal(amount);

        await expect(dETH.connect(sender).transferFrom(fromAddr, receiver, amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });

    it("test pause: burn, expected revert", async () => {
        const sender = accounts[0];

        const amount = (await dETH.balanceOf(await sender.getAddress())).div(TWO);
        expect(amount).to.be.gt(ZERO);

        await expect(dETH.connect(sender).burn(amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });

    it("test pause: burnFrom, expected revert", async () => {
        const sender = accounts[1];
        const holder = accounts[0];

        const account = await holder.getAddress();
        const amount = (await dETH.balanceOf(account)).div(TWO);
        expect(amount).to.be.gt(ZERO);

        const senderAddr = await sender.getAddress();
        await dETH.connect(holder).approve(senderAddr, amount);
        expect(await dETH.allowance(account, senderAddr)).to.be.equal(amount);

        await expect(dETH.connect(sender).burnFrom(account, amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });

    it("test pause: mint, expected revert", async () => {
        const sender = manager;
        const receiver = await sender.getAddress();
        const amount = Ether;

        await dETH._addManager(receiver);

        await expect(dETH.connect(sender).mint(receiver, amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });

    it("test pause: minterMint, expected revert", async () => {
        const minter = accounts[0];
        const receiver = await minter.getAddress();

        const mintCap = await dETH.mintCap(receiver);
        const mintAmount = await dETH.mintAmount(receiver);
        expect(mintCap).to.be.gte(mintAmount);

        const amount = mintCap.sub(mintAmount);
        expect(amount).to.be.gt(ZERO);

        await expect(dETH.connect(minter).minterMint(receiver, amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });

    it("test pause: minterBurn, expected revert", async () => {
        const minter = accounts[0];
        const minterAddr = await minter.getAddress();

        const mintCap = await dETH.mintCap(minterAddr);
        const mintAmount = await dETH.mintAmount(minterAddr);
        const amount = (await dETH.balanceOf(minterAddr)).div(TWO);
        expect(mintCap).to.be.gt(ZERO);
        expect(amount).to.be.gt(ZERO);
        expect(mintAmount).to.be.gt(amount);

        await expect(dETH.connect(minter).minterBurn(amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });
});
