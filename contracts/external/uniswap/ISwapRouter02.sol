// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.5 <0.9.0;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

interface ISwapRouter02 is ISwapRouter {
    function exactInputSingle(
        ISwapRouter.ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut);

    function exactInput(
        ISwapRouter.ExactInputParams calldata params
    ) external payable returns (uint256 amountOut);

    function exactOutputSingle(
        ISwapRouter.ExactOutputSingleParams calldata params
    ) external payable returns (uint256 amountIn);

    function exactOutput(
        ISwapRouter.ExactOutputParams calldata params
    ) external payable returns (uint256 amountIn);

    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);

    function unwrapWETH9(uint256 amountMinimum, address recipient) external payable;

    function refundETH() external payable;

    function sweepToken(
        address token,
        uint256 amountMinimum,
        address recipient
    ) external payable;

    function sweepTokenWithFee(
        address token,
        uint256 amountMinimum,
        address recipient,
        uint256 feeBips,
        address feeRecipient
    ) external payable;
}
