export const network = {
    1: "mainnet",
    42161: "arbitrum",
    10: "optimism",
    5: "goerli",
    11155111: "sepolia",
};
export const deployInfo = {
    mainnet: {
        DepositContract: "0x00000000219ab540356cBB839Cbe05303d7705Fa",
        aETH: {
            name: "Aspida ETH",
            symbol: "aETH",
        },
        saETH: {
            name: " Aspida staked ETH",
            symbol: "saETH",
            duration: "7", // day
        },
        CorePrimary: {
            reserveRatio: "0",
            treasuryRatio: "0",
            managers: [],
        },
        strategy: {
            Lido: {
                stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
                mintCap: "0",
                receiver: "",
            },
        },
        RewardOracle: {
            zeroEpochTimestamp: "1606824023",
            annualInterestRateCap: "0",
            validatorLimitPerEpoch: "0",
            managers: [],
        },
    },
    arbitrum: {},
    optimism: {},
    goerli: {
        DepositContract: "0xff50ed3d0ec03aC01D4C79aAd74928BFF48a7b2b",
        aETH: {
            name: "Aspida ETH",
            symbol: "aETH",
        },
        saETH: {
            name: " Aspida staked ETH",
            symbol: "saETH",
            duration: "7", // day
        },
        CorePrimary: {
            reserveRatio: "0",
            treasuryRatio: "0.01",
            managers: [],
        },
        strategy: {
            Lido: {
                stETH: "0x1643E812aE58766192Cf7D2Cf9567dF2C37e9B7F",
                mintCap: "3",
                receiver: "",
            },
        },
        RewardOracle: {
            zeroEpochTimestamp: "1616508384",
            annualInterestRateCap: "0.1",
            validatorLimitPerEpoch: "10",
            managers: [],
        },
    },
};
