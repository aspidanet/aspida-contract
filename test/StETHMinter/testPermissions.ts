import { Signer, Contract } from "ethers";
import { expect } from "chai";

import { fixtureDefault } from "../utils/fixtures";

import { MAX, ZERO, ONE, TWO, NegativeOne, Ether, AddressZero } from "../utils/constants";

import { LibraryTestData, testPauseGuardian } from "../Library/testLibrary";

describe("Test StETHMinter permissions", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let MockstETH: Contract;
    let StETHMinter: Contract;

    let libraryTestData: LibraryTestData;

    async function init() {
        const initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        MockstETH = initData.MockstETH;
        StETHMinter = initData.StETHMinter;

        libraryTestData = {
            owner: owner,
            manager: manager,
            pauseGuardian: pauseGuardian,
            accounts: accounts,
            contract: StETHMinter,
        };
    }

    before(async function () {
        await init();
    });

    it("test initialize: Already initialized, expected revert", async () => {
        await expect(StETHMinter.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("test testPauseGuardian, success", async () => {
        await testPauseGuardian(libraryTestData, "StETHMinter");
    });

    it("test _setReceiver: Not owner, expected revert", async () => {
        const sender = manager;
        const receiver = await accounts[0].getAddress();

        await expect(StETHMinter.connect(sender)._setReceiver(receiver)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _setReceiver: is owner, success", async () => {
        const sender = owner;
        const receiver = await accounts[0].getAddress();

        await StETHMinter.connect(sender)._setReceiver(receiver);
        expect(await StETHMinter.receiver()).to.be.equal(receiver);
    });

    it("test _setReceiver: is owner, receiver is zero address, expected revert", async () => {
        const sender = owner;
        const receiver = AddressZero;

        await expect(StETHMinter.connect(sender)._setReceiver(receiver)).to.be.revertedWith(
            "_setReceiverInternal: Invalid receiver address"
        );
    });

    it("test _setReceiver: is owner, receiver is zero address, expected revert", async () => {
        const sender = owner;
        const receiver = await StETHMinter.receiver();

        await expect(StETHMinter.connect(sender)._setReceiver(receiver)).to.be.revertedWith(
            "_setReceiverInternal: Invalid receiver address"
        );
    });

    it("test _transferOut: Not owner, expected revert", async () => {
        const sender = manager;
        const receiver = await accounts[0].getAddress();
        const amount = Ether;

        await MockstETH.mint(StETHMinter.address, amount);

        await expect(StETHMinter.connect(sender)._transferOut(MockstETH.address, amount, receiver)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _transferOut: is owner, success", async () => {
        const sender = owner;
        const receiver = await accounts[0].getAddress();
        const amount = await MockstETH.balanceOf(StETHMinter.address);
        expect(amount).to.be.gt(ZERO);

        await expect(StETHMinter.connect(sender)._transferOut(MockstETH.address, amount, receiver)).changeTokenBalances(
            MockstETH,
            [StETHMinter.address, receiver],
            [amount.mul(NegativeOne), amount]
        );
    });
});
