import { network, deployInfo } from "../config/config";

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    if (chainId != "1" && chainId != "5") return;

    let proxyAdmin = await deployments.get("ProxyAdmin");
    let dETH = await deployments.get("dETH");
    let sdETH = await deployments.get("sdETH");
    const param = [deployInfo[network[chainId]].DepositContract, dETH.address, sdETH.address];

    let CorePrimaryImpl = await deploy("CorePrimaryImpl", {
        from: deployer,
        contract: "CorePrimary",
        args: param,
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const CorePrimaryContract = await ethers.getContractFactory("CorePrimary");
    const CorePrimaryInstance = CorePrimaryContract.attach(CorePrimaryImpl.address);

    const functionName = CorePrimaryInstance.interface.getFunction("initialize()");
    const data = CorePrimaryInstance.interface.encodeFunctionData(functionName, []);

    await deploy("CorePrimary", {
        from: deployer,
        contract: "TransparentUpgradeableProxy",
        args: [CorePrimaryImpl.address, proxyAdmin.address, data],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
module.exports.tags = ["CorePrimary"];
