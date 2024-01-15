import { deployProxy } from "../utils/utils";
import { network, deployInfo } from "../config/config";

module.exports = async ({ deployments, getChainId }) => {
    const chainId = await getChainId();

    const deploymentsAll = await deployments.all();
    const args = [
        deployInfo[network[chainId]].saETH.name,
        deployInfo[network[chainId]].saETH.symbol,
        deploymentsAll.aETH.address,
    ];

    await deployProxy("saETH", "saETH", [], "initialize(string,string,address)", args, false);
};
module.exports.tags = ["saETH"];
