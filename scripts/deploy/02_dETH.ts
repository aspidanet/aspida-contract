import { deployProxy } from "../utils/utils";
import { network, deployInfo } from "../config/config";

module.exports = async ({ getChainId }) => {
    const chainId = await getChainId();

    const args = [deployInfo[network[chainId]].dETH.name, deployInfo[network[chainId]].dETH.symbol];

    await deployProxy("dETH", "dETH", [], "initialize(string,string)", args, false);
};
module.exports.tags = ["dETH"];
