import '@nomiclabs/hardhat-ethers'
import { ethers, network } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'

export const mineNext = async (): Promise<void> => {
  await network.provider.send('evm_mine') // mine next (+1 blockheight)
}

export default describe('GenericToken', function () {
  // unset timeout from the test
  this.timeout(0)

  let owner: SignerWithAddress
  let admin: SignerWithAddress
  let rewarder: SignerWithAddress
  let QuestRewardContract: Contract

  // setup for each test
  beforeEach(async () => {
    // get test accounts
    owner = (await ethers.getSigners())[0]
    admin = (await ethers.getSigners())[1]
    rewarder = (await ethers.getSigners())[2]

    // deploy test token
    const TestTokenFactory = await ethers.getContractFactory('QuestReward')
    QuestRewardContract = await TestTokenFactory.deploy(admin.address)
  })

  it('sets rewarder', async function () {
    QuestRewardContract.connect(admin).setRewarder(rewarder.address)

    mineNext()

    expect(await QuestRewardContract.rewarder()).to.equal(rewarder.address)
  })
})
