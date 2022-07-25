import '@nomiclabs/hardhat-ethers'
import { ethers, network } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const campaignID = 'campaign1'

export const mineNext = async (): Promise<void> => {
  await network.provider.send('evm_mine') // mine next (+1 blockheight)
}

export default describe('QuestReward', function () {
  // unset timeout from the test
  this.timeout(0)

  let owner: SignerWithAddress
  let admin: SignerWithAddress
  let rewarder: SignerWithAddress
  let user: SignerWithAddress
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
    user = (await ethers.getSigners())[3]

    const TestTokenFactory = await ethers.getContractFactory('GenericToken')

    TestToken = await TestTokenFactory.deploy(
      'test token',
      'TEST',
      '21000000000000000000000000000' // 21 billion * 10**18
    )

    // deploy test token
    const QuestRewardFactory = await ethers.getContractFactory('QuestReward')
    QuestRewardContract = await QuestRewardFactory.deploy(admin.address)
    mineNext()
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
    await QuestRewardContract.connect(rewarder).createCampaign(
      TestToken.address,
      campaignID
    )
    mineNext()
    const campaignInfo = await QuestRewardContract.campaigns(campaignID)
    expect(campaignInfo.tokenReward).to.equal(TestToken.address)
  })

  it('campaign can be created, funded, rewarded, claimed and withdrawed', async () => {
    mineNext()

    const REWARD_POOL = 1000
    const USER_REWARD = 100

    // Transferring token to admin
    await TestToken.transfer(admin.address, '10000000000000') // 1000 tokens
    await TestToken.connect(admin).approve(QuestRewardContract.address, '1000')
    mineNext()

    const OwnerBalance = await TestToken.balanceOf(admin.address)

    // Creating campaign
    await QuestRewardContract.connect(rewarder).createCampaign(
      TestToken.address,
      campaignID
    )
    mineNext()

    // Funding the campaign
    await QuestRewardContract.connect(admin).fund(REWARD_POOL, campaignID)
    mineNext()
    const campaignInfo = await QuestRewardContract.campaigns(campaignID)
    expect(campaignInfo.rewardPool).to.equal(REWARD_POOL)

    // Rewarding the user
    await QuestRewardContract.connect(rewarder).reward(
      USER_REWARD,
      user.address,
      campaignID
    )
    mineNext()

    const userData = await QuestRewardContract.userRewards(
      campaignID,
      user.address
    )
    expect(userData).to.equal(USER_REWARD)

    const totalRewards = await QuestRewardContract.totalRewards(
      TestToken.address
    )
    expect(totalRewards).to.equal(USER_REWARD)

    // User Claiming the reward
    await QuestRewardContract.connect(user).claim(campaignID)
    mineNext()
    expect(await TestToken.balanceOf(user.address)).to.equal(
      USER_REWARD.toString()
    )
    // After claim, need to reinitialize
    const campaignInfoClaim = await QuestRewardContract.campaigns(campaignID)
    const userDataClaim = await QuestRewardContract.userRewards(
      campaignID,
      user.address
    )
    expect(campaignInfoClaim.rewardPool).to.equal(REWARD_POOL - USER_REWARD)
    expect(userDataClaim).to.equal(0)
    const claimedInfo = await QuestRewardContract.claimedRewards(
      campaignID,
      user.address
    )
    expect(claimedInfo).to.equal(USER_REWARD)

    // Admin withdrawing idle rewards
    await QuestRewardContract.connect(admin).withdraw(campaignID)
    mineNext()
    expect(await TestToken.balanceOf(admin.address)).to.equal(
      OwnerBalance - USER_REWARD
    )
    // After withdraw, need to reinitialize
    const campaignInfoWithdraw = await QuestRewardContract.campaigns(campaignID)
    expect(campaignInfoWithdraw.rewardPool).to.equal(0)
  })
})
