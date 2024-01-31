import { Signer, Contract } from "ethers";
import { expect } from "chai";

import { fixtureDefault } from "../utils/fixtures";
import { MAX, ZERO, ONE, TWO, NegativeOne, Ether, AddressZero, AbiCoder } from "../utils/constants";

describe("Test aETH unit test", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let aETH: Contract;

    async function init() {
        const initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        aETH = initData.aETH;
    }

    before(async function () {
        await init();
    });

    it("test mint: not a manager, expected revert", async () => {
        const sender = accounts[0];
        const receiver = await sender.getAddress();
        const amount = Ether;

        await expect(aETH.connect(sender).mint(receiver, amount)).to.be.revertedWith(
            "onlyManager: caller is not manager"
        );
    });

    it("test mint: is the manager, success", async () => {
        const sender = manager;
        const receiver = await accounts[0].getAddress();
        const amount = Ether;
        await expect(aETH.connect(sender).mint(receiver, amount)).changeTokenBalances(
            aETH,
            [aETH.address, sender, receiver],
            [ZERO, ZERO, amount]
        );
    });

    it("test mint: Mint amount is 0, success", async () => {
        const sender = manager;
        const receiver = await accounts[0].getAddress();
        const amount = ZERO;
        await expect(aETH.connect(sender).mint(receiver, amount)).changeTokenBalances(
            aETH,
            [sender, receiver],
            [ZERO, amount]
        );
    });

    it("test mint: Mint to this contract, success", async () => {
        const sender = manager;
        const receiver = aETH.address;
        const amount = Ether;
        await expect(aETH.connect(sender).mint(receiver, amount)).changeTokenBalances(
            aETH,
            [sender, receiver],
            [ZERO, amount]
        );
    });

    it("test mint: Remove manager, expected revert", async () => {
        const sender = manager;
        const receiver = await accounts[0].getAddress();
        const amount = Ether;
        await aETH._removeManager(await manager.getAddress());
        await expect(aETH.connect(sender).mint(receiver, amount)).to.be.revertedWith(
            "onlyManager: caller is not manager"
        );
    });

    it("test burnFrom: not a manager, expected revert", async () => {
        const sender = accounts[1];
        expect(await aETH.isManager(await sender.getAddress())).to.be.equal(false);

        const account = await accounts[0].getAddress();
        const amount = await aETH.balanceOf(account);
        await expect(aETH.connect(sender).burnFrom(account, amount)).to.be.revertedWith(
            "onlyManager: caller is not manager"
        );
    });

    it("test burnFrom: is the manager, sender != account Not approved, expected revert", async () => {
        const sender = manager;
        const newManager = await sender.getAddress();
        await aETH._addManager(newManager);
        expect(await aETH.isManager(await sender.getAddress())).to.be.equal(true);

        const account = await accounts[0].getAddress();
        const amount = await aETH.balanceOf(account);
        await expect(aETH.connect(sender).burnFrom(account, amount)).to.be.revertedWith(
            "ERC20: insufficient allowance"
        );
    });

    it("test burnFrom: is the manager, sender != account Insufficient approved amount, expected revert", async () => {
        const sender = manager;
        expect(await aETH.isManager(await sender.getAddress())).to.be.equal(true);

        const holder = accounts[0];

        const account = await holder.getAddress();
        const amount = await aETH.balanceOf(account);
        await aETH.connect(holder).approve(await sender.getAddress(), amount.sub(ONE));

        await expect(aETH.connect(sender).burnFrom(account, amount)).to.be.revertedWith(
            "ERC20: insufficient allowance"
        );
    });

    it("test burnFrom: is the manager, sender != account approved amount is sufficient, success", async () => {
        const sender = manager;
        expect(await aETH.isManager(await sender.getAddress())).to.be.equal(true);

        const holder = accounts[0];

        const account = await holder.getAddress();
        const amount = (await aETH.balanceOf(account)).div(TWO);
        await aETH.connect(holder).approve(await sender.getAddress(), amount);

        await expect(aETH.connect(sender).burnFrom(account, amount)).changeTokenBalances(
            aETH,
            [sender, account],
            [ZERO, amount.mul(NegativeOne)]
        );
    });

    it("test burnFrom: is the manager, sender == account, success", async () => {
        const sender = manager;
        expect(await aETH.isManager(await sender.getAddress())).to.be.equal(true);

        const account = await sender.getAddress();
        const amount = (await aETH.balanceOf(account)).div(TWO);
        await expect(aETH.connect(sender).burnFrom(account, amount)).changeTokenBalances(
            aETH,
            [sender, account],
            [amount.mul(NegativeOne), amount.mul(NegativeOne)]
        );
    });

    it("test burnFrom: is the manager, sender == account amount = 0, success", async () => {
        const sender = manager;
        expect(await aETH.isManager(await sender.getAddress())).to.be.equal(true);

        const account = await sender.getAddress();
        const amount = ZERO;
        await expect(aETH.connect(sender).burnFrom(account, amount)).changeTokenBalances(
            aETH,
            [sender, account],
            [amount.mul(NegativeOne), amount.mul(NegativeOne)]
        );
    });

    it("test minterMint: minter's mintCap = 0 amount = 0, success", async () => {
        const minter = accounts[0];
        const receiver = await minter.getAddress();

        const mintCap = await aETH.mintCap(receiver);
        const mintAmount = await aETH.mintAmount(receiver);
        expect(mintCap).to.be.gte(mintAmount);

        const amount = mintCap.sub(mintAmount);
        await expect(aETH.connect(minter).minterMint(receiver, amount)).changeTokenBalances(
            aETH,
            [minter, receiver],
            [amount, amount]
        );
    });

    it("test minterMint: minter's mintCap < amount + mintAmount, expected revert", async () => {
        const minter = accounts[0];
        const receiver = await minter.getAddress();

        const mintCap = await aETH.mintCap(receiver);
        const mintAmount = await aETH.mintAmount(receiver);
        const amount = Ether;
        expect(mintCap).to.be.lt(mintAmount.add(amount));

        await expect(aETH.connect(minter).minterMint(receiver, amount)).to.be.revertedWith(
            "_checkMintCap: Minter mint capacity reached"
        );
    });

    it("test minterMint: minter's mintCap > amount + mintAmount, success", async () => {
        const minter = accounts[0];
        const receiver = await minter.getAddress();

        const mintCap = Ether.mul(TWO);
        await aETH._setMinterCap(receiver, mintCap);

        const mintAmount = await aETH.mintAmount(receiver);
        const amount = Ether;
        expect(mintCap).to.be.gt(mintAmount.add(amount));

        await expect(aETH.connect(minter).minterMint(receiver, amount)).changeTokenBalances(
            aETH,
            [minter, receiver],
            [amount, amount]
        );
    });

    it("test minterMint: minter's mintCap = amount + mintAmount, success", async () => {
        const minter = accounts[0];
        const minterAddr = await accounts[0].getAddress();
        const receiver = await accounts[1].getAddress();

        const mintCap = await aETH.mintCap(minterAddr);
        const mintAmount = await aETH.mintAmount(minterAddr);
        const amount = mintCap.sub(mintAmount);
        expect(amount).to.be.gt(ZERO);

        await expect(aETH.connect(minter).minterMint(receiver, amount)).changeTokenBalances(
            aETH,
            [minter, receiver],
            [ZERO, amount]
        );

        expect(await aETH.mintCap(minterAddr)).to.be.equal(await aETH.mintAmount(minterAddr));
    });

    it("test minterMint: minter's mintCap < amount + mintAmount, expected revert", async () => {
        const minter = accounts[0];
        const minterAddr = await accounts[0].getAddress();
        const receiver = await accounts[1].getAddress();

        const mintCap = await aETH.mintCap(minterAddr);
        const mintAmount = await aETH.mintAmount(minterAddr);
        expect(mintCap).to.be.equal(mintAmount);

        const amount = ONE;
        await expect(aETH.connect(minter).minterMint(receiver, amount)).to.be.revertedWith(
            "_checkMintCap: Minter mint capacity reached"
        );

        expect(await aETH.mintCap(minterAddr)).to.be.equal(await aETH.mintAmount(minterAddr));
    });

    it("test minterBurn: minter's mintCap = 0, amount > 0, expected revert", async () => {
        const minter = accounts[1];
        const minterAddr = await minter.getAddress();

        const mintCap = await aETH.mintCap(minterAddr);
        const mintAmount = await aETH.mintAmount(minterAddr);
        expect(mintCap).to.be.equal(ZERO);
        expect(mintAmount).to.be.equal(ZERO);

        const amount = await aETH.balanceOf(minterAddr);
        expect(amount).to.be.gt(ZERO);
        await expect(aETH.connect(minter).minterBurn(amount)).to.be.reverted;

        expect(await aETH.mintCap(minterAddr)).to.be.equal(await aETH.mintAmount(minterAddr));
    });

    it("test minterBurn: minter's mintCap > 0, mintAmount > amount, success", async () => {
        const minter = accounts[0];
        const minterAddr = await minter.getAddress();

        const mintCap = await aETH.mintCap(minterAddr);
        const mintAmount = await aETH.mintAmount(minterAddr);
        const amount = (await aETH.balanceOf(minterAddr)).div(TWO);
        expect(mintCap).to.be.gt(ZERO);
        expect(amount).to.be.gt(ZERO);
        expect(mintAmount).to.be.gt(amount);

        await expect(aETH.connect(minter).minterBurn(amount)).changeTokenBalances(
            aETH,
            [minter],
            [amount.mul(NegativeOne)]
        );
    });

    it("test pause: transfer, expected revert", async () => {
        await aETH._close();

        const sender = accounts[0];
        const receiver = await accounts[1].getAddress();

        const amount = (await aETH.balanceOf(await sender.getAddress())).div(TWO);
        expect(amount).to.be.gt(ZERO);
        await expect(aETH.connect(sender).transfer(receiver, amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });

    it("test pause: transferFrom, expected revert", async () => {
        const sender = accounts[0];
        const from = accounts[1];
        const fromAddr = await from.getAddress();
        const receiver = await sender.getAddress();

        const amount = (await aETH.balanceOf(fromAddr)).div(TWO);
        expect(amount).to.be.gt(ZERO);

        await aETH.connect(from).approve(receiver, amount);
        expect(await aETH.allowance(fromAddr, receiver)).to.be.equal(amount);

        await expect(aETH.connect(sender).transferFrom(fromAddr, receiver, amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });

    // it("test pause: burn, expected revert", async () => {
    //     const sender = accounts[0];

    //     const amount = (await aETH.balanceOf(await sender.getAddress())).div(TWO);
    //     expect(amount).to.be.gt(ZERO);

    //     await expect(aETH.connect(sender).burn(amount)).to.be.revertedWith(
    //         "_beforeTokenTransfer: token transfer while paused"
    //     );
    // });

    it("test pause: burnFrom, expected revert", async () => {
        const sender = manager;
        expect(await aETH.isManager(await sender.getAddress())).to.be.equal(true);

        const holder = accounts[0];

        const account = await holder.getAddress();
        const amount = (await aETH.balanceOf(account)).div(TWO);
        expect(amount).to.be.gt(ZERO);

        const senderAddr = await sender.getAddress();
        await aETH.connect(holder).approve(senderAddr, amount);
        expect(await aETH.allowance(account, senderAddr)).to.be.equal(amount);

        await expect(aETH.connect(sender).burnFrom(account, amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });

    it("test pause: mint, expected revert", async () => {
        const sender = manager;
        const receiver = await sender.getAddress();
        const amount = Ether;

        expect(await aETH.isManager(receiver)).to.be.equal(true);

        await expect(aETH.connect(sender).mint(receiver, amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });

    it("test pause: minterMint, expected revert", async () => {
        const minter = accounts[0];
        const receiver = await minter.getAddress();

        const mintCap = await aETH.mintCap(receiver);
        const mintAmount = await aETH.mintAmount(receiver);
        expect(mintCap).to.be.gte(mintAmount);

        const amount = mintCap.sub(mintAmount);
        expect(amount).to.be.gt(ZERO);

        await expect(aETH.connect(minter).minterMint(receiver, amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });

    it("test pause: minterBurn, expected revert", async () => {
        const minter = accounts[0];
        const minterAddr = await minter.getAddress();

        const mintCap = await aETH.mintCap(minterAddr);
        const mintAmount = await aETH.mintAmount(minterAddr);
        const amount = (await aETH.balanceOf(minterAddr)).div(TWO);
        expect(mintCap).to.be.gt(ZERO);
        expect(amount).to.be.gt(ZERO);
        expect(mintAmount).to.be.gt(amount);

        await expect(aETH.connect(minter).minterBurn(amount)).to.be.revertedWith(
            "_beforeTokenTransfer: token transfer while paused"
        );
    });
});
