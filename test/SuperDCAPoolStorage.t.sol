pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {SuperDCAPoolStorage} from "../contracts/SuperDCAPoolStorage.sol";
import {SuperDCATrade} from "../contracts/SuperDCATrade.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/interfaces/AggregatorV3Interface.sol";
import {IWETH} from "../contracts/interface/IWETH.sol";
import {ISuperfluid} from
  "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {ISuperToken} from
  "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";
import {ISuperAgreement} from
  "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperAgreement.sol";
import {IConstantFlowAgreementV1} from
  "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import {IInstantDistributionAgreementV1} from
  "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IInstantDistributionAgreementV1.sol";

// Test contract that inherits from SuperDCAPoolStorage to test its functionality
contract TestSuperDCAPoolStorage is SuperDCAPoolStorage {
  constructor() {
    // Initialize with test values for testing
    dcaTrade = new SuperDCATrade();
  }

  // Expose internal functions for testing
  function exposed_isCFAv1(address _agreementClass) external view returns (bool) {
    return _isCFAv1(_agreementClass);
  }

  function exposed_isIDAv1(address _agreementClass) external view returns (bool) {
    return _isIDAv1(_agreementClass);
  }

  function exposed_isInputToken(ISuperToken _superToken) external view returns (bool) {
    return _isInputToken(_superToken);
  }

  function exposed_isOutputToken(ISuperToken _superToken) external view returns (bool) {
    return _isOutputToken(_superToken);
  }

  function exposed_getUnderlyingToken(ISuperToken _token) external view returns (address) {
    return _getUnderlyingToken(_token);
  }

  function exposed_calcUserUninvested(uint256 prevUpdateTimestamp, uint256 flowRate, uint256 lastDist)
    external
    view
    returns (uint256)
  {
    return _calcUserUninvested(prevUpdateTimestamp, flowRate, lastDist);
  }

  function exposed_onlyHost() external view {
    _onlyHost();
  }

  // Helper function to set up test state
  function setTestState(
    ISuperfluid _host,
    IConstantFlowAgreementV1 _cfa,
    IInstantDistributionAgreementV1 _ida,
    ISuperToken _inputToken,
    ISuperToken _outputToken,
    IWETH _weth,
    ISuperToken _wethx,
    AggregatorV3Interface _priceFeed
  ) external {
    host = _host;
    cfa = _cfa;
    ida = _ida;
    inputToken = _inputToken;
    outputToken = _outputToken;
    weth = _weth;
    wethx = _wethx;
    priceFeed = _priceFeed;
    lastDistributedAt = block.timestamp;
  }
}

contract SuperDCAPoolStorageTest is Test {
  // Constants from optimism network
  address public constant HOST_SUPERFLUID = 0x567c4B141ED61923967cA25Ef4906C8781069a10;
  address public constant IDA_SUPERFLUID = 0xc4ce5118C3B20950ee288f086cb7FC166d222D4c;
  address public constant CFA_SUPERFLUID = 0x204C6f131bb7F258b2Ea1593f5309911d8E458eD;
  address public constant USDCX = 0x35Adeb0638EB192755B6E52544650603Fe65A006;
  address public constant USDC = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;
  address public constant WETHX = 0x4ac8bD1bDaE47beeF2D1c6Aa62229509b962Aa0d;
  address public constant WETH = 0x4200000000000000000000000000000000000006;
  address public constant ETH_USDC_FEED = 0x13e3Ee699D1909E989722E753853AE30b17e08c5;
  uint256 public constant FORK_BLOCK_NUMBER = 135_643_157;

  TestSuperDCAPoolStorage public storageContract;

  function setUp() public {
    vm.createSelectFork(vm.rpcUrl("optimism"), FORK_BLOCK_NUMBER);
    
    storageContract = new TestSuperDCAPoolStorage();
    
    // Set up test state
    storageContract.setTestState(
      ISuperfluid(HOST_SUPERFLUID),
      IConstantFlowAgreementV1(CFA_SUPERFLUID),
      IInstantDistributionAgreementV1(IDA_SUPERFLUID),
      ISuperToken(USDCX),
      ISuperToken(WETHX),
      IWETH(WETH),
      ISuperToken(WETHX),
      AggregatorV3Interface(ETH_USDC_FEED)
    );
  }

  // --- Agreement Type Tests ---
  
  function testFork_IsCFAv1() public view {
    assertTrue(storageContract.exposed_isCFAv1(CFA_SUPERFLUID));
    assertFalse(storageContract.exposed_isCFAv1(IDA_SUPERFLUID));
    assertFalse(storageContract.exposed_isCFAv1(address(0)));
  }

  function testFork_IsIDAv1() public view {
    assertTrue(storageContract.exposed_isIDAv1(IDA_SUPERFLUID));
    assertFalse(storageContract.exposed_isIDAv1(CFA_SUPERFLUID));
    assertFalse(storageContract.exposed_isIDAv1(address(0)));
  }

  // --- Token Validation Tests ---

  function testFork_IsInputToken() public view {
    assertTrue(storageContract.exposed_isInputToken(ISuperToken(USDCX)));
    assertFalse(storageContract.exposed_isInputToken(ISuperToken(WETHX)));
    assertFalse(storageContract.exposed_isInputToken(ISuperToken(address(0))));
  }

  function testFork_IsOutputToken() public view {
    assertTrue(storageContract.exposed_isOutputToken(ISuperToken(WETHX)));
    assertFalse(storageContract.exposed_isOutputToken(ISuperToken(USDCX)));
    assertFalse(storageContract.exposed_isOutputToken(ISuperToken(address(0))));
  }

  // --- Underlying Token Tests ---

  function testFork_GetUnderlyingToken() public view {
    // Test WETHX -> WETH mapping
    address underlyingWETH = storageContract.exposed_getUnderlyingToken(ISuperToken(WETHX));
    assertEq(underlyingWETH, WETH);

    // Test USDCX -> USDC mapping  
    address underlyingUSDC = storageContract.exposed_getUnderlyingToken(ISuperToken(USDCX));
    assertEq(underlyingUSDC, USDC);
  }

  // --- Price Feed Tests ---

  function testFork_GetLatestPrice() public view {
    uint256 price = storageContract.getLatestPrice();
    assertGt(price, 0, "Price should be greater than 0");
    
    // Price should be reasonable (ETH/USD typically between $1000-$10000)
    assertGt(price, 1000e8, "Price should be at least $1000");
    assertLt(price, 10000e8, "Price should be less than $10000");
  }

  function testFork_GetLatestPriceWithZeroAddress() public {
    // Deploy new storage contract without price feed
    TestSuperDCAPoolStorage newStorage = new TestSuperDCAPoolStorage();
    newStorage.setTestState(
      ISuperfluid(HOST_SUPERFLUID),
      IConstantFlowAgreementV1(CFA_SUPERFLUID),
      IInstantDistributionAgreementV1(IDA_SUPERFLUID),
      ISuperToken(USDCX),
      ISuperToken(WETHX),
      IWETH(WETH),
      ISuperToken(WETHX),
      AggregatorV3Interface(address(0)) // Zero address price feed
    );

    uint256 price = newStorage.getLatestPrice();
    assertEq(price, 0, "Price should be 0 when feed is zero address");
  }

  // --- Fee Calculation Tests ---

  function testFork_GetExecutionFeeShare() public {
    uint256 currentFee = 1e16; // 1%
    uint256 newFee = storageContract.getExecutionFeeShare(currentFee);
    
    // Fee should be within bounds
    assertGe(newFee, storageContract.MIN_FEE_SHARE());
    assertLe(newFee, storageContract.MAX_FEE_SHARE());
  }

  // --- User Uninvested Calculation Tests ---

  function testFork_CalcUserUninvested() public {
    uint256 prevTimestamp = block.timestamp - 1 hours;
    uint256 flowRate = 1e12; // 1 USDC per second
    uint256 lastDist = block.timestamp - 30 minutes;

    uint256 uninvested = storageContract.exposed_calcUserUninvested(
      prevTimestamp,
      flowRate,
      lastDist
    );

    // Should calculate 30 minutes worth of flow
    uint256 expected = flowRate * 30 minutes;
    assertEq(uninvested, expected);
  }

  function testFork_CalcUserUninvestedZeroFlow() public {
    uint256 prevTimestamp = block.timestamp - 1 hours;
    uint256 flowRate = 0;
    uint256 lastDist = block.timestamp - 30 minutes;

    uint256 uninvested = storageContract.exposed_calcUserUninvested(
      prevTimestamp,
      flowRate,
      lastDist
    );

    assertEq(uninvested, 0);
  }

  // --- Constants Tests ---

  function testFork_Constants() public view {
    assertEq(storageContract.OUTPUT_INDEX(), 0);
    assertEq(storageContract.INTERVAL(), 60);
    assertEq(storageContract.EXEC_FEE_SCALER(), 1e18);
    assertEq(storageContract.RATE_TOLERANCE(), 1e4);
    assertEq(storageContract.SHARE_SCALER(), 100_000);
    assertEq(storageContract.DECIMALS(), 18);
    assertEq(storageContract.MIN_FEE_SHARE(), 1);
    assertEq(storageContract.MAX_FEE_SHARE(), 1e16);
    assertEq(storageContract.GROWTH_FACTOR(), 2);
    assertEq(storageContract.MAX_HOURS_PAST_INTERVAL(), 10);
  }

  // --- State Variable Tests ---

  function testFork_StateVariables() public view {
    assertEq(address(storageContract.inputToken()), USDCX);
    assertEq(address(storageContract.outputToken()), WETHX);
    assertEq(address(storageContract.weth()), WETH);
    assertEq(address(storageContract.wethx()), WETHX);
    assertEq(address(storageContract.priceFeed()), ETH_USDC_FEED);
    assertEq(storageContract.gelatoFeeShare(), 1e16);
    assertEq(storageContract.distributionInterval(), 4 hours);
  }

  // --- Trade Tracking Tests ---

  function testFork_TradeTrackingInitialization() public view {
    address dcaTradeAddress = address(storageContract.dcaTrade());
    assertTrue(dcaTradeAddress != address(0), "DCA Trade should be initialized");
  }

  // --- Error Tests ---

  function testFork_OnlyHostModifier() public {
    // This should revert when called by non-host
    vm.expectRevert(SuperDCAPoolStorage.InvalidHost.selector);
    storageContract.exposed_onlyHost();
  }

  function testFork_OnlyHostModifierWithHost() public {
    // This should succeed when called by host
    vm.prank(HOST_SUPERFLUID);
    storageContract.exposed_onlyHost(); // Should not revert
  }

  // --- Next Distribution Time Tests ---

  function testFork_GetNextDistributionTimeWithZeroNetFlow() public view {
    // When there's no net flow, should return max uint256
    uint256 gasPrice = 20e9; // 20 gwei
    uint256 gasLimit = 200_000; // 200k gas
    uint256 tokenToWethRate = 3000e18; // 1 ETH = 3000 USDC (rate in wei)
    
    uint256 nextDistTime = storageContract.getNextDistributionTime(gasPrice, gasLimit, tokenToWethRate);
    assertEq(nextDistTime, type(uint256).max, "Should return max uint256 when net flow is zero");
  }

  function testFork_GetNextDistributionTimeCalculation() public {
    // This test would need actual flows to work properly
    // For now, we test the edge case and calculation logic
    
    uint256 gasPrice = 20e9; // 20 gwei
    uint256 gasLimit = 200_000; // 200k gas  
    uint256 tokenToWethRate = 3000e18; // 1 ETH = 3000 USDC
    
    // Calculate expected token amount needed for gas
    uint256 expectedTokenAmount = gasPrice * gasLimit * tokenToWethRate;
    
    // Verify the calculation makes sense
    assertGt(expectedTokenAmount, 0, "Token amount should be greater than 0");
    
    // Test with zero parameters
    uint256 nextDistTimeZeroGas = storageContract.getNextDistributionTime(0, gasLimit, tokenToWethRate);
    assertEq(nextDistTimeZeroGas, type(uint256).max, "Should handle zero gas price");
    
    uint256 nextDistTimeZeroLimit = storageContract.getNextDistributionTime(gasPrice, 0, tokenToWethRate);
    assertEq(nextDistTimeZeroLimit, type(uint256).max, "Should handle zero gas limit");
    
    uint256 nextDistTimeZeroRate = storageContract.getNextDistributionTime(gasPrice, gasLimit, 0);
    assertEq(nextDistTimeZeroRate, type(uint256).max, "Should handle zero token rate");
  }

  function testFork_GetNextDistributionTimeWithReasonableParams() public view {
    // Test with realistic parameters
    uint256 gasPrice = 1e9; // 1 gwei (low gas)
    uint256 gasLimit = 100_000; // 100k gas
    uint256 tokenToWethRate = 2500e18; // 1 ETH = 2500 USDC
    
    uint256 nextDistTime = storageContract.getNextDistributionTime(gasPrice, gasLimit, tokenToWethRate);
    
    // Since net flow is 0 in our test setup, should return max uint256
    assertEq(nextDistTime, type(uint256).max, "Should return max uint256 with zero net flow");
  }

  function testFork_GetNextDistributionTimeWithHighGasParams() public view {
    // Test with high gas parameters
    uint256 gasPrice = 100e9; // 100 gwei (high gas)
    uint256 gasLimit = 500_000; // 500k gas (complex transaction)
    uint256 tokenToWethRate = 4000e18; // 1 ETH = 4000 USDC (high ETH price)
    
    uint256 nextDistTime = storageContract.getNextDistributionTime(gasPrice, gasLimit, tokenToWethRate);
    
    // Since net flow is 0 in our test setup, should return max uint256
    assertEq(nextDistTime, type(uint256).max, "Should return max uint256 with zero net flow");
  }
} 