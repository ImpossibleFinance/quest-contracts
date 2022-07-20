// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

contract QuestReward is Ownable, ReentrancyGuard {
    using SafeERC20 for ERC20;

    // Admin (multisig address that is settable by Owner)
    address public admin;

    // Rewarder (address that is settable by admin)
    address public rewarder;

    // Mapping of campaignID => User Address => TotalRewards
    // campaignID here can be anything, example for Learn and Earn is QuizID
    mapping(string => mapping(address => uint256)) public userRewards;

    // Mapping of campaignID to the ERC Token
    mapping(string => address) public campaignTokens;

    // Mapping of ERCToken to Rewards Available to be claimed
    mapping(address => uint256) public tokenRewardPool;

    // Statistics
    // Total rewards rewarded for each token
    mapping(address => uint256) public totalRewards;

    // Total rewards claimed for each token
    mapping(address => uint256) public totalRewardsClaimed;


    // EVENTS

    event SetRewarder(address indexed rewarder);
    event Reward(string campaignID, address indexed user, uint256 amount);
    event Fund(address indexed token, address indexed user, uint256 amount);
    event Claim(address indexed user, string campaignID, uint256 amount);
    event Withdraw(address indexed token, uint256 amount);

    // CONSTRUCTOR

    constructor(
        address _admin
    ) {
        require(_admin != address(0), '0x0 admin');
        admin = _admin; 
    }

    // MODIFIERS

    // Throws if called by any account other than the admin.
    modifier onlyAdmin() {
        require(_msgSender() == admin, 'caller not admin');
        _;
    }

     modifier onlyRewarder() {
        require(_msgSender() == rewarder, 'caller not rewarder');
        _;
    }


    // FUNCTIONS

    // Function for owner to set an rewarder
    function setRewarder(address _rewarder) external onlyAdmin {
        rewarder = _rewarder;

        emit SetRewarder(_rewarder);
    }

    // Function for funding the tokens to the reward pool
    function fund(uint256 amount, address token) external {
        // transfer specified amount from funder to this contract
        ERC20(token).safeTransferFrom(_msgSender(), address(this), amount);
        tokenRewardPool[token] += amount;

        emit Fund(token, _msgSender(), amount);
    }

    // Function for withdrawing money from reward pool, in case we want to sunset this contract
    function withdraw(address token) external onlyAdmin {
        uint256 amount = tokenRewardPool[token];
        ERC20(token).safeTransfer(_msgSender(), amount);
        tokenRewardPool[token] = 0;

        emit Withdraw(token, amount);
    }

    // Function to be called when we want to reward user after finishing a campaign
    function reward(uint256 amount, address user, string calldata campaignID, address tokenAddress) external onlyRewarder {
        // Set the campaign-token mapping if it is not set before
        if (campaignTokens[campaignID] == address(0)) {
            campaignTokens[campaignID] = tokenAddress;
        }

        // transfer specified amount from funder to this contract
        userRewards[campaignID][user] += amount;
        address rewardToken = campaignTokens[campaignID];

        // Stats
        totalRewards[rewardToken] += amount;

        emit Reward(campaignID, _msgSender(), amount);
    }

    // Function to be called when our user wants to claim their reward
    function claim(string calldata campaignID) external {
        address rewardToken = campaignTokens[campaignID];
        uint256 amountToBeClaimed = userRewards[campaignID][_msgSender()];

        require(amountToBeClaimed <= tokenRewardPool[rewardToken], 'reward pool is not enough');
        userRewards[campaignID][_msgSender()] = 0;
        tokenRewardPool[rewardToken] -= amountToBeClaimed;

        ERC20(rewardToken).safeTransfer(_msgSender(), amountToBeClaimed);

        // Stats
        totalRewardsClaimed[rewardToken] += amountToBeClaimed;

        emit Claim(_msgSender(), campaignID, amountToBeClaimed);
    }  
}
