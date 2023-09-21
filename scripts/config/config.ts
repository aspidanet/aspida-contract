export const network = {
    1: "mainnet",
    42161: "arbitrum",
    10: "optimism",
    5: "goerli",
};
export const deployInfo = {
    mainnet: {
        DepositContract: "0x00000000219ab540356cBB839Cbe05303d7705Fa",
        strategy: {
            Lido: {
                stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
            },
        },
    },
    arbitrum: {},
    optimism: {},
    goerli: {
        DepositContract: "0xff50ed3d0ec03aC01D4C79aAd74928BFF48a7b2b",
        CorePrimary: {
            reserveRatio: "0",
            treasuryRatio: "0.01",
            actionControl: {
                submit: {
                    actionId: 0,
                    limit: "3",
                    threshold: "0",
                },
                withdraw: {
                    actionId: 1,
                    limit: "6",
                    threshold: "0",
                },
            },

            managers: ["0xFF0000b1C71A73f215EB73fA68BB470bCE4b7C02", "0xFF0000b1C71A73f215EB73fA68BB470bCE4b7C02"],
        },
        strategy: {
            Lido: {
                stETH: "0x1643E812aE58766192Cf7D2Cf9567dF2C37e9B7F",
                mintCap: "3",
                receiver: "0x95140D3e9dBfF38826eD13C4aFb23a40C97B0F0D",
            },
        },
    },
};
