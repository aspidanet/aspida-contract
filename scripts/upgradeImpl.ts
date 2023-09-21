import { deployments, getNamedAccounts, ethers } from "hardhat";

import { sendTransaction } from "./utils/utils";

async function main() {
    let deploymentsAll = await deployments.all();
    const ProxyAdmin = await ethers.getContractAt("ProxyAdminPro", deploymentsAll.ProxyAdmin.address);
    delete deploymentsAll.ProxyAdmin;

    const owner = await ProxyAdmin.owner();
    const deployer = (await getNamedAccounts()).deployer;
    const send = owner == deployer;

    await Promise.all(
        Object.keys(deploymentsAll).map(async (contractName) => {
            if (contractName.slice(-4) == "Impl") {
                const proxyAddress = deploymentsAll[contractName.slice(0, -4)].address;
                const implAddress = deploymentsAll[contractName].address;
                const currentImplAddress = await ProxyAdmin.getProxyImplementation(proxyAddress);
                if (implAddress != currentImplAddress) {
                    console.log(`${contractName.slice(0, -4)} upgrade implementation\n`);
                    await sendTransaction(ProxyAdmin, "upgrade", [proxyAddress, implAddress], send);
                }
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
