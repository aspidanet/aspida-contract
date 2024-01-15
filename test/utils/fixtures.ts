import { ethers, waffle } from "hardhat";
import { Contract, utils } from "ethers";
import { getCallData } from "./helper";

// Use ethers provider instead of waffle's default MockProvider
// export const loadFixture = waffle.loadFixture;

let ProxyAdminPro: Contract;

export async function deployContract(contractName: string, args: any[]) {
    const contract = await ethers.getContractFactory(contractName);
    const deployed = await contract.deploy(...args);
    await deployed.deployed();
    return deployed;
}

export async function deployProxy(contractName: string, constructorArgs: any[], initFunctionName: string, args: any[]) {
    const ImplContract = await deployContract(contractName, constructorArgs);

    const functionName: any = ImplContract.interface.getFunction(initFunctionName);
    const data = ImplContract.interface.encodeFunctionData(functionName, args);
    const Proxy = await deployContract("TransparentUpgradeableProxy", [
        ImplContract.address,
        ProxyAdminPro.address,
        data,
    ]);

    const Contract = await ethers.getContractAt(contractName, Proxy.address);

    return { impl: ImplContract, proxy: Proxy, contract: Contract };
}

export async function fixtureDefault() {
    // Get all accounts
    const [owner, manager, pauseGuardian, minter, ...accounts] = await ethers.getSigners();
    const ownerAddr = await owner.getAddress();
    const managerAddr = await manager.getAddress();
    const pauseGuardianAddr = await pauseGuardian.getAddress();
    const minterAddr = await minter.getAddress();

    // Deploy ProxyAdminPro contract
    ProxyAdminPro = await deployContract("ProxyAdminPro", []);

    // Deploy DepositContract contract
    const DepositContract: Contract = await deployContract("DepositContract", []);

    const { contract: aETH } = await deployProxy("aETH", [], "initialize(string,string)", ["Aspida Ether", "aETH"]);
    const { contract: saETH } = await deployProxy("saETH", [], "initialize(string,string,address)", [
        "Aspida Stake Ether",
        "saETH",
        aETH.address,
    ]);
    const { contract: CorePrimary } = await deployProxy(
        "CorePrimary",
        [DepositContract.address, aETH.address, saETH.address],
        "initialize()",
        []
    );
    const zeroEpochTimestamp = utils.parseUnits("1606824023", 0);
    const { contract: RewardOracle } = await deployProxy(
        "RewardOracle",
        [CorePrimary.address, zeroEpochTimestamp],
        "initialize()",
        []
    );

    const { contract: MockstETH } = await deployProxy("MockstETH", [], "initialize()", []);
    const { contract: StETHMinter } = await deployProxy(
        "StETHMinter",
        [aETH.address, MockstETH.address],
        "initialize()",
        []
    );

    await aETH._addPauseGuardian(pauseGuardianAddr);
    await aETH._addManager(CorePrimary.address);
    await aETH._addManager(managerAddr);

    await saETH._addPauseGuardian(pauseGuardianAddr);

    await CorePrimary._addPauseGuardian(pauseGuardianAddr);
    await CorePrimary._addManager(managerAddr);
    await CorePrimary._setRewardOracle(RewardOracle.address);

    await RewardOracle._addPauseGuardian(pauseGuardianAddr);
    await RewardOracle._addManager(managerAddr);

    await MockstETH._addManager(ownerAddr);

    await StETHMinter._addPauseGuardian(pauseGuardianAddr);

    return {
        owner,
        manager,
        pauseGuardian,
        accounts,
        DepositContract,
        aETH,
        saETH,
        CorePrimary,
        RewardOracle,
        MockstETH,
        StETHMinter,
    };
}
