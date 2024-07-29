# Scripts for Mumbai 
This is documentation of the Hardhat scripting that was used to do the Mumbai Deployment

## Hardhat Configuraiton for Deployment
Confirm that the `hardhat.config.ts` is configured for this network.

## Using Tenderly RPC
Rather than deploy the contracts to Mumbai, it's recommended to fork the network using Tenderly. This will allow you to test the deployment scripts without spending any real testnet MATIC. Also gives us the ability to adjust our wallets MATIC balance (no need for facuets).

## Deployed Contracts
This is a summary of the contracts that were deployed with the scripts in this directory. 

| Contract Name | Contract Address | Deployment Script |
|---------------|------------------|-------------------|
| Deployer | 0xC07E21c78d6Ad0917cfCBDe8931325C392958892 | NA |
| Super DCA Token | 0xb1599CDE32181f48f89683d3C5Db5C5D2C7C93cc | NA |
| OP Token | 0x4200000000000000000000000000000000000042 | NA |
| USDC.e Token | 0x7F5c764cBc14f9669B88837ca1490cCa17c31607 | NA |
| WETH Token | 0x4200000000000000000000000000000000000006 | NA |
| Super DCA Pool: USDC>>ETH | 0x4507d2B91736A615131A28c3DCcDEb66E975FA97 | `./deploy_dca_pool.ts` | 
| Super DCA Pool: USDC>>OP | 0x981Ac6F25F28dCB47DB1708A60881C76fe64D84E | `./deploy_dca_pool.ts` |
| Super DCA Pool: ETH>>USDC | 0xc7E3AF4724B62A8f943459D86E2dd20fEFa8200E | `./deploy_dca_pool.ts` |
| Super DCA Pool: OP>>USDC |  | `./deploy_dca_pool.ts` |

## Gelato Task Ids
* USDC>>ETH taskId: 0x8da3c051c89d977f55ae4c6f3e1ecb0f7039b424ce77c69c2d3cce47b69e3346
* USDC>>OP taskId: 0xa6b182f593e4bd00e83bb4aa82b6b10b238db607594fee07a6dd2c150a9bf078

### USDC>>ETH
```shell
INPUT_TOKEN=0x8430f084b939208e2eded1584889c9a66b90562f \
INPUT_TOKEN_UNDERLYING=0x7F5c764cBc14f9669B88837ca1490cCa17c31607 \
OUTPUT_TOKEN=0x4ac8bD1bDaE47beeF2D1c6Aa62229509b962Aa0d \
OUTPUT_TOKEN_UNDERLYING=0x4200000000000000000000000000000000000006 \
PRICE_FEED=0x13e3Ee699D1909E989722E753853AE30b17e08c5 \
UNISWAP_POOL_FEE=500 \
npx hardhat run scripts/optimism/deploy_dca_pool.ts --network tenderly
```

### USDC>>OP
```shell
INPUT_TOKEN=0x8430f084b939208e2eded1584889c9a66b90562f \
INPUT_TOKEN_UNDERLYING=0x7F5c764cBc14f9669B88837ca1490cCa17c31607 \
OUTPUT_TOKEN=0x1828Bff08BD244F7990edDCd9B19cc654b33cDB4 \
OUTPUT_TOKEN_UNDERLYING=0x4200000000000000000000000000000000000042 \
PRICE_FEED=0x0D276FC14719f9292D5C1eA2198673d1f4269246 \
UNISWAP_POOL_FEE=500 \
npx hardhat run scripts/optimism/deploy_dca_pool.ts --network tenderly
```

### ETH>>USDC
```shell
INPUT_TOKEN=0x4ac8bD1bDaE47beeF2D1c6Aa62229509b962Aa0d \
INPUT_TOKEN_UNDERLYING=0x4200000000000000000000000000000000000006 \
OUTPUT_TOKEN=0x8430f084b939208e2eded1584889c9a66b90562f \
OUTPUT_TOKEN_UNDERLYING=0x7F5c764cBc14f9669B88837ca1490cCa17c31607 \
PRICE_FEED=0x13e3Ee699D1909E989722E753853AE30b17e08c5 \
UNISWAP_POOL_FEE=500 \
INVERT_PRICE=true \
npx hardhat run scripts/optimism/deploy_dca_pool.ts --network tenderly
```

### OP>>USDC
```shell
INPUT_TOKEN=0x1828Bff08BD244F7990edDCd9B19cc654b33cDB4 \
INPUT_TOKEN_UNDERLYING=0x4200000000000000000000000000000000000042 \
OUTPUT_TOKEN=0x8430f084b939208e2eded1584889c9a66b90562f \
OUTPUT_TOKEN_UNDERLYING=0x7F5c764cBc14f9669B88837ca1490cCa17c31607 \
PRICE_FEED=0x0D276FC14719f9292D5C1eA2198673d1f4269246 \
UNISWAP_POOL_FEE=500 \
INVERT_PRICE=true \
npx hardhat run scripts/optimism/deploy_dca_pool.ts --network optimism
```