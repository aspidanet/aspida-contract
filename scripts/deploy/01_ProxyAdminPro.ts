module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();
    await deploy("ProxyAdmin", {
        from: deployer,
        contract: "ProxyAdminPro",
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
module.exports.tags = ["ProxyAdmin"];
