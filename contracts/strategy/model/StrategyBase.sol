// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../../interface/ICore.sol";
import "../../interface/IaETH.sol";

/**
 * @title Aspida's Strategy
 * @author Aspida engineer
 */
abstract contract StrategyBase {
    ICore internal immutable CORE;
    IaETH internal immutable AETH;

    constructor(ICore _core) {
        CORE = _core;
        AETH = IaETH(_core.aETH());
    }

    /**
     * @dev Throws if called by any account other than the core.
     */
    modifier onlyCore() {
        require(address(CORE) == msg.sender, "onlyCore: caller is not the core");
        _;
    }

    function strategyReceive() external payable virtual returns (uint256);

    function aETH() external view virtual returns (IaETH) {
        return AETH;
    }

    function core() external view virtual returns (ICore) {
        return CORE;
    }
}
