import { deployProxy } from "../utils/utils";
import { network, deployInfo } from "../config/config";

module.exports = async ({ deployments, getChainId }) => {
    const chainId = await getChainId();

    const deploymentsAll = await deployments.all();
    const args = [deploymentsAll.aETH.address, deployInfo[network[chainId]].strategy.Lido.stETH];

    await deployProxy("StETHMinter", "StETHMinter", args, "initialize()", [], false);
};
module.exports.tags = ["StETHMinter"];
