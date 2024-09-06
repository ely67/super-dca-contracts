# Scripts for Base Sepolia 

## Deployed Contracts
This is a summary of the contracts that were deployed with the scripts in this directory. 

| Contract Name | Contract Address | Deployment Script |
|---------------|------------------|-------------------|
| Deployer | 0x99BE9FC5b420F7B59A6340f807E279d1E1E75377 | NA | 
| Super DCA Token | 0x036CbD53842c5426634e7929541eC2318f3dCF7e | NA |
| fUSDC>>fDAI Pool |  | `./deploy_dca_pool.ts` | 

## Gelato Task Ids
* fUSDC>>fDAI taskId: https://app.gelato.network/functions/task/0x6dc402b5e2f2f2ff780e3d6cd0ff9a8c4add69dd6583d119e844eeee422fa033:11155111


### fUSDC>>fDAI
```shell
INPUT_TOKEN=0x1650581F573eAd727B92073B5Ef8B4f5B94D1648 \
INPUT_TOKEN_UNDERLYING=0x6B0dacea6a72E759243c99Eaed840DEe9564C194 \
OUTPUT_TOKEN=0x7635356D54d8aF3984a5734C2bE9e25e9aBC2ebC \
OUTPUT_TOKEN_UNDERLYING=0x6b008BAc0e5846cB5d9Ca02ca0e801fCbF88B6f9 \
PRICE_FEED=0xD1092a65338d049DB68D7Be6bD89d17a0929945e \
UNISWAP_POOL_FEE=500 \
npx hardhat run scripts/sepolia/deploy_dca_pool.ts --network base_sepolia
```

### USDC>wETH
```shell
INPUT_TOKEN=0x1650581F573eAd727B92073B5Ef8B4f5B94D1648 \
INPUT_TOKEN_UNDERLYING=0x6B0dacea6a72E759243c99Eaed840DEe9564C194 \
OUTPUT_TOKEN=0x143ea239159155B408e71CDbE836e8CFD6766732 \
OUTPUT_TOKEN_UNDERLYING=0x4200000000000000000000000000000000000006 \
PRICE_FEED=0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1 \
UNISWAP_POOL_FEE=500 \
npx hardhat run scripts/sepolia/deploy_dca_pool.ts --network base_sepolia
```

### fDAI>>fUSDC
```shell
INPUT_TOKEN=0xb598e6c621618a9f63788816ffb50ee2862d443b \
INPUT_TOKEN_UNDERLYING=0xe72f289584eDA2bE69Cfe487f4638F09bAc920Db \
OUTPUT_TOKEN=0x9ce2062b085a2268e8d769ffc040f6692315fd2c \
OUTPUT_TOKEN_UNDERLYING=0x4E89088Cd14064f38E5B2F309cFaB9C864F9a8e6 \
PRICE_FEED=0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E \
UNISWAP_POOL_FEE=500 \
npx hardhat run scripts/sepolia/deploy_dca_pool.ts --network tenderly
```