// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat'

export async function main(): Promise<void> {
  // params
  const name: string = process.env.ADMIN || ''

  // We get the contract to deploy
  const QuestRewardFactory = await hre.ethers.getContractFactory('QuestReward')

  // deploy token
  const Quest = await QuestRewardFactory.deploy(name)

  // log deployed addresses
  console.log('Quest deployed to ', Quest.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

// ADMIN=0x5f7229530Ed274F457cA0BA51FCf4158C426C63E npx hardhat run ./scripts/deploy.ts --network bsc_test
