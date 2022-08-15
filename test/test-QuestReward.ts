import '@nomiclabs/hardhat-ethers'
import { ethers, network } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'
import { loadFixture } from 'ethereum-waffle'
// const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const campaignID = 'campaign1'
const REWARD_POOL = 1000
const USER_REWARD = 100

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
  let user2: SignerWithAddress
  let user3: SignerWithAddress
  let user4: SignerWithAddress
  let user5: SignerWithAddress
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
    user2 = (await ethers.getSigners())[4]
    user3 = (await ethers.getSigners())[5]
    user4 = (await ethers.getSigners())[6]
    user5 = (await ethers.getSigners())[7]

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

  async function createCampaign() {
    await QuestRewardContract.connect(rewarder).createCampaign(
      TestToken.address,
      campaignID
    )

    mineNext()

    return { campaignID }
  }

  async function sendTokenToAdmin() {
    await TestToken.transfer(admin.address, '100000000000000') // 1000 tokens
    await TestToken.connect(admin).approve(
      QuestRewardContract.address,
      '10000000000000'
    )
    mineNext()

    return { admin }
  }

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

  it('cannot sets rewarder as non admin', async function () {
    await expect(
      QuestRewardContract.connect(user5).setRewarder(rewarder.address)
    ).to.be.revertedWith('Ownable: caller is not the owner')
  })

  it('create campaigns correctly', async () => {
    await expect(
      QuestRewardContract.connect(user2).createCampaign(
        TestToken.address,
        campaignID
      )
    ).to.be.revertedWith('caller not rewarder')
    await QuestRewardContract.connect(rewarder).createCampaign(
      TestToken.address,
      campaignID
    )
    mineNext()
    const campaignInfo = await QuestRewardContract.campaigns(campaignID)
    expect(campaignInfo.tokenReward).to.equal(TestToken.address)
  })

  it('cannot reward when no users', async () => {
    expect(
      QuestRewardContract.connect(rewarder).reward([], [], campaignID)
    ).to.be.revertedWith('users should be more than zero')
  })

  it('cannot reward when amounts are not the same as users', async () => {
    expect(
      QuestRewardContract.connect(rewarder).reward(
        [1, 2, 3],
        [user.address],
        campaignID
      )
    ).to.be.revertedWith('amounts is not the same as users')
  })

  it('campaign can be created, funded, rewarded, claimed and withdrawed', async () => {
    // Transferring token to admin
    const { admin } = await loadFixture(sendTokenToAdmin)

    const OwnerBalance = await TestToken.balanceOf(admin.address)

    // Creating campaign
    await loadFixture(createCampaign)

    expect(
      QuestRewardContract.connect(rewarder).createCampaign(
        TestToken.address,
        campaignID
      )
    ).to.be.revertedWith('campaign has been set')

    // Funding the campaign
    await QuestRewardContract.connect(admin).fund(REWARD_POOL, campaignID)
    mineNext()

    const campaignInfo2 = await QuestRewardContract.campaigns(campaignID)
    expect(campaignInfo2.rewardPool).to.equal(REWARD_POOL)

    // Rewarding the user
    await QuestRewardContract.connect(rewarder).reward(
      [USER_REWARD],
      [user.address, user5.address],
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
    expect(totalRewards).to.equal(USER_REWARD * 2)

    const extraRewards = [20, 50, 1000]
    const usersAddress = [user2.address, user3.address, user4.address]
    mineNext()

    // Rewarding multiple users
    await QuestRewardContract.connect(rewarder).reward(
      extraRewards,
      usersAddress,
      campaignID
    )
    mineNext()

    for (let i = 0; i < usersAddress.length; i++) {
      const userReward = await QuestRewardContract.userRewards(
        campaignID,
        usersAddress[i]
      )
      expect(userReward.toNumber()).to.equal(extraRewards[i])
    }

    // User1 Claiming the reward
    await QuestRewardContract.connect(user).claim(campaignID)
    mineNext()
    expect(await TestToken.balanceOf(user.address)).to.equal(
      USER_REWARD.toString()
    )

    // User 1 should not be able to claim again
    expect(
      QuestRewardContract.connect(user).claim(campaignID)
    ).to.be.revertedWith('nothing to be claimed')
    mineNext()

    // User4 Claiming the reward, should fail because pool is not enough
    expect(
      QuestRewardContract.connect(user4).claim(campaignID)
    ).to.be.revertedWith('reward pool is not enough')

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

    // Non admin should not be able to withdraw
    expect(QuestRewardContract.connect(user).withdraw(campaignID)).to.be
      .reverted
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
