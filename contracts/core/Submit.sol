// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interface/IaETH.sol";
import "../interface/IsaETH.sol";

/**
 * @title Aspida's Submit model
 * @dev This contract allows users to submit ETH and mint aETH tokens in return.
 * Users can also submit ETH and stake it to receive saETH tokens.
 * @author Aspida engineer
 */
abstract contract Submit {
    IaETH internal immutable AETH; // aETH token contract
    IsaETH internal immutable SAETH; // saETH token contract

    uint256 internal submitted_; // total amount of ETH submitted

    /**
     * @dev Emitted when the withdrawal credentials are set.
     */
    event Submitted(address sender, address recipient, uint256 ethValue);

    constructor(IaETH _aETH, IsaETH _saETH) {
        AETH = _aETH;
        SAETH = _saETH;
    }

    /**
     * @dev Internal function to submit ETH and mint aETH tokens
     * @param _receiver The address of the receiver of the aETH tokens
     */
    function _submit(address _receiver) internal virtual {
        uint256 _ethValue = msg.value;
        require(_ethValue != 0, "_submit: ETH cannot be 0");

        submitted_ += _ethValue;

        AETH.mint(_receiver, _ethValue);
        emit Submitted(msg.sender, _receiver, _ethValue);
    }

    /**
     * @dev External function to submit ETH and mint aETH tokens
     */
    function submit() external payable {
        _submit(msg.sender);
    }

    /**
     * @dev External function to submit ETH and mint aETH tokens for a specific receiver
     * @param _receiver The address of the receiver of the aETH tokens
     */
    function submit(address _receiver) external payable {
        _submit(_receiver);
    }

    /**
     * @dev External function to submit ETH, mint aETH tokens and stake them to receive saETH tokens
     * @param _receiver The address of the receiver of the saETH tokens
     */
    function submitAndStake(address _receiver) external payable {
        _submit(address(this));

        AETH.approve(address(SAETH), msg.value);
        require(SAETH.deposit(msg.value, _receiver) > 0, "No saETH was returned");
    }

    /**
     * @dev External function to return the aETH token contract
     * @return The aETH token contract
     */
    function aETH() external view returns (IaETH) {
        return AETH;
    }

    /**
     * @dev External function to return the saETH token contract
     * @return The saETH token contract
     */
    function saETH() external view returns (IsaETH) {
        return SAETH;
    }

    /**
     * @dev External function to return the total amount of ETH submitted
     * @return The total amount of ETH submitted
     */
    function submitted() external view returns (uint256) {
        return submitted_;
    }
}
