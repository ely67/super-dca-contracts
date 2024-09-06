import { waffle, ethers } from 'hardhat'
import { setup, IUser, ISuperToken } from '../misc/setup'
import { common } from '../misc/common'
import { expect } from 'chai'
import { Framework, SuperToken } from '@superfluid-finance/sdk-core'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ERC20, SuperDCAPoolV1, SuperDCAReferral__factory } from '../typechain'
import { increaseTime, impersonateAndSetBalance } from '../misc/helpers'
import { Constants } from '../misc/Constants'
import { HttpService } from '../misc/HttpService'

const { provider } = waffle
const TEST_TRAVEL_TIME = 3600 * 2 // 2 hours
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const config = Constants['polygon']

export interface superTokenIDAIndex {
  token: SuperToken
  IDAIndex: number
}

describe('SuperDCAPoolV1', () => {
  const errorHandler = (err: any) => {
    if (err) throw err
  }

  const overrides = { gasLimit: '10000000' } // Using this to manually limit gas to avoid giga-errors.
  const inflowRateUsdc = '1000000000000000'
  const inflowRateUsdc10x = '10000000000000000'
  const inflowRateEth = '10000000000000'

  let SuperDCAPoolFactory: any
  let snapshot: any

  let adminSigner: SignerWithAddress
  let aliceSigner: SignerWithAddress
  let bobSigner: SignerWithAddress
  let usdcxWhaleSigner: SignerWithAddress
  let maticxWhaleSigner: SignerWithAddress

  let oraclePrice: number
  let maticOraclePrice: number

  let appBalances = { ethx: [], usdcx: [], maticx: [] }
  let aliceBalances = { ethx: [], usdcx: [], maticx: [] }
  let bobBalances = { ethx: [], usdcx: [], maticx: [] }

  let sf: Framework,
    superT: ISuperToken,
    u: { [key: string]: IUser },
    pool: SuperDCAPoolV1,
    tokenss: { [key: string]: any },
    sfRegistrationKey: any,
    accountss: SignerWithAddress[],
    constant: { [key: string]: string },
    ERC20: any

  let MATICx: SuperToken
  let USDCx: SuperToken
  let ETHx: SuperToken
  let usdc: ERC20;
  let weth: ERC20;

  let usdcxIDAIndex: superTokenIDAIndex
  let ethxIDAIndex: superTokenIDAIndex
  let maticxIDAIndex: superTokenIDAIndex

  // ***************************************************************************************

  let gelatoBlock: any

  async function takeMeasurements(): Promise<void> {
    // TODO: Refactor this to use a loop
    appBalances.ethx.push(
      (await superT.ethx.balanceOf({ account: pool.address, providerOrSigner: provider })).toString()
    )
    aliceBalances.ethx.push(
      (await superT.ethx.balanceOf({ account: u.alice.address, providerOrSigner: provider })).toString()
    )
    bobBalances.ethx.push(
      (await superT.ethx.balanceOf({ account: u.bob.address, providerOrSigner: provider })).toString()
    )

    appBalances.usdcx.push(
      (await superT.usdcx.balanceOf({ account: pool.address, providerOrSigner: provider })).toString()
    )
    aliceBalances.usdcx.push(
      (await superT.usdcx.balanceOf({ account: u.alice.address, providerOrSigner: provider })).toString()
    )
    bobBalances.usdcx.push(
      (await superT.usdcx.balanceOf({ account: u.bob.address, providerOrSigner: provider })).toString()
    )

    appBalances.maticx.push(
      (await superT.maticx.balanceOf({ account: pool.address, providerOrSigner: provider })).toString()
    )
    aliceBalances.maticx.push(
      (await superT.maticx.balanceOf({ account: u.alice.address, providerOrSigner: provider })).toString()
    )
    bobBalances.maticx.push(
      (await superT.maticx.balanceOf({ account: u.bob.address, providerOrSigner: provider })).toString()
    )
  }

  async function resetMeasurements(): Promise<void> {
    appBalances = { ethx: [], usdcx: [], maticx: [] }
    aliceBalances = { ethx: [], usdcx: [], maticx: [] }
    bobBalances = { ethx: [], usdcx: [], maticx: [] }
  }

  async function approveSubscriptions(tokensAndIDAIndexes: superTokenIDAIndex[], signers: SignerWithAddress[]) {
    let tokenIndex: number
    for (let i = 0; i < signers.length; i++) {
      for (let j = 0; j < tokensAndIDAIndexes.length; j++) {
        tokenIndex = tokensAndIDAIndexes[j].IDAIndex
        await sf.idaV1
          .approveSubscription({
            indexId: tokenIndex.toString(),
            superToken: tokensAndIDAIndexes[j].token.address,
            publisher: pool.address,
            userData: '0x',
          })
          .exec(signers[i])
      }
    }
  }

  async function delta(account: SignerWithAddress, balances: any) {
    const len = balances.ethx.length
    return {
      ethx: balances.ethx[len - 1] - balances.ethx[len - 2],
      usdcx: balances.usdcx[len - 1] - balances.usdcx[len - 2],
      maticx: balances.maticx[len - 1] - balances.maticx[len - 2],
    }
  }

  before(async () => {
    const { superfluid, users, accounts, tokens, superTokens, constants } = await setup()

    const { createSFRegistrationKey } = await common()

    u = users
    sf = superfluid
    superT = superTokens
    tokenss = tokens
    accountss = accounts
    sfRegistrationKey = createSFRegistrationKey
    constant = constants

    // This order is established in misc/setup.ts
    adminSigner = accountss[0]
    aliceSigner = accountss[1]
    bobSigner = accountss[2]
    usdcxWhaleSigner = accountss[5]
    maticxWhaleSigner = accountss[7]

    MATICx = superT.maticx
    USDCx = superT.usdcx
    ETHx = superT.ethx
    usdc = tokenss.usdc
    weth = tokenss.weth

    ethxIDAIndex = {
      token: ETHx,
      IDAIndex: 0,
    }
    
    // Impersonate Superfluid Governance and make a registration key
    const registrationKey = await sfRegistrationKey(sf, adminSigner.address)

    // Deploy SuperDCA Pool
    SuperDCAPoolFactory = await ethers.getContractFactory('SuperDCAPoolV1', adminSigner)

    // Deploy the SuperDCAPoolV1
    pool = await SuperDCAPoolFactory.deploy(
      config.GELATO_OPS
    )
    console.log('SuperDCAPoolV1 deployed to:', pool.address)

    const initParams = {
      host:  config.HOST_SUPERFLUID_ADDRESS,
      cfa: config.CFA_SUPERFLUID_ADDRESS,
      ida: config.IDA_SUPERFLUID_ADDRESS,
      weth: config.WMATIC_ADDRESS,
      wethx: config.MATICX_ADDRESS,
      inputToken: USDCx.address,
      outputToken: ETHx.address,
      router: config.UNISWAP_V3_ROUTER_ADDRESS,
      uniswapFactory: config.UNISWAP_V3_FACTORY_ADDRESS,
      uniswapPath: [config.USDC_ADDRESS, config.DAI_ADDRESS, config.ETH_ADDRESS],
      poolFees: [100, 3000],
      priceFeed: config.CHAINLINK_ETH_USDC_PRICE_FEED,
      invertPrice: false,
      registrationKey: registrationKey,
      ops: config.GELATO_OPS,
    };

    await pool.initialize(initParams);
    console.log('Initialized Pool')

    // Save this block number for expectations below
    gelatoBlock = await ethers.provider.getBlock('latest')

    // Give Alice, Bob, Karen some tokens
    const initialAmount = ethers.utils.parseUnits('1000', 18).toString()

    // USDCx for Alice
    await USDCx
      .transfer({
        receiver: aliceSigner.address,
        amount: initialAmount,
      })
      .exec(usdcxWhaleSigner, 2)
    console.log('Alice USDCx transfer')

    // USDCx for Bob
    await USDCx
      .transfer({
        receiver: bobSigner.address,
        amount: initialAmount,
      })
      .exec(usdcxWhaleSigner)
    console.log('Bob USDCx transfer')

    // MATICx for Alice
    await MATICx
      .transfer({
        receiver: aliceSigner.address,
        amount: '10000000000000000000',
      })
      .exec(maticxWhaleSigner)
    console.log('Alice MATICx transfer')

    // MATICx for Bob
    await MATICx
      .transfer({
        receiver: bobSigner.address,
        amount: '10000000000000000000',
      })
      .exec(maticxWhaleSigner)
    console.log('Bob MATICx transfer')

    // Do all the approvals
    await approveSubscriptions([ethxIDAIndex], [adminSigner, aliceSigner, bobSigner]) // karenSigner

    // Take a snapshot to avoid redoing the setup, this saves some time later in the testing scripts
    snapshot = await provider.send('evm_snapshot', [])
  })

  context('#1 - new dcapool with no streamers', async () => {
    beforeEach(async () => {
      // Revert to the point SuperDCAPool was just deployed
      const success = await provider.send('evm_revert', [snapshot])
      // Take another snapshot to be able to revert again next time
      snapshot = await provider.send('evm_snapshot', [])
      expect(success).to.equal(true)
    })

    afterEach(async () => {
      // Check the app isn't jailed
      // expect(await pool.isAppJailed()).to.equal(false);
      await resetMeasurements()
    })

    after(async () => {})

    it('#1.1 contract variables were set correctly', async () => {
      expect(await pool.lastDistributedAt()).to.equal(gelatoBlock.timestamp)
      expect(await pool.gelatoFeeShare()).to.equal(config.GELATO_FEE)
      expect(await pool.inputToken()).to.equal(USDCx.address)
      expect(await pool.outputToken()).to.equal(ETHx.address)
      expect(await pool.underlyingInputToken()).to.equal(config.USDC_ADDRESS)
      expect(await pool.underlyingOutputToken()).to.equal(config.ETH_ADDRESS)
      expect(await pool.weth()).to.equal(config.WMATIC_ADDRESS)
      expect(await pool.wethx()).to.equal(config.MATICX_ADDRESS)

      // Make sure SuperDCATrade was created correctly
      expect(await pool.dcaTrade()).to.not.equal(ZERO_ADDRESS)

      // Make sure that getLatestTrade returns the an SuperDCATrade when there are no trades
      const trade = await pool.getLatestTrade(aliceSigner.address)
      expect(trade.startTime).to.equal(0)
      expect(trade.endTime).to.equal(0)
      expect(trade.flowRate).to.equal(0)
      expect(trade.startIdaIndex).to.equal(0)
      expect(trade.endIdaIndex).to.equal(0)
      expect(trade.units).to.equal(0)
      
    })

    it('#1.3 before/afterAgreementCreated callbacks', async () => {
      // Alice opens a USDC stream to SuperDCAPool
      await sf.cfaV1
        .createFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          flowRate: inflowRateUsdc,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(aliceSigner)

      // Verify a SuperDCATrade was created for alice
      let aliceInitialTrade = await pool.getLatestTrade(aliceSigner.address);
      let startTime = (await ethers.provider.getBlock('latest')).timestamp;
      let startIdaIndex = 0;
      // Expect share allocations were done correctly
      let units = ethers.BigNumber.from(inflowRateUsdc).div(
        ethers.BigNumber.from(await config.SHARE_SCALER)
      )
      expect(aliceInitialTrade.startTime).to.equal(startTime);
      expect(aliceInitialTrade.endTime).to.equal(0);
      expect(aliceInitialTrade.flowRate).to.equal(inflowRateUsdc);
      expect(aliceInitialTrade.startIdaIndex).to.equal(startIdaIndex); // No distributions on the index have happened yet
      expect(aliceInitialTrade.endIdaIndex).to.equal(0); // No distributions on the index have happened yet
      expect(aliceInitialTrade.units).to.equal(units);

      
      expect((await pool.getIDAShares(aliceSigner.address)).toString()).to.equal(`true,true,${units},0`)

      // Check balances
      await takeMeasurements()

      // Give it a minute...
      await increaseTime(TEST_TRAVEL_TIME)

      // A distritbution happens when Bob starts his stream
      await sf.cfaV1
        .createFlow({
          sender: bobSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          flowRate: inflowRateUsdc,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(bobSigner)

      // Verify a SuperDCATrade was created for bob
      let bobInitialTrade = await pool.getLatestTrade(bobSigner.address);
      startTime = (await ethers.provider.getBlock('latest')).timestamp;
      startIdaIndex = await pool.getIDAIndexValue();
      expect(bobInitialTrade.startTime).to.equal(startTime);
      expect(bobInitialTrade.endTime).to.equal(0);
      expect(bobInitialTrade.flowRate).to.equal(inflowRateUsdc);
      expect(bobInitialTrade.startIdaIndex).to.equal(startIdaIndex); // One distribution occured
      expect(bobInitialTrade.endIdaIndex).to.equal(0); // No distributions on the index have happened yet
      expect(bobInitialTrade.units).to.equal(units);
      // Invariant: The pool should have no balance
      // let poolInputBalance = await usdc.balanceOf(pool.address);
      // let poolOutputBalance = await weth.balanceOf(pool.address);
      // TODO: There is dust leftover each swap that get's used in the next swap
      // expect(poolInputBalance).to.equal(0);
      // expect(poolOutputBalance).to.equal(0);

      // Expect Alice wait distributed fairly
      // Check balances again
      await takeMeasurements()

      // Check oracle
      oraclePrice = await pool.getLatestPrice()

      // Compute the delta of ETHx and USDCx for alice
      let deltaAlice = await delta(aliceSigner, aliceBalances)
      let deltaBob = await delta(bobSigner, bobBalances)

      // Expect alice got within 2.0% of the oracle price
      expect(deltaAlice.ethx).to.be.above((deltaAlice.usdcx / oraclePrice) * 1e8 * -1 * 0.98)

      // Display exchange rates and deltas for visual inspection by the test engineers
      console.log('Alice exchange rate:', (deltaAlice.usdcx / deltaAlice.ethx) * -1)
      // Show the delte between the oracle price
      console.log(
        'Alice oracle delta (%):',
        (100 * ((deltaAlice.usdcx / deltaAlice.ethx) * -1 * 1e8 - oraclePrice)) / oraclePrice
      )

      // Expect Bob's share allocations were done correctly
      expect((await pool.getIDAShares(bobSigner.address)).toString()).to.equal(`true,true,${units},0`)

      // Close the streams and clean up from the test
      // TODO: Move to afterEach method
      await sf.cfaV1
        .deleteFlow({
          receiver: pool.address,
          sender: aliceSigner.address,
          superToken: USDCx.address,
          shouldUseCallAgreement: true,
        })
        .exec(aliceSigner)

      // Verify the SuperDCATrade was updated for alice
      let aliceFinalTrade = await pool.getLatestTrade(aliceSigner.address);
      expect(aliceFinalTrade.startTime).to.equal(aliceInitialTrade.startTime);
      expect(aliceFinalTrade.endTime).to.equal((await ethers.provider.getBlock('latest')).timestamp);
      expect(aliceFinalTrade.flowRate).to.equal(aliceInitialTrade.flowRate);
      expect(aliceFinalTrade.startIdaIndex).to.equal(aliceInitialTrade.startIdaIndex);
      expect(aliceFinalTrade.endIdaIndex).to.equal(await pool.getIDAIndexValue());
      expect(aliceFinalTrade.units).to.equal(aliceInitialTrade.units);
      // Invariant: The pool should have no balance
      // poolInputBalance = await usdc.balanceOf(pool.address);
      // poolOutputBalance = await weth.balanceOf(pool.address);
      // expect(poolInputBalance).to.equal(0);
      // expect(poolOutputBalance).to.equal(0);

      // Make sure the input amount can be calculate correctly for alice
      let calculatedInputAmount = (aliceFinalTrade.endTime - aliceFinalTrade.startTime) * aliceFinalTrade.flowRate;

      // Make sure the output amount can be calculate correctly for alice
      let calculatedOutputAmount = (aliceFinalTrade.endIdaIndex - aliceFinalTrade.startIdaIndex) * aliceFinalTrade.units;
      expect(deltaAlice.ethx).to.equal(calculatedOutputAmount);


      await sf.cfaV1
        .deleteFlow({
          receiver: pool.address,
          sender: bobSigner.address,
          superToken: USDCx.address,
          shouldUseCallAgreement: true,
        })
        .exec(bobSigner)
      
      // Verify the SuperDCATrade was updated for bob
      let bobFinalTrade = await pool.getLatestTrade(bobSigner.address);
      expect(bobFinalTrade.startTime).to.equal(bobInitialTrade.startTime);
      expect(bobFinalTrade.endTime).to.equal((await ethers.provider.getBlock('latest')).timestamp);
      expect(bobFinalTrade.flowRate).to.equal(bobInitialTrade.flowRate);
      expect(bobFinalTrade.startIdaIndex).to.equal(bobInitialTrade.startIdaIndex);
      expect(bobFinalTrade.endIdaIndex).to.equal(await pool.getIDAIndexValue());
      expect(bobFinalTrade.units).to.equal(bobInitialTrade.units);

      // Make sure the input amount can be calculate correctly for bob
      calculatedInputAmount = (bobFinalTrade.endTime - bobFinalTrade.startTime) * bobFinalTrade.flowRate;

      // Make sure the output amount can be calculate correctly for bob
      calculatedOutputAmount = (bobFinalTrade.endIdaIndex - bobFinalTrade.startIdaIndex) * bobFinalTrade.units;
      expect(deltaBob.ethx).to.equal(calculatedOutputAmount);

      // Check that the trade count is correct
      let aliceTradeCount = await pool.getTradeCount(aliceSigner.address);
      expect(aliceTradeCount).to.equal(1);

      // Check that the trade count is correct
      let bobTradeCount = await pool.getTradeCount(bobSigner.address);
      expect(bobTradeCount).to.equal(1);

    })

    it('#1.4 before/afterAgreementUpdated callbacks', async () => {
      // Alice opens a USDC stream to SuperDCAPool
      await sf.cfaV1
        .createFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          flowRate: inflowRateUsdc,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(aliceSigner)

      // Give some time...
      await increaseTime(TEST_TRAVEL_TIME)

      // A distritbution happens when Bob starts his stream
      await sf.cfaV1
        .createFlow({
          sender: bobSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          flowRate: inflowRateEth,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(bobSigner)

      // Check balances
      await takeMeasurements()
      // Give it some time...
      await increaseTime(TEST_TRAVEL_TIME)

      // A distritbution happens when Alice updates her stream
      await sf.cfaV1
        .updateFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          flowRate: inflowRateUsdc,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(aliceSigner)

      // Expect Alice wait distributed fairly

      // Check balances again
      await takeMeasurements()

      // Check oracle
      oraclePrice = await pool.getLatestPrice()

      // Compute the delta
      let deltaAlice = await delta(aliceSigner, aliceBalances)
      let deltaBob = await delta(bobSigner, bobBalances)

      // Expect alice got within 1.0% of the oracle price (TODO: move to 0.75?)
      expect(deltaAlice.ethx).to.be.above((deltaAlice.usdcx / oraclePrice) * 1e8 * -1 * 0.98)

      // Display exchange rates and deltas for visual inspection by the test engineers
      console.log('Alice exchange rate:', (deltaAlice.usdcx / deltaAlice.ethx) * -1)
      // Show the delta between the oracle price
      console.log(
        'Alice oracle delta (%):',
        (100 * ((deltaAlice.usdcx / deltaAlice.ethx) * -1 * 1e8 - oraclePrice)) / oraclePrice
      )

      // Display exchange rates and deltas for visual inspection by the test engineers
      console.log('Bob exchange rate:', (deltaBob.usdcx / deltaBob.ethx) * -1)
      // Show the delta between the oracle price
      console.log(
        'Bob oracle delta (%):',
        (100 * ((deltaBob.usdcx / deltaBob.ethx) * -1 * 1e8 - oraclePrice)) / oraclePrice
      )

      // Delete Alices stream before first  distributions
      await sf.cfaV1
        .deleteFlow({
          receiver: pool.address,
          sender: aliceSigner.address,
          superToken: USDCx.address,
          shouldUseCallAgreement: true,
        })
        .exec(aliceSigner)

      // Delete Alices stream before first  distributions
      await sf.cfaV1
        .deleteFlow({
          receiver: pool.address,
          sender: bobSigner.address,
          superToken: USDCx.address,
          shouldUseCallAgreement: true,
        })
        .exec(bobSigner)
    })

    it('#1.5 before/afterAgreementTerminated callbacks', async () => {
      await takeMeasurements()

      // Alice opens a USDC stream to SuperDCAPool
      await sf.cfaV1
        .createFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          flowRate: inflowRateUsdc,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(aliceSigner)

      await increaseTime(3600)

      // Delete Alices stream before first  distributions
      await sf.cfaV1
        .deleteFlow({
          receiver: pool.address,
          sender: aliceSigner.address,
          superToken: USDCx.address,
          shouldUseCallAgreement: true,
        })
        .exec(aliceSigner)

      await takeMeasurements()

      // Check balance for alice again
      let aliceDelta = await delta(aliceSigner, aliceBalances)

      // Expect alice didn't lose anything since she closed stream before distribute
      // expect(aliceDelta.usdcx).to.equal(0);
      expect(aliceDelta.usdcx).to.equal(0)
      expect((await pool.getIDAShares(aliceSigner.address)).toString()).to.equal(`true,true,0,0`)
      expect((await pool.getIDAShares(adminSigner.address)).toString()).to.equal(`true,true,0,0`)
    })

    it('#1.6 manual distribution', async () => {
      // Alice opens a USDC stream to SuperDCAPool
      await sf.cfaV1
        .createFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          flowRate: inflowRateUsdc,
          shouldUseCallAgreement: true,
        })
        .exec(aliceSigner)

      // Check balance
      await takeMeasurements()

      // Fast forward an hour and distribute
      await increaseTime(TEST_TRAVEL_TIME)
      // Expect this call to distribute emits a Swap event
      await expect(pool.distribute('0x', true)).to.emit(pool, 'Swap')

      // Do two more distributions before checking balances
      await increaseTime(TEST_TRAVEL_TIME)
      await pool.distribute('0x', true)

      await increaseTime(TEST_TRAVEL_TIME)
      await pool.distribute('0x', true)

      // Check balances again
      await takeMeasurements()

      // Check oracle
      oraclePrice = await pool.getLatestPrice()

      // Compute the delta
      let deltaAlice = await delta(aliceSigner, aliceBalances)
      expect(deltaAlice.ethx).to.be.above((deltaAlice.usdcx / oraclePrice) * 1e8 * -1 * 0.98)

      // Display exchange rates and deltas for visual inspection by the test engineers
      console.log('Alice exchange rate:', (deltaAlice.usdcx / deltaAlice.ethx) * -1)
      // Show the delte between the oracle price
      console.log(
        'Alice oracle delta (%):',
        (100 * ((deltaAlice.usdcx / deltaAlice.ethx) * -1 * 1e8 - oraclePrice)) / oraclePrice
      )

      // Delete alice and bobs flow
      await sf.cfaV1
        .deleteFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(aliceSigner)
    })

    it('#1.7 gelato distribution', async () => {
      const config = Constants['polygon']

      // Impersonate gelato network and set balance
      await impersonateAndSetBalance(config.GELATO_NETWORK)
      const gelatoNetwork = await ethers.provider.getSigner(config.GELATO_NETWORK)
      const ops = await ethers.getContractAt('Ops', config.GELATO_OPS)

      // Setup gelato executor exec and module data
      let encodedArgs = ethers.utils.defaultAbiCoder.encode(['uint128', 'uint128'], [gelatoBlock.timestamp, 60])
      let execData = pool.interface.encodeFunctionData('distribute', ['0x', false])
      let moduleData = {
        modules: [2, 5], // PROXY, TRIGGER
        args: [
          '0x', 
          ethers.utils.defaultAbiCoder.encode(['uint256','bytes'], [0, encodedArgs])
        ]
      }

      // Alice opens a USDC stream to SuperDCAPool
      await sf.cfaV1
        .createFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          flowRate: inflowRateUsdc10x, // Increase rate 10x to make sure gelato can be paid
          shouldUseCallAgreement: true,
        })
        .exec(aliceSigner)

      await takeMeasurements()
      await increaseTime(TEST_TRAVEL_TIME * 2)

      // Submit task to gelato
      await ops.connect(gelatoNetwork).exec(
        pool.address,
        pool.address,
        execData,
        moduleData,
        config.GELATO_FEE,
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        false
      )
      console.log("Triggered Gelato");
      await increaseTime(TEST_TRAVEL_TIME * 2)

      // Submit task to gelato
      await ops.connect(gelatoNetwork).exec(
        pool.address,
        pool.address,
        execData,
        moduleData,
        config.GELATO_FEE,
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        false
      )
      console.log("Triggered Gelato");

      // Check balances again
      await takeMeasurements()

      // Check oracle
      oraclePrice = await pool.getLatestPrice()

      // Compute the delta
      let deltaAlice = await delta(aliceSigner, aliceBalances)
      expect(deltaAlice.ethx).to.be.above((deltaAlice.usdcx / oraclePrice) * 1e8 * -1 * 0.97) // TODO: use config.RATE_TOLERANCE

      // Display exchange rates and deltas for visual inspection by the test engineers
      console.log('Alice exchange rate:', (deltaAlice.usdcx / deltaAlice.ethx) * -1)
      // Show the delte between the oracle price
      console.log(
        'Alice oracle delta (%):',
        (100 * ((deltaAlice.usdcx / deltaAlice.ethx) * -1 * 1e8 - oraclePrice)) / oraclePrice
      )

      // Delete alice and bobs flow
      // TODO: Move these deletes into afterEach()
      await sf.cfaV1
        .deleteFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(aliceSigner)
    })

    it('#1.9 revert when inputToken is not USDCx', async () => {
      // Expect revert createFlow with ETHx by Alice
      await expect(
        sf.cfaV1
          .createFlow({
            sender: aliceSigner.address,
            receiver: pool.address,
            superToken: MATICx.address,
            flowRate: '1000',
            shouldUseCallAgreement: true,
            overrides,
          })
          .exec(aliceSigner)
      ).to.be.revertedWith('!token')
    })

    it('#1.10 decrease/increase the gelato fee share correctly', async () => {
      // Alice opens a USDC stream to SuperDCAPool
      await sf.cfaV1
        .createFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          flowRate: inflowRateUsdc10x, // Increase rate 10x to make sure gelato can be paid
          shouldUseCallAgreement: true,
        })
        .exec(aliceSigner)

      // Trigger a pool distribution
      await pool.distribute('0x', true)

      // Check the initial gelatoFeeShare
      let gelatoFeeShare = await pool.gelatoFeeShare()

      // Wait 2 hours
      await increaseTime(TEST_TRAVEL_TIME)

      // Trigger another distribution
      await pool.distribute('0x', true)

      // Check the final gelatoFeeShare
      let gelatoFeeShare2 = await pool.gelatoFeeShare()

      // Expect the gelatoFeeShare has decreased by 1
      expect(gelatoFeeShare2).to.equal(gelatoFeeShare.sub(1))

      // Wait 6 hours
      await increaseTime(TEST_TRAVEL_TIME * 3)

      // Trigger another distribution
      await pool.distribute('0x', false)

      // Check the final gelatoFeeShare
      let gelatoFeeShare3 = await pool.gelatoFeeShare()

      // Expect the gelatoFeeShare has increased by 1
      console.log('gelatoFeeShare2', gelatoFeeShare2.toString())
      console.log('gelatoFeeShare3', gelatoFeeShare3.toString())
      expect(gelatoFeeShare3).to.equal(gelatoFeeShare2.add(1))

      // Alice closes a stream to dca pool
      await sf.cfaV1
        .deleteFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(aliceSigner)
    })
  })

  context('#3 - matic supertoken pool with two streamers', async () => {
    before(async () => {
      // Deploy USDC-DAI-MATIC Pool
      const registrationKey = await sfRegistrationKey(sf, adminSigner.address)

      pool = await SuperDCAPoolFactory.deploy(
        config.GELATO_OPS
      )

      const initParams = {
        host:  config.HOST_SUPERFLUID_ADDRESS,
        cfa: config.CFA_SUPERFLUID_ADDRESS,
        ida: config.IDA_SUPERFLUID_ADDRESS,
        weth: config.WMATIC_ADDRESS,
        wethx: config.MATICX_ADDRESS,
        inputToken: USDCx.address,
        outputToken: MATICx.address,
        router: config.UNISWAP_V3_ROUTER_ADDRESS,
        uniswapFactory: config.UNISWAP_V3_FACTORY_ADDRESS,
        uniswapPath: [config.USDC_ADDRESS, config.DAI_ADDRESS, config.WMATIC_ADDRESS],
        poolFees: [500, 3000],
        priceFeed: config.CHAINLINK_MATIC_USDC_PRICE_FEED,
        invertPrice: false,
        registrationKey: registrationKey,
        ops: config.GELATO_OPS,
      };

      await pool.initialize(initParams)

      maticxIDAIndex = {
        token: MATICx,
        IDAIndex: 0,
      }

      await approveSubscriptions([maticxIDAIndex], [adminSigner, aliceSigner, bobSigner])

      // Alice opens a USDC stream to SuperDCAPool
      await sf.cfaV1
        .createFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          flowRate: inflowRateUsdc,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(aliceSigner)

      // Fast forward 1 minute
      await increaseTime(TEST_TRAVEL_TIME)

      await sf.cfaV1
        .createFlow({
          sender: bobSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          flowRate: inflowRateUsdc,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(bobSigner)

      // Take a snapshot
      snapshot = await provider.send('evm_snapshot', [])
    })

    beforeEach(async () => {
      // Revert to the point SuperDCAPool was just deployed
      const success = await provider.send('evm_revert', [snapshot])
      // Take another snapshot to be able to revert again next time
      snapshot = await provider.send('evm_snapshot', [])
      expect(success).to.equal(true)
    })

    afterEach(async () => {
      await resetMeasurements()
    })

    after(async () => {})

    it('#3.1 distribution', async () => {
      // Check balance
      await takeMeasurements()

      // Fast forward an hour and distribute
      await increaseTime(TEST_TRAVEL_TIME)
      await pool.distribute('0x', false)
      await increaseTime(TEST_TRAVEL_TIME)
      await pool.distribute('0x', false)
      await increaseTime(TEST_TRAVEL_TIME)
      await pool.distribute('0x', false)
      // Check balances again
      await takeMeasurements()

      // get the price of matic from the oracle
      maticOraclePrice = await pool.getLatestPrice()
      console.log('MATIC Oracle Price: ', maticOraclePrice.toString())

      // Compute the delta
      let deltaAlice = await delta(aliceSigner, aliceBalances)
      let deltaBob = await delta(bobSigner, bobBalances)

      // Expect Alice and Bob got the right output less fee + slippage
      expect(deltaBob.maticx).to.be.above((deltaBob.usdcx / maticOraclePrice) * 1e8 * -1 * 0.98)
      expect(deltaAlice.maticx).to.be.above((deltaAlice.usdcx / maticOraclePrice) * 1e8 * -1 * 0.98)

      // Display exchange rates and deltas for visual inspection by the test engineers
      console.log('Alice exchange rate:', (deltaAlice.usdcx / deltaAlice.maticx) * -1)
      // Show the delte between the oracle price
      console.log(
        'Alice oracle delta (%):',
        (100 * ((deltaAlice.usdcx / deltaAlice.maticx) * -1 * 1e8 - maticOraclePrice)) / maticOraclePrice
      )

      // Display exchange rates and deltas for visual inspection by the test engineers
      console.log('Bob exchange rate:', (deltaBob.usdcx / deltaBob.maticx) * -1)
      // Show the delte between the oracle price
      console.log(
        'Bob oracle delta (%):',
        (100 * ((deltaBob.usdcx / deltaBob.maticx) * -1 * 1e8 - maticOraclePrice)) / maticOraclePrice
      )

      // Delete Alice's flow
      // TODO: Move to afterEach()
      await sf.cfaV1
        .deleteFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(aliceSigner)

      // Delete Bob's flow
      await sf.cfaV1
        .deleteFlow({
          sender: bobSigner.address,
          receiver: pool.address,
          superToken: USDCx.address,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(bobSigner)
    })
  })

  context('#4 - stablecoin output pool with invertedPrice', async () => {
    before(async () => {
      // Deploy MATIC-DAI-USDC  Pool
      const registrationKey = await sfRegistrationKey(sf, adminSigner.address)

      pool = await SuperDCAPoolFactory.deploy(
        config.GELATO_OPS
      )

      const initParams = {
        host:  config.HOST_SUPERFLUID_ADDRESS,
        cfa: config.CFA_SUPERFLUID_ADDRESS,
        ida: config.IDA_SUPERFLUID_ADDRESS,
        weth: config.WMATIC_ADDRESS,
        wethx: config.MATICX_ADDRESS,
        inputToken: MATICx.address,
        outputToken: USDCx.address,
        router: config.UNISWAP_V3_ROUTER_ADDRESS,
        uniswapFactory: config.UNISWAP_V3_FACTORY_ADDRESS,
        uniswapPath: [config.WMATIC_ADDRESS, config.DAI_ADDRESS, config.USDC_ADDRESS],
        poolFees: [3000, 100],
        priceFeed: config.CHAINLINK_MATIC_USDC_PRICE_FEED,
        invertPrice: true,
        registrationKey: registrationKey,
        ops: config.GELATO_OPS,
      };

      await pool.initialize(initParams);

      usdcxIDAIndex = {
        token: USDCx,
        IDAIndex: 0,
      }

      await approveSubscriptions([usdcxIDAIndex], [adminSigner, aliceSigner, bobSigner])

      // Alice opens a MATICx stream to SuperDCAPool
      await sf.cfaV1
        .createFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: MATICx.address,
          flowRate: '1000000000',
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(aliceSigner)

      // Fast forward time to allow the stream to start
      await increaseTime(TEST_TRAVEL_TIME)

      await sf.cfaV1
        .createFlow({
          sender: bobSigner.address,
          receiver: pool.address,
          superToken: MATICx.address,
          flowRate: '1000000000',
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(bobSigner)

      // Take a snapshot
      snapshot = await provider.send('evm_snapshot', [])
    })

    beforeEach(async () => {
      // Revert to the point SuperDCAPool was just deployed
      const success = await provider.send('evm_revert', [snapshot])
      // Take another snapshot to be able to revert again next time
      snapshot = await provider.send('evm_snapshot', [])
      expect(success).to.equal(true)
    })

    afterEach(async () => {
      await resetMeasurements()
    })

    after(async () => {})

    it('#4.1 distribution', async () => {
      // Check balance
      await takeMeasurements()

      // Fast forward and distribute
      await pool.distribute('0x', true)
      await increaseTime(TEST_TRAVEL_TIME * 100)
      await pool.distribute('0x', true)
      await increaseTime(TEST_TRAVEL_TIME * 100)
      await pool.distribute('0x', true)
      // Check balances again
      await takeMeasurements()

      // get the price of matic from the oracle
      maticOraclePrice = await pool.getLatestPrice()
      console.log('MATIC Oracle Price: ', maticOraclePrice.toString())

      // Compute the delta
      let deltaAlice = await delta(aliceSigner, aliceBalances)
      let deltaBob = await delta(bobSigner, bobBalances)

      // Expect Alice and Bob got the right output less fee + slippage
      expect(deltaBob.usdcx).to.be.above(((deltaBob.maticx * maticOraclePrice) / 1e8) * -1 * 0.98)
      expect(deltaAlice.usdcx).to.be.above(((deltaAlice.maticx * maticOraclePrice) / 1e8) * -1 * 0.98)

      // Display exchange rates and deltas for visual inspection by the test engineers
      console.log('Alice exchange rate:', (deltaAlice.usdcx / deltaAlice.maticx) * -1)
      // Show the delte between the oracle price
      console.log(
        'Alice oracle delta (%):',
        (100 * ((deltaAlice.usdcx / deltaAlice.maticx) * -1 * 1e8 - maticOraclePrice)) / maticOraclePrice
      )

      // Display exchange rates and deltas for visual inspection by the test engineers
      console.log('Bob exchange rate:', (deltaBob.usdcx / deltaBob.maticx) * -1)
      // Show the delte between the oracle price
      console.log(
        'Bob oracle delta (%):',
        (100 * ((deltaBob.usdcx / deltaBob.maticx) * -1 * 1e8 - maticOraclePrice)) / maticOraclePrice
      )

      // Delete Alice's flow
      // TODO: Move to afterEach()
      await sf.cfaV1
        .deleteFlow({
          sender: aliceSigner.address,
          receiver: pool.address,
          superToken: MATICx.address,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(aliceSigner)

      // Delete Bob's flow
      await sf.cfaV1
        .deleteFlow({
          sender: bobSigner.address,
          receiver: pool.address,
          superToken: MATICx.address,
          shouldUseCallAgreement: true,
          overrides,
        })
        .exec(bobSigner)
    })

    it('#4.2 Should return the correct next distribution time', async () => {
      const gasPrice = 3200 // 3200 GWEI
      const gasLimit = 120000
      const tokenToMaticRate = 10 ** 9 // 1 matic = 1 usd
      const lastDistributedAt = await pool.lastDistributedAt()

      const netFlowRate = await sf.cfaV1.getNetFlow({
        superToken: MATICx.address,
        account: pool.address,
        providerOrSigner: adminSigner,
      })
      console.log('Pool input token NetFlowRate:', netFlowRate.toString())
      console.log('Last Distribution time:', lastDistributedAt.toString())

      const actualDistributionTime = await pool.getNextDistributionTime(gasPrice, gasLimit, tokenToMaticRate)

      const calculatedDistributionTime =
        parseInt(lastDistributedAt) +
        Math.floor(
          Math.floor((gasPrice * gasLimit * tokenToMaticRate) / 10 ** 9) / Math.floor(parseInt(netFlowRate) / 10 ** 9)
        )

      expect(actualDistributionTime).to.equal(calculatedDistributionTime)
    })
  })
})
