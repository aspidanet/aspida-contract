import { network, deployInfo } from "../config/config";

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    if (chainId != "1" && chainId != "5") return;

    let proxyAdmin = await deployments.get("ProxyAdmin");
    let corePrimary = await deployments.get("CorePrimary");
    const param = [corePrimary.address];

    let RewardOracleImpl = await deploy("RewardOracleImpl", {
        from: deployer,
        contract: "RewardOracle",
        args: param,
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const RewardOracleContract = await ethers.getContractFactory("RewardOracle");
    const RewardOracleInstance = RewardOracleContract.attach(RewardOracleImpl.address);

    const functionName = RewardOracleInstance.interface.getFunction("initialize()");
    const data = RewardOracleInstance.interface.encodeFunctionData(functionName, []);

    await deploy("RewardOracle", {
        from: deployer,
        contract: "TransparentUpgradeableProxy",
        args: [RewardOracleImpl.address, proxyAdmin.address, data],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
module.exports.tags = ["RewardOracle"];
