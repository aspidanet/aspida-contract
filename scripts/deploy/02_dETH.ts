module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    let proxyAdmin = await deployments.get("ProxyAdmin");

    let dETHImpl = await deploy("dETHImpl", {
        from: deployer,
        contract: "dETH",
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const dETHContract = await ethers.getContractFactory("dETH");
    const dETHInstance = dETHContract.attach(dETHImpl.address);

    const functionName = dETHInstance.interface.getFunction("initialize()");
    const data = dETHInstance.interface.encodeFunctionData(functionName, []);

    await deploy("dETH", {
        from: deployer,
        contract: "TransparentUpgradeableProxy",
        args: [dETHImpl.address, proxyAdmin.address, data],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
module.exports.tags = ["dETH"];
