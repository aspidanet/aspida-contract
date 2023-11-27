import { deployProxy } from "../utils/utils";

module.exports = async ({ deployments, getChainId }) => {
    const chainId = await getChainId();

    const deploymentsAll = await deployments.all();
    const args = [deploymentsAll.dETH.address];

    await deployProxy("sdETH", "sdETH", [], "initialize(address)", args, false);
};
module.exports.tags = ["sdETH"];
