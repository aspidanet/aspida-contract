import { Signer, Contract } from "ethers";
import { expect } from "chai";

import { fixtureDefault } from "../utils/fixtures";

import { LibraryTestData, testManable, testPauseGuardian, testMinter } from "../Library/testLibrary";

describe("Test aETH permissions", () => {
    let owner: Signer;
    let manager: Signer;
    let pauseGuardian: Signer;
    let accounts: Signer[];

    let aETH: Contract;
    let libraryTestData: LibraryTestData;

    async function init() {
        const initData = await fixtureDefault();
        owner = initData.owner;
        manager = initData.manager;
        pauseGuardian = initData.pauseGuardian;
        accounts = initData.accounts;
        aETH = initData.aETH;

        libraryTestData = {
            owner: owner,
            manager: manager,
            pauseGuardian: pauseGuardian,
            accounts: accounts,
            contract: aETH,
        };
    }

    before(async function () {
        await init();
    });

    it("test initialize: Already initialized, expected revert", async () => {
        await expect(aETH.initialize("Aspida Ether", "aETH")).to.be.revertedWith(
            "Initializable: contract is already initialized"
        );
    });

    it("test testManable, success", async () => {
        await testManable(libraryTestData, "aETH");
    });

    it("test testPauseGuardian, success", async () => {
        await testPauseGuardian(libraryTestData, "aETH");
    });

    it("test testMinter, success", async () => {
        await testMinter(libraryTestData, "aETH");
    });
});
