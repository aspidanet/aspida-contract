import { deployments, getNamedAccounts, ethers } from "hardhat";

export async function deployContract(
    name: string,
    contract: string,
    constructorArgs: any[],
    initImpl: Boolean,
    initFunctionName: string,
    args: any[]
) {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const deployInfo = await deploy(name, {
        from: deployer,
        contract: contract,
        args: constructorArgs,
        log: true,
        skipIfAlreadyDeployed: true,
    });
    if (initImpl) {
        const Contract = await ethers.getContractAt(contract, deployInfo.address);

        const owner = await Contract.owner();
        if (owner == ethers.constants.AddressZero) await Contract[initFunctionName](...args);
    }
    return deployInfo;
}

export async function deployProxy(
    name: string,
    contract: string,
    constructorArgs: any[],
    initFunctionName: string,
    args: any[],
    initImpl: Boolean
) {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const impl = await deployContract(`${contract}Impl`, contract, constructorArgs, initImpl, initFunctionName, args);

    const proxyAdmin = await deployments.get("ProxyAdmin");

    const Contract = await ethers.getContractAt(contract, impl.address);
    const functionName: any = Contract.interface.getFunction(initFunctionName);
    const data = Contract.interface.encodeFunctionData(functionName, args);

    const proxy = await deploy(name, {
        from: deployer,
        contract: "TransparentUpgradeableProxy",
        args: [impl.address, proxyAdmin.address, data],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    return { impl: impl, proxy: proxy };
}

export async function sendTransaction(contract: any, signature: string, args: any[], send: Boolean) {
    if (send) {
        const tx = await contract[signature](...args);
        // await tx.wait(2);
    } else {
        const data = contract.interface.encodeFunctionData(signature, args);
        console.log(`target address: \n${contract.target}\n`);
        console.log(`signature: \n${signature}\n`);
        console.log(`transaction data: \n${data}\n\n`);
    }
}
