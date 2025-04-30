- I make a change in `SuperDCATrade::getLatestTrade` add a require 
- I replace Ops.sol with Automate.sol
- I change the import from 
```solidity
  import { 
  ISuperfluid,
  ISuperToken,
  ISuperAgreement
} from "@superfluid-finance/ethereum-contracts/interfaces/superfluid/ISuperfluid.sol"; 
```
to 
```solidity
import { ISuperfluid } from "@superfluid-finance/ethereum-contracts/interfaces/superfluid/ISuperfluid.sol";
import { ISuperToken } from "@superfluid-finance/ethereum-contracts/interfaces/superfluid/ISuperToken.sol";
import { ISuperAgreement } from "@superfluid-finance/ethereum-contracts/interfaces/superfluid/ISuperAgreement.sol";
```
in the SuperDCAPoolV1.t.sol

- I change the name of `ISwapRouter02` to `ISwapRouter` because it was wronge and there is no file with that name in the uniswap dependency
- I change remapping in the foundry.toml
- I Import ISwapRouter to the superdcapoolv1.sol from the uniswap dependency
- I change ISETHCustom to ISETH from the protocol-monorepo dependency
- I import `import {ModuleData, Module} from "@gelato/contracts/integrations/Types.sol";` to `SuperDCAPoolV1.sol`
- I change ops param in `InitParams` struct to `automate`
- I import `import {LibDataTypes} from "@gelato/contracts/LibDataTypes.sol";` to SuperDCAPoolV1.t.sol 
- I removed `//import {ModuleData, Module} from "@gelato/contracts/integrations/Types.sol"` and replaced it with above library
- I removed counters library from SuperDCATrade 
- In the `SuperDCAPoolV1::stake` there is reentrancy vulnerability I transfer change states befor the transfer calls
- in the `SuperDCATrade` I add a `_` to the `nextTradeId` variable because it is `private` and linter made error
- I replace `SuperDCAPoolV1::_createTask` to `SuperDCAPoolV1::_createGelatoTask` becuase it made conflict with `AutomateTaskCreator::_createTask` 
- I removed `external` subdirectory from the contracts directory 
- I added a few to remapping in foundry.toml