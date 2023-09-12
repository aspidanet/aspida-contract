import { network, deployInfo } from "../config/config";

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    if (chainId != "1" && chainId != "5") return;

    let proxyAdmin = await deployments.get("ProxyAdmin");
    let dETH = await deployments.get("dETH");
    const param = [dETH.address, deployInfo[network[chainId]].strategy.Lido.stETH];

    let StETHMinterImpl = await deploy("StETHMinterImpl", {
        from: deployer,
        contract: "StETHMinter",
        args: param,
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const StETHMinterContract = await ethers.getContractFactory("StETHMinter");
    const StETHMinterInstance = StETHMinterContract.attach(StETHMinterImpl.address);

    const functionName = StETHMinterInstance.interface.getFunction("initialize()");
    const data = StETHMinterInstance.interface.encodeFunctionData(functionName, []);

    await deploy("StETHMinter", {
        from: deployer,
        contract: "TransparentUpgradeableProxy",
        args: [StETHMinterImpl.address, proxyAdmin.address, data],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
module.exports.tags = ["StETHMinter"];
