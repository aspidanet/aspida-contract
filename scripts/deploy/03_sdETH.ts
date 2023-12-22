import { deployProxy } from "../utils/utils";
import { network, deployInfo } from "../config/config";

module.exports = async ({ deployments, getChainId }) => {
    const chainId = await getChainId();

    const deploymentsAll = await deployments.all();
    const args = [
        deployInfo[network[chainId]].sdETH.name,
        deployInfo[network[chainId]].sdETH.symbol,
        deploymentsAll.dETH.address,
    ];

    await deployProxy("sdETH", "sdETH", [], "initialize(string,string,address)", args, false);
};
module.exports.tags = ["sdETH"];
