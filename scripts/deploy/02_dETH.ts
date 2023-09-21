import { deployProxy } from "../utils/utils";
module.exports = async () => {
    await deployProxy("dETH", "dETH", [], "initialize()", [], false);
};
module.exports.tags = ["dETH"];
