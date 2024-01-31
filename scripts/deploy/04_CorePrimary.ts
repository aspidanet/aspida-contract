import { deployProxy } from "../utils/utils";
import { network, deployInfo } from "../config/config";

module.exports = async ({ deployments, getChainId }) => {
    const chainId = await getChainId();

    const deploymentsAll = await deployments.all();
    const args = [
        deployInfo[network[chainId]].DepositContract,
        deploymentsAll.aETH.address,
        deploymentsAll.saETH.address,
    ];

    await deployProxy("CorePrimary", "CorePrimary", args, "initialize()", [], false);
};
module.exports.tags = ["CorePrimary"];
