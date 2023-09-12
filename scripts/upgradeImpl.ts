import { deployments, getNamedAccounts, ethers } from "hardhat";

async function main() {
    let deploymentsAll = await deployments.all();
    const proxyAdminContract = await ethers.getContractFactory("ProxyAdminPro");
    const proxyAdmin = proxyAdminContract.attach(deploymentsAll.ProxyAdmin.address);
    delete deploymentsAll.ProxyAdmin;

    const owner = await proxyAdmin.owner();
    const deployer = (await getNamedAccounts()).deployer;
    const sendStatus = owner == deployer;

    await Promise.all(
        Object.keys(deploymentsAll).map(async (contractName) => {
            if (contractName.slice(-4) == "Impl") {
                const proxyAddress = deploymentsAll[contractName.slice(0, -4)].address;
                const implAddress = deploymentsAll[contractName].address;
                const currentImplAddress = await proxyAdmin.getProxyImplementation(proxyAddress);
                if (implAddress != currentImplAddress) {
                    if (sendStatus) {
                        await proxyAdmin.upgrade(proxyAddress, implAddress);
                        return;
                    }

                    const data = proxyAdmin.interface.encodeFunctionData("upgrade", [proxyAddress, implAddress]);
                    console.log(`${contractName.slice(0, -4)} upgrade implementation\n`);
                    console.log(`target address: \n${proxyAdmin.address}\n`);
                    console.log(`transaction data: \n${data}\n\n`);
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
