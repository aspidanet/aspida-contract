import { Signer, Contract } from "ethers";
import { expect } from "chai";

import { fixtureDefault } from "../utils/fixtures";

import { LibraryTestData, testManable, testPauseGuardian, testMinter } from "../Library/testLibrary";

describe("Test dETH permissions", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let dETH: Contract;
    let libraryTestData: LibraryTestData;

    async function init() {
        const initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        dETH = initData.dETH;

        libraryTestData = {
            owner: owner,
            manager: manager,
            pauseGuardian: pauseGuardian,
            accounts: accounts,
            contract: dETH,
        };
    }

    before(async function () {
        await init();
    });

    it("test initialize: Already initialized, expected revert", async () => {
        await expect(dETH.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("test testManable, success", async () => {
        await testManable(libraryTestData, "dETH");
    });

    it("test testPauseGuardian, success", async () => {
        await testPauseGuardian(libraryTestData, "dETH");
    });

    it("test testMinter, success", async () => {
        await testMinter(libraryTestData, "dETH");
    });
});
