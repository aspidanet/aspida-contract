import { deployments, getNamedAccounts, getChainId, ethers } from "hardhat";

import { sendTransaction } from "./utils/utils";

import { network, deployInfo } from "./config/config";

async function main() {
    const chainId = await getChainId();

    const deploymentsAll = await deployments.all();
    const aETH = await ethers.getContractAt("aETH", deploymentsAll.aETH.address);

    const owner = await aETH.owner();
    const deployer = (await getNamedAccounts()).deployer;
    const send = owner == deployer;

    const managers = [deploymentsAll.CorePrimary.address];
    const currentManagers = await aETH.managers();
    await Promise.all(
        managers.map(async (manager) => {
            if (!currentManagers.includes(manager as string)) {
                console.log(`aETH addManager: ${manager}\n`);
                await sendTransaction(aETH, "_addManager", [manager], send);
            }
        })
    );

    const minters = [deploymentsAll.StETHMinter.address];
    const mintCaps = [ethers.utils.parseEther(deployInfo[network[chainId]].strategy.Lido.mintCap)];
    await Promise.all(
        minters.map(async (minter, index) => {
            const currentMintCap = await aETH.mintCap(minter);
            const mintCap = mintCaps[index];
            if (!currentMintCap.eq(mintCap)) {
                console.log(`set minter cap:`);
                console.log(`minter:    ${minter}`);
                console.log(`cap:       ${mintCap.toString()}`);
                await sendTransaction(aETH, "_setMinterCap", [minter, mintCap], send);
            }
        })
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
