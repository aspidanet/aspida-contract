module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    if (chainId != "1" && chainId != "5") return;

    let proxyAdmin = await deployments.get("ProxyAdmin");
    let dETH = await deployments.get("dETH");
    const param = [dETH.address];

    let sdETHImpl = await deploy("sdETHImpl", {
        from: deployer,
        contract: "sdETH",
        args: param,
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const sdETHContract = await ethers.getContractFactory("sdETH");
    const sdETHInstance = sdETHContract.attach(sdETHImpl.address);

    const functionName = sdETHInstance.interface.getFunction("initialize(address)");
    const data = sdETHInstance.interface.encodeFunctionData(functionName, param);

    await deploy("sdETH", {
        from: deployer,
        contract: "TransparentUpgradeableProxy",
        args: [sdETHImpl.address, proxyAdmin.address, data],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
module.exports.tags = ["sdETH"];
