import { Constants } from "../../../misc/Constants"

// Get the right constants for the network
const config = Constants['optimism'];

// Export the arguments for the deployment
module.exports = [
  config.GELATO_OPS
];
