// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../../library/TransferHelper.sol";

import "../../interface/IaETH.sol";

/**
 * @title Aspida's lido's aETH minter model
 * @author Aspida engineer
 * @dev This contract is used to mint aETH tokens by depositing assets
 * @dev The contract is abstract and must be inherited by a child contract
 * @dev The child contract must implement the _convertToAETH and _depositAsset functions
 * @dev The child contract must also call the _setReceiverInternal function to set the receiver address
 */
abstract contract aETHMinter {
    using TransferHelper for address;

    IaETH internal immutable AETH;

    address internal receiver_; //internal variable to store the receiver address

    /**
     * @dev Emitted when the receiver address is set
     */
    event SetReceiver(address receiver);

    constructor(IaETH _aETH) {
        AETH = _aETH;
    }

    /**
     * @dev Internal function to set the receiver address
     * @param _receiver The address to set as the receiver
     */
    function _setReceiverInternal(address _receiver) internal {
        require(_receiver != receiver_ && _receiver != address(0), "_setReceiverInternal: Invalid receiver address");
        receiver_ = _receiver;
        emit SetReceiver(_receiver);
    }

    /**
     * @dev Internal function to deposit assets and mint aETH tokens
     * @param _sender The address of the sender
     * @param _receiver The address of the receiver
     * @param _assetAmount The amount of assets to deposit
     */
    function _deposit(address _sender, address _receiver, uint256 _assetAmount) internal virtual {
        address _to = receiver_;
        address _asset = _depositAsset();
        uint256 _beforeBalance = IERC20Upgradeable(_asset).balanceOf(_to);

        _asset.safeTransferFrom(_sender, _to, _assetAmount);
        AETH.minterMint(_receiver, _convertToAETH(IERC20Upgradeable(_asset).balanceOf(_to) - _beforeBalance));
    }

    /**
     * @dev Internal function to convert the deposit asset amount to aETH tokens
     * @param _assetAmount The amount of the deposit asset
     * @return The amount of aETH tokens to mint
     */
    function _convertToAETH(uint256 _assetAmount) internal view virtual returns (uint256);

    /**
     * @dev Internal function to get the deposit asset address
     * @return The address of the deposit asset
     */
    function _depositAsset() internal view virtual returns (address);

    /**
     * @dev External function to deposit assets and mint aETH tokens
     * @param _assetAmount The amount of assets to deposit
     */
    function deposit(uint256 _assetAmount) external {
        _deposit(msg.sender, msg.sender, _assetAmount);
    }

    /**
     * @dev External function to deposit assets and mint aETH tokens
     * @param _assetAmount The amount of assets to deposit
     * @param _receiver The address of the receiver
     */
    function deposit(uint256 _assetAmount, address _receiver) external {
        _deposit(msg.sender, _receiver, _assetAmount);
    }

    /**
     * @dev External function to get the AETH token contract address
     * @return The address of the AETH token contract
     */
    function aETH() external view returns (IaETH) {
        return AETH;
    }

    /**
     * @dev External function to get the receiver address
     * @return The address of the receiver
     */
    function receiver() external view returns (address) {
        return receiver_;
    }

    /**
     * @dev External function to get the deposit asset address
     * @return The address of the deposit asset
     */
    function depositAsset() external view returns (address) {
        return _depositAsset();
    }

    /**
     * @dev External function to convert the deposit asset amount to aETH tokens
     * @param _assetAmount The amount of the deposit asset
     * @return The amount of aETH tokens to mint
     */
    function convertToAETH(uint256 _assetAmount) external view returns (uint256) {
        return _convertToAETH(_assetAmount);
    }
}
