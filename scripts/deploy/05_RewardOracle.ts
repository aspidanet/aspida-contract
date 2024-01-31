import { deployProxy } from "../utils/utils";
import { network, deployInfo } from "../config/config";

module.exports = async ({ deployments, getChainId }) => {
    const chainId = await getChainId();

    const deploymentsAll = await deployments.all();
    const args = [deploymentsAll.CorePrimary.address, deployInfo[network[chainId]].RewardOracle.zeroEpochTimestamp];

    await deployProxy("RewardOracle", "RewardOracle", args, "initialize()", [], false);
};
module.exports.tags = ["RewardOracle"];
