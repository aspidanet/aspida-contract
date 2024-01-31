import { Signer, Contract } from "ethers";
import { expect } from "chai";

import { MAX, ZERO, ONE, TWO, NegativeOne, Ether, AddressZero, AbiCoder } from "../utils/constants";

export interface LibraryTestData {
    owner: Signer;
    manager: Signer;
    pauseGuardian: Signer;
    accounts: Signer[];
    contract: Contract;
}

export async function testManable(libraryTestData: LibraryTestData, content: string) {
    describe(`Test ${content} Manable test`, async () => {
        const owner: Signer = libraryTestData.owner;
        const manager: Signer = libraryTestData.manager;
        const pauseGuardian: Signer = libraryTestData.pauseGuardian;
        const accounts: Signer[] = libraryTestData.accounts;

        const contract: Contract = libraryTestData.contract;

        it(`test ${content} _addManager: Not owner, expected revert`, async () => {
            const sender = manager;
            const newManager = await accounts[0].getAddress();
            expect(await contract.isManager(newManager)).to.be.equal(false);

            await expect(contract.connect(sender)._addManager(newManager)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it(`test ${content} _addManager: is owner, success`, async () => {
            const sender = owner;
            const newManager = await accounts[0].getAddress();
            expect(await contract.isManager(newManager)).to.be.equal(false);

            await contract.connect(sender)._addManager(newManager);
            expect(await contract.isManager(newManager)).to.be.equal(true);
        });

        it(`test ${content} _addManager: is owner, manager already exists, expected revert`, async () => {
            const sender = owner;
            const newManager = await accounts[0].getAddress();
            expect(await contract.isManager(newManager)).to.be.equal(true);

            await expect(contract.connect(sender)._addManager(newManager)).to.be.revertedWith(
                "_addManagerInternal: _manager has been added"
            );
        });

        it(`test ${content} _addManager: is owner, pause guardian is zero address, expected revert`, async () => {
            const sender = owner;
            const newManager = AddressZero;
            expect(await contract.isManager(newManager)).to.be.equal(false);

            await expect(contract.connect(sender)._addManager(newManager)).to.be.revertedWith(
                "_addManagerInternal: _manager the zero address"
            );
        });

        it(`test ${content} _removeManager: Not owner, expected revert`, async () => {
            const sender = pauseGuardian;
            const pauseGuardianAddr = await accounts[0].getAddress();
            expect(await contract.isManager(pauseGuardianAddr)).to.be.equal(true);

            await expect(contract.connect(sender)._removeManager(pauseGuardianAddr)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it(`test ${content} _removeManager: is owner, success`, async () => {
            const sender = owner;
            const newManager = await accounts[0].getAddress();
            const managers = await contract.managers();
            expect(managers.includes(newManager)).to.be.equal(true);

            await contract.connect(sender)._removeManager(newManager);
            expect(await contract.isManager(newManager)).to.be.equal(false);
        });

        it(`test ${content} _removeManager: is owner, manager does not exist, expected revert`, async () => {
            const sender = owner;
            const newManager = await accounts[0].getAddress();
            expect(await contract.isManager(newManager)).to.be.equal(false);

            await expect(contract.connect(sender)._removeManager(newManager)).to.be.revertedWith(
                "_removeManagerInternal: _manager has been removed"
            );
        });
    });
}

export async function testPauseGuardian(libraryTestData: LibraryTestData, content: string) {
    describe(`Test ${content} PauseGuardian test`, async () => {
        const owner: Signer = libraryTestData.owner;
        const manager: Signer = libraryTestData.manager;
        const pauseGuardian: Signer = libraryTestData.pauseGuardian;
        const accounts: Signer[] = libraryTestData.accounts;

        const contract: Contract = libraryTestData.contract;

        it(`test ${content} _close: Not pause guardian, expected revert`, async () => {
            const sender = accounts[1];
            expect(await contract.isPauseGuardian(await sender.getAddress())).to.be.equal(false);

            await expect(contract.connect(sender)._close()).to.be.revertedWith(
                "onlyPauseGuardian: caller is not pauseGuardian"
            );
        });

        it(`test ${content} _close: is the pause guardian, success`, async () => {
            const sender = pauseGuardian;
            expect(await contract.isPauseGuardian(await sender.getAddress())).to.be.equal(true);

            await contract.connect(sender)._close();

            expect(await contract.paused()).to.be.equal(true);
        });

        it(`test ${content} _open: Not owner, expected revert`, async () => {
            const sender = pauseGuardian;

            await expect(contract.connect(sender)._open()).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it(`test ${content} _open: is owner, success`, async () => {
            const sender = owner;

            await contract.connect(sender)._open();

            expect(await contract.paused()).to.be.equal(false);
        });

        it(`test ${content} _close: is owner, success`, async () => {
            const sender = owner;
            expect(await contract.isPauseGuardian(await sender.getAddress())).to.be.equal(true);

            await contract.connect(sender)._close();
            expect(await contract.paused()).to.be.equal(true);

            await contract._open();
        });

        it(`test ${content} _addPauseGuardian: Not owner, expected revert`, async () => {
            const sender = manager;
            const newPauseGuardian = await accounts[0].getAddress();
            expect(await contract.isPauseGuardian(newPauseGuardian)).to.be.equal(false);

            await expect(contract.connect(sender)._addPauseGuardian(newPauseGuardian)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it(`test ${content} _addPauseGuardian: is owner, success`, async () => {
            const sender = owner;
            const newPauseGuardian = await accounts[0].getAddress();
            const pauseGuardians = await contract.pauseGuardians();
            expect(pauseGuardians.includes(newPauseGuardian)).to.be.equal(false);

            await contract.connect(sender)._addPauseGuardian(newPauseGuardian);
            expect(await contract.isPauseGuardian(newPauseGuardian)).to.be.equal(true);
        });

        it(`test ${content} _addPauseGuardian: is owner, pause guardian already exists, expected revert`, async () => {
            const sender = owner;
            const newPauseGuardian = await accounts[0].getAddress();
            expect(await contract.isPauseGuardian(newPauseGuardian)).to.be.equal(true);

            await expect(contract.connect(sender)._addPauseGuardian(newPauseGuardian)).to.be.revertedWith(
                "_addPauseGuardianInternal: _pauseGuardian has been added"
            );
        });

        it(`test ${content} _addPauseGuardian: is owner, pause guardian is zero address, expected revert`, async () => {
            const sender = owner;
            const newPauseGuardian = AddressZero;
            expect(await contract.isPauseGuardian(newPauseGuardian)).to.be.equal(false);

            await expect(contract.connect(sender)._addPauseGuardian(newPauseGuardian)).to.be.revertedWith(
                "_addPauseGuardianInternal: _pauseGuardian the zero address"
            );
        });

        it(`test ${content} _removePauseGuardian: Not owner, expected revert`, async () => {
            const sender = pauseGuardian;
            const pauseGuardianAddr = await accounts[0].getAddress();
            expect(await contract.isPauseGuardian(pauseGuardianAddr)).to.be.equal(true);

            await expect(contract.connect(sender)._removePauseGuardian(pauseGuardianAddr)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it(`test ${content} _removePauseGuardian: is owner, success`, async () => {
            const sender = owner;
            const newPauseGuardian = await accounts[0].getAddress();
            expect(await contract.isPauseGuardian(newPauseGuardian)).to.be.equal(true);

            await contract.connect(sender)._removePauseGuardian(newPauseGuardian);
            expect(await contract.isPauseGuardian(newPauseGuardian)).to.be.equal(false);
        });

        it(`test ${content} _removePauseGuardian: is owner,pause guardian does not exist, expected revert`, async () => {
            const sender = owner;
            const newPauseGuardian = await accounts[0].getAddress();
            expect(await contract.isPauseGuardian(newPauseGuardian)).to.be.equal(false);

            await expect(contract.connect(sender)._removePauseGuardian(newPauseGuardian)).to.be.revertedWith(
                "_removePauseGuardianInternal: _pauseGuardian has been removed"
            );
        });
    });
}

export async function testMinter(libraryTestData: LibraryTestData, content: string) {
    describe(`Test ${content} Minter test`, async () => {
        const owner: Signer = libraryTestData.owner;
        const manager: Signer = libraryTestData.manager;
        const pauseGuardian: Signer = libraryTestData.pauseGuardian;
        const accounts: Signer[] = libraryTestData.accounts;

        const contract: Contract = libraryTestData.contract;

        it(`test ${content} _setMinterCap: Not owner, expected revert`, async () => {
            const sender = accounts[0];
            const minter = await sender.getAddress();
            expect(await contract.mintCap(minter)).to.be.equal(ZERO);

            const mintCap = Ether.mul(TWO);
            await expect(contract.connect(sender)._setMinterCap(minter, mintCap)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it(`test ${content} _setMinterCap: is owner, success`, async () => {
            const sender = owner;
            const minter = await accounts[0].getAddress();
            expect(await contract.mintCap(minter)).to.be.equal(ZERO);

            const mintCap = Ether.mul(TWO);
            await contract.connect(sender)._setMinterCap(minter, mintCap);
            expect(await contract.mintCap(minter)).to.be.equal(mintCap);
        });

        it(`test ${content} _setMinterCap: is owner, set the same cap, expected revert`, async () => {
            const sender = owner;
            const minter = await accounts[0].getAddress();

            const mintCap = await contract.mintCap(minter);
            await expect(contract.connect(sender)._setMinterCap(minter, mintCap)).to.be.revertedWith(
                "_setMinterCapInternal: Cannot set the same value"
            );
        });

        it(`test ${content} _setMinterCap: is owner, minter is zero address, expected revert`, async () => {
            const sender = owner;
            const minter = AddressZero;
            expect(await contract.mintCap(minter)).to.be.equal(ZERO);

            const mintCap = Ether.mul(TWO);
            await expect(contract.connect(sender)._setMinterCap(minter, mintCap)).to.be.revertedWith(
                "_setMinterCapInternal: Minter the zero address"
            );
        });
    });
}
