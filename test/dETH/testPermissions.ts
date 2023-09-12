import { Signer, Contract } from "ethers";
import { expect } from "chai";

import { fixtureDefault } from "../utils/fixtures";
import { MAX, ZERO, ONE, TWO, NegativeOne, Ether, AddressZero, AbiCoder } from "../utils/constants";

describe("Test dETH permissions", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let DepositContract: Contract;
    let dETH: Contract;
    let sdETH: Contract;
    let CorePrimary: Contract;
    let RewardOracle: Contract;

    async function init() {
        ({ owner, manager, pauseGuardian, accounts, DepositContract, dETH, sdETH, CorePrimary, RewardOracle } =
            await fixtureDefault());
    }

    before(async function () {
        await init();
    });

    it("test initialize: Already initialized, expected revert", async () => {
        await expect(dETH.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("test _close: Not pause guardian, expected revert", async () => {
        const sender = accounts[1];
        expect(await dETH.isPauseGuardian(await sender.getAddress())).to.be.equal(false);

        await expect(dETH.connect(sender)._close()).to.be.revertedWith(
            "onlyPauseGuardian: caller is not pauseGuardian"
        );
    });

    it("test _close: is the pause guardian, success", async () => {
        const sender = pauseGuardian;
        expect(await dETH.isPauseGuardian(await sender.getAddress())).to.be.equal(true);

        await dETH.connect(sender)._close();

        expect(await dETH.paused()).to.be.equal(true);
    });

    it("test _open: Not owner, expected revert", async () => {
        const sender = pauseGuardian;

        await expect(dETH.connect(sender)._open()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("test _open: is owner, success", async () => {
        const sender = owner;

        await dETH.connect(sender)._open();

        expect(await dETH.paused()).to.be.equal(false);
    });

    it("test _close: is owner, success", async () => {
        const sender = owner;
        expect(await dETH.isPauseGuardian(await sender.getAddress())).to.be.equal(true);

        await dETH.connect(sender)._close();
        expect(await dETH.paused()).to.be.equal(true);
    });

    it("test _addPauseGuardian: Not owner, expected revert", async () => {
        const sender = manager;
        const newPauseGuardian = await accounts[0].getAddress();
        expect(await dETH.isPauseGuardian(newPauseGuardian)).to.be.equal(false);

        await expect(dETH.connect(sender)._addPauseGuardian(newPauseGuardian)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _addPauseGuardian: is owner, success", async () => {
        const sender = owner;
        const newPauseGuardian = await accounts[0].getAddress();
        const pauseGuardians = await dETH.pauseGuardians();
        expect(pauseGuardians.includes(newPauseGuardian)).to.be.equal(false);

        await dETH.connect(sender)._addPauseGuardian(newPauseGuardian);
        expect(await dETH.isPauseGuardian(newPauseGuardian)).to.be.equal(true);
    });

    it("test _addPauseGuardian: is owner, pause guardian already exists, expected revert", async () => {
        const sender = owner;
        const newPauseGuardian = await accounts[0].getAddress();
        expect(await dETH.isPauseGuardian(newPauseGuardian)).to.be.equal(true);

        await expect(dETH.connect(sender)._addPauseGuardian(newPauseGuardian)).to.be.revertedWith(
            "_addPauseGuardianInternal: _pauseGuardian has been added"
        );
    });

    it("test _addPauseGuardian: is owner, pause guardian is zero address, expected revert", async () => {
        const sender = owner;
        const newPauseGuardian = AddressZero;
        expect(await dETH.isPauseGuardian(newPauseGuardian)).to.be.equal(false);

        await expect(dETH.connect(sender)._addPauseGuardian(newPauseGuardian)).to.be.revertedWith(
            "_addPauseGuardianInternal: _pauseGuardian the zero address"
        );
    });

    it("test _removePauseGuardian: Not owner, expected revert", async () => {
        const sender = pauseGuardian;
        const pauseGuardianAddr = await accounts[0].getAddress();
        expect(await dETH.isPauseGuardian(pauseGuardianAddr)).to.be.equal(true);

        await expect(dETH.connect(sender)._removePauseGuardian(pauseGuardianAddr)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _removePauseGuardian: is owner, success", async () => {
        const sender = owner;
        const newPauseGuardian = await accounts[0].getAddress();
        expect(await dETH.isPauseGuardian(newPauseGuardian)).to.be.equal(true);

        await dETH.connect(sender)._removePauseGuardian(newPauseGuardian);
        expect(await dETH.isPauseGuardian(newPauseGuardian)).to.be.equal(false);
    });

    it("test _removePauseGuardian: is owner,pause guardian does not exist, expected revert", async () => {
        const sender = owner;
        const newPauseGuardian = await accounts[0].getAddress();
        expect(await dETH.isPauseGuardian(newPauseGuardian)).to.be.equal(false);

        await expect(dETH.connect(sender)._removePauseGuardian(newPauseGuardian)).to.be.revertedWith(
            "_removePauseGuardianInternal: _pauseGuardian has been removed"
        );
    });

    it("test _addManager: Not owner, expected revert", async () => {
        const sender = manager;
        const newManager = await accounts[0].getAddress();
        expect(await dETH.isManager(newManager)).to.be.equal(false);

        await expect(dETH.connect(sender)._addManager(newManager)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _addManager: is owner, success", async () => {
        const sender = owner;
        const newManager = await accounts[0].getAddress();
        expect(await dETH.isManager(newManager)).to.be.equal(false);

        await dETH.connect(sender)._addManager(newManager);
        expect(await dETH.isManager(newManager)).to.be.equal(true);
    });

    it("test _addManager: is owner, manager already exists, expected revert", async () => {
        const sender = owner;
        const newManager = await accounts[0].getAddress();
        expect(await dETH.isManager(newManager)).to.be.equal(true);

        await expect(dETH.connect(sender)._addManager(newManager)).to.be.revertedWith(
            "_addManagerInternal: _manager has been added"
        );
    });

    it("test _addManager: is owner, pause guardian is zero address, expected revert", async () => {
        const sender = owner;
        const newManager = AddressZero;
        expect(await dETH.isManager(newManager)).to.be.equal(false);

        await expect(dETH.connect(sender)._addManager(newManager)).to.be.revertedWith(
            "_addManagerInternal: _manager the zero address"
        );
    });

    it("test _removeManager: Not owner, expected revert", async () => {
        const sender = pauseGuardian;
        const pauseGuardianAddr = await accounts[0].getAddress();
        expect(await dETH.isManager(pauseGuardianAddr)).to.be.equal(true);

        await expect(dETH.connect(sender)._removeManager(pauseGuardianAddr)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _removeManager: is owner, success", async () => {
        const sender = owner;
        const newManager = await accounts[0].getAddress();
        const managers = await dETH.managers();
        expect(managers.includes(newManager)).to.be.equal(true);

        await dETH.connect(sender)._removeManager(newManager);
        expect(await dETH.isManager(newManager)).to.be.equal(false);
    });

    it("test _removeManager: is owner, manager does not exist, expected revert", async () => {
        const sender = owner;
        const newManager = await accounts[0].getAddress();
        expect(await dETH.isManager(newManager)).to.be.equal(false);

        await expect(dETH.connect(sender)._removeManager(newManager)).to.be.revertedWith(
            "_removeManagerInternal: _manager has been removed"
        );
    });

    it("test _setMinterCap: Not owner, expected revert", async () => {
        const sender = accounts[0];
        const minter = await sender.getAddress();
        expect(await dETH.mintCap(minter)).to.be.equal(ZERO);

        const mintCap = Ether.mul(TWO);
        await expect(dETH.connect(sender)._setMinterCap(minter, mintCap)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("test _setMinterCap: is owner, success", async () => {
        const sender = owner;
        const minter = await accounts[0].getAddress();
        expect(await dETH.mintCap(minter)).to.be.equal(ZERO);

        const mintCap = Ether.mul(TWO);
        await dETH.connect(sender)._setMinterCap(minter, mintCap);
        expect(await dETH.mintCap(minter)).to.be.equal(mintCap);
    });

    it("test _setMinterCap: is owner, set the same cap, expected revert", async () => {
        const sender = owner;
        const minter = await accounts[0].getAddress();

        const mintCap = await dETH.mintCap(minter);
        await expect(dETH.connect(sender)._setMinterCap(minter, mintCap)).to.be.revertedWith(
            "_setMinterCapInternal: Cannot set the same value"
        );
    });

    it("test _setMinterCap: is owner, minter is zero address, expected revert", async () => {
        const sender = owner;
        const minter = AddressZero;
        expect(await dETH.mintCap(minter)).to.be.equal(ZERO);

        const mintCap = Ether.mul(TWO);
        await expect(dETH.connect(sender)._setMinterCap(minter, mintCap)).to.be.revertedWith(
            "_setMinterCapInternal: Minter the zero address"
        );
    });
});
