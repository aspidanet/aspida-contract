import { ethers, waffle } from "hardhat";
import { Contract } from "ethers";
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
    const managerAddr = await manager.getAddress();
    const pauseGuardianAddr = await pauseGuardian.getAddress();
    const minterAddr = await minter.getAddress();

    // Deploy ProxyAdminPro contract
    ProxyAdminPro = await deployContract("ProxyAdminPro", []);

    // Deploy DepositContract contract
    const DepositContract: Contract = await deployContract("DepositContract", []);

    const { contract: dETH } = await deployProxy("dETH", [], "initialize()", []);
    const { contract: sdETH } = await deployProxy("sdETH", [dETH.address], "initialize(address)", [dETH.address]);
    const { contract: CorePrimary } = await deployProxy(
        "CorePrimary",
        [DepositContract.address, dETH.address, sdETH.address],
        "initialize()",
        []
    );
    const { contract: RewardOracle } = await deployProxy("RewardOracle", [CorePrimary.address], "initialize()", []);

    await dETH._addPauseGuardian(pauseGuardianAddr);
    await dETH._addManager(CorePrimary.address);
    await dETH._addManager(managerAddr);

    await sdETH._addPauseGuardian(pauseGuardianAddr);

    await CorePrimary._addPauseGuardian(pauseGuardianAddr);
    await CorePrimary._addManager(managerAddr);
    await CorePrimary._setRewardOracle(RewardOracle.address);

    await RewardOracle._addPauseGuardian(pauseGuardianAddr);
    await RewardOracle._addManager(managerAddr);

    return {
        owner,
        manager,
        pauseGuardian,
        accounts,
        DepositContract,
        dETH,
        sdETH,
        CorePrimary,
        RewardOracle,
    };
}
