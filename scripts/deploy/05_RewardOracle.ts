import { deployProxy } from "../utils/utils";

module.exports = async ({ deployments, getChainId }) => {
    const chainId = await getChainId();

    const deploymentsAll = await deployments.all();
    const args = [deploymentsAll.CorePrimary.address];

    await deployProxy("RewardOracle", "RewardOracle", args, "initialize()", [], false);
};
module.exports.tags = ["RewardOracle"];
