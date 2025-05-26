// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import {ISuperfluid} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {IConstantFlowAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import {IInstantDistributionAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IInstantDistributionAgreementV1.sol";
import {IWETH} from "../contracts/interface/IWETH.sol";
import {ISuperToken} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/interfaces/AggregatorV3Interface.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {ISuperAgreement} from 
  "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperAgreement.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {FeeRetargetLib} from "./pool/libs/FeeRetargetLib.sol";
import {ShareMathLib} from "./pool/libs/ShareMathLib.sol";
import "./SuperDCATrade.sol";

/// @title SuperDCAPoolStorage
/// @notice Storage contract for the SuperDCAPoolV1
contract SuperDCAPoolStorage {
     /// @notice Parameters used to initialize the pool
  struct InitParams {
    ISuperfluid host;
    IConstantFlowAgreementV1 cfa;
    IInstantDistributionAgreementV1 ida;
    IWETH weth;
    ISuperToken wethx;
    ISuperToken inputToken;
    ISuperToken outputToken;
    AggregatorV3Interface priceFeed;
    bool invertPrice;
    string registrationKey;
    address payable automate;
  }

  /// @notice Parameters needed to perform a shareholder update (i.e. a flow rate update)
  struct ShareholderUpdate {
    address shareholder; // The shareholder to update
    int96 currentFlowRate; // The current flow rate of the shareholder
    ISuperToken token; // The token to update the flow rate for
  }

  // --- State Variables ---

  // Superfluid Variables
  ISuperfluid internal host; // Superfluid host contract
  IConstantFlowAgreementV1 internal cfa; // The stored constant flow agreement class address
  IInstantDistributionAgreementV1 internal ida; // The stored instant dist. agreement class address

  // SuperDCA Pool Variables
  
  uint256 public lastDistributedAt; // The timestamp of the last distribution
  ISuperToken public inputToken; // e.g. USDCx
  ISuperToken public outputToken; // e.g. ETHx
  address public underlyingInputToken; // e.g. USDC
  address public underlyingOutputToken; // e.g. WETH
  IWETH public weth;
  ISuperToken public wethx;
  uint32 public constant OUTPUT_INDEX = 0; // Superfluid IDA Index for outputToken's output pool
  uint256 public constant INTERVAL = 60; // The interval for gelato to check for execution
  uint256 public constant EXEC_FEE_SCALER = 1e18; // The scaler for the execution fee (1e18 = 100%)
  // TODO: make's minoutput 0 for simulation
  uint256 public constant RATE_TOLERANCE = 1e4; // The percentage to deviate from the oracle (basis
    // points)
  uint128 public constant SHARE_SCALER = 100_000; // The scaler to apply to the share of the
    // outputToken pool

  // Uniswap V4 Constants
  address constant USDC_ADDRESS = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;
  address constant DCA_ADDRESS = 0xb1599CDE32181f48f89683d3C5Db5C5D2C7C93cc;
  address constant ETH_ADDRESS = address(0);

  PoolKey DCA_USDC_KEY = PoolKey({
    currency0: Currency.wrap(USDC_ADDRESS),
    currency1: Currency.wrap(DCA_ADDRESS),
    fee: 10_000,
    tickSpacing: 200,
    hooks: IHooks(address(0))
  });

  PoolKey DCA_ETH_KEY = PoolKey({
    currency0: Currency.wrap(ETH_ADDRESS),
    currency1: Currency.wrap(DCA_ADDRESS),
    fee: 10_000,
    tickSpacing: 200,
    hooks: IHooks(address(0))
  });

  // Chainlink Variables
  AggregatorV3Interface public priceFeed; // Chainlink price feed for the inputToken/outputToken
    // pair
  bool internal invertPrice; // Whether to invert the price in rate conversions

  // Gelato task variables
  bytes32 public taskId;
  uint256 public gelatoFeeShare = 1e16; // number of basis points gelato takes for executing the
    // task
  uint256 public distributionInterval = 4 hours; // the interval to retarget to by adjusting fee
    // share

  // Constants for fee retargeting calculations
  uint256 public constant DECIMALS = 18;
  uint256 public constant MIN_FEE_SHARE = 1; // 1 wei lower bound
  uint256 public constant MAX_FEE_SHARE = 1e16; // 1% = 0.01 = 1e16 (with 18 decimals)
  uint256 public constant GROWTH_FACTOR = 2; // Simple multiplier of 2
  uint256 public constant MAX_HOURS_PAST_INTERVAL = 10; // Maximum hours past the interval to
    // consider

  // Encoded Paths
  bytes internal encodedSwapPath;
  bytes internal encodedGasPath;

  // Trade tracking
  SuperDCATrade public dcaTrade;

  // --- Events ---
  event Swap(
    uint256 inputAmount, uint256 outputAmount, uint256 oraclePrice, uint256 fee, address feePayer
  );
  event UpdateGelatoFeeShare(uint256 newGelatoFee);
  event RefundedUninvestedAmount(address shareholder, uint256 uninvestAmount);
  event ErrorRefundingUninvestedAmount(address shareholder, uint256 uninvestAmount);

  // --- Errors ---
  error AlreadyInitialized();
  error InvalidHost();
  error InvalidToken();
  error PoolDoesNotExist();
  error NotClosable();

  function _calculateAmountAfterFees(uint256 amount) internal view returns (uint256) {
    amount = ERC20(underlyingInputToken).balanceOf(address(this));
    return (amount * (EXEC_FEE_SCALER - gelatoFeeShare)) / EXEC_FEE_SCALER;
  }

  function getLatestPrice() public view returns (uint256) {
    if (address(priceFeed) == address(0)) return 0;

    (, int256 price,,,) = priceFeed.latestRoundData();
    return uint256(price);
  }



  function _isCFAv1(address _agreementClass) internal view returns (bool) {
    if (_agreementClass == address(0)) return false;
    return ISuperAgreement(_agreementClass).agreementType()
      == keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
  }
  
  function _isIDAv1(address _agreementClass) internal view returns (bool) {
    if (_agreementClass == address(0)) return false;
    return ISuperAgreement(_agreementClass).agreementType()
      == keccak256("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
  }

  function _onlyHost() internal view {
    if (msg.sender != address(host)) revert InvalidHost();
  }

  function _getShareholderInfo(bytes calldata _agreementData, ISuperToken _superToken)
    internal
    view
    returns (address _shareholder, int96 _flowRate, uint256 _timestamp)
  {
    (_shareholder,) = abi.decode(_agreementData, (address, address));
    (_timestamp, _flowRate,,) = cfa.getFlow(_superToken, _shareholder, address(this));
  }

  function _calcUserUninvested(uint256 prevUpdateTimestamp, uint256 flowRate, uint256 lastDist)
    internal
    view
    returns (uint256)
  {
    return ShareMathLib.calcUserUninvested(prevUpdateTimestamp, flowRate, lastDist);
  }

  function getExecutionFeeShare(uint256 currentFeeShare) public view returns (uint256) {
    return FeeRetargetLib.adjustFeeShare(currentFeeShare, lastDistributedAt, distributionInterval);
  }

  function _isInputToken(ISuperToken _superToken) internal view returns (bool) {
    return address(_superToken) == address(inputToken);
  }

  function _isOutputToken(ISuperToken _superToken) internal view returns (bool) {
    return address(_superToken) == address(outputToken);
  }

  function _shouldDistribute() internal view returns (bool) {
    // TODO: Might no longer be required
    (,, uint128 _totalUnitsApproved, uint128 _totalUnitsPending) =
      ida.getIndex(outputToken, address(this), OUTPUT_INDEX);
    return _totalUnitsApproved + _totalUnitsPending > 0;
  }

  function _getUnderlyingToken(ISuperToken _token) internal view returns (address) {
    // If the token is wethx, then the underlying token is weth
    if (address(_token) == address(wethx)) return address(weth);

    address underlyingToken = _token.getUnderlyingToken();

    // If the underlying token is 0x0, then the token is a supertoken
    if (address(underlyingToken) == address(0)) return address(_token);

    return underlyingToken;
  }

  function getNextDistributionTime(uint256 gasPrice, uint256 gasLimit, uint256 tokenToWethRate)
    public
    view
    returns (uint256)
  {
    int96 netFlow = cfa.getNetFlow(inputToken, address(this));
    if (netFlow == 0) return type(uint256).max;

    uint256 inflowRate = uint256(int256(netFlow)) / (10 ** 9);
    uint256 tokenAmount = gasPrice * gasLimit * tokenToWethRate;
    uint256 timeToDistribute = (tokenAmount / inflowRate) / (10 ** 9);
    return lastDistributedAt + timeToDistribute;
  }

  function getIDAShares(address _streamer)
    public
    view
    returns (bool _exist, bool _approved, uint128 _units, uint256 _pendingDistribution)
  {
    (_exist, _approved, _units, _pendingDistribution) =
      ida.getSubscription(outputToken, address(this), OUTPUT_INDEX, _streamer);
  }

  function getIDAIndexValue() public view returns (uint256) {
    (, uint256 _indexValue,,) = ida.getIndex(outputToken, address(this), OUTPUT_INDEX);
    return _indexValue;
  }

  function getTradeInfo(address _trader, uint256 _tradeIndex)
    public
    view
    returns (SuperDCATrade.Trade memory trade)
  {
    trade = dcaTrade.getTradeInfo(_trader, _tradeIndex);
  }

  function getLatestTrade(address _trader) public view returns (SuperDCATrade.Trade memory trade) {
    if (dcaTrade.tradeCountsByUser(_trader) > 0) trade = dcaTrade.getLatestTrade(_trader);
    else trade = SuperDCATrade.Trade(0, 0, 0, 0, 0, 0, 0, 0);
  }

  function getTradeCount(address _trader) public view returns (uint256 count) {
    count = dcaTrade.tradeCountsByUser(_trader);
  }
}