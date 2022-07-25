import '@nomiclabs/hardhat-ethers'
import { ethers, network } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export const mineNext = async (): Promise<void> => {
  await network.provider.send('evm_mine') // mine next (+1 blockheight)
}

export default describe('QuestReward', function () {
  // unset timeout from the test
  this.timeout(0)

  let owner: SignerWithAddress
  let admin: SignerWithAddress
  let rewarder: SignerWithAddress
  let QuestRewardContract: Contract
  let TestToken: Contract

  it('cannot deploy without admin address', async function () {
    const QuestFactory = await ethers.getContractFactory('QuestReward')
    expect(QuestFactory.deploy(ZERO_ADDRESS)).to.be.revertedWith('0x0 admin')
  })

  // setup for each test
  beforeEach(async () => {
    // get test accounts
    owner = (await ethers.getSigners())[0]
    admin = (await ethers.getSigners())[1]
    rewarder = (await ethers.getSigners())[2]

    const TestTokenFactory = await ethers.getContractFactory('GenericToken')

    TestToken = await TestTokenFactory.deploy(
      'test token',
      'TEST',
      '21000000000000000000000000000' // 21 billion * 10**18
    )

    // deploy test token
    const QuestRewardFactory = await ethers.getContractFactory('QuestReward')
    QuestRewardContract = await QuestRewardFactory.deploy(admin.address)

    QuestRewardContract.connect(admin).setRewarder(rewarder.address)
    mineNext()
  })

  it('cannot sets rewarder with empty address', async function () {
    await expect(
      QuestRewardContract.connect(admin).setRewarder(ZERO_ADDRESS)
    ).to.be.revertedWith('0x0 address')
  })

  it('sets rewarder', async function () {
    QuestRewardContract.connect(admin).setRewarder(rewarder.address)

    mineNext()

    expect(await QuestRewardContract.rewarder()).to.equal(rewarder.address)
  })

  it('create campaigns correctly', async () => {
    const campaignID = 'campaign1'
    await QuestRewardContract.connect(rewarder).createCampaign(
      TestToken.address,
      campaignID
    )
    mineNext()
    const campaignInfo = await QuestRewardContract.campaigns(campaignID)
    expect(campaignInfo.tokenReward).to.equal(TestToken.address)
  })

  //   it('funds tokens correctly', async () => {
  //     const stakeAmt = [100, 250]

  //     await TestToken.transfer(rewarder.address, '10000000000000000000000000000') // 10B tokens
  //     await TestToken.transfer(rewarder.address, '10000000000000000000000000000') // 10B tokens

  //     await TestToken.connect(rewarder).approve(
  //       QuestRewardContract.address,
  //       '1000'
  //     )

  //     await QuestRewardContract.fund(1000, 'campaign1')
  //     mineNext()
  //   })
})
