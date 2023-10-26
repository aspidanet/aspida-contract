import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "hardhat-abi-exporter";
import "hardhat-gas-reporter";
import "hardhat-storage-layout";

import * as dotenv from "dotenv";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
// task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
//   const accounts = await hre.ethers.getSigners();

//   for (const account of accounts) {
//     console.log(account.address);
//   }
// });

const config: HardhatUserConfig = {
    networks: {
        goerli: {
            url: "https://ethereum-goerli.publicnode.com",
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        localhost: {
            url: "http://localhost:24012/rpc", // truffle-dashboard
            timeout: 200000,
        },
    },
    mocha: {
        timeout: 4000000,
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: "USD",
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    solidity: {
        version: "0.8.10",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    abiExporter: {
        path: "./abi",
        runOnCompile: true,
        clear: true,
        flat: true,
        only: ["dETH", "sdETH", "CorePrimary", "StrategyLido", "RewardOracle", "StETHMinter"],
        spacing: 2,
        pretty: false,
    },
    paths: {
        deploy: "./scripts/deploy",
        deployments: "./deployments",
    },
    namedAccounts: {
        deployer: 0,
    },
};

export default config;
