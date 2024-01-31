import { deployProxy } from "../utils/utils";
import { network, deployInfo } from "../config/config";

module.exports = async ({ getChainId }) => {
    const chainId = await getChainId();

    const args = [deployInfo[network[chainId]].aETH.name, deployInfo[network[chainId]].aETH.symbol];

    await deployProxy("aETH", "aETH", [], "initialize(string,string)", args, false);
};
module.exports.tags = ["aETH"];
