// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

contract QuestReward is Ownable, ReentrancyGuard {
    using SafeERC20 for ERC20;

    // Rewarder (address that is settable by admin)
    address public rewarder;

    struct CampaignInfo {
        // ERC20 Address for the Token Reward
        address tokenReward;
        // Amount of reward that is claimable
        uint256 rewardPool;
    }

    // Mapping of campaignID to the campaignInfo
    // campaignID here can be anything, example for Learn and Earn is QuizID
    mapping(string => CampaignInfo) public campaigns;

    // Mapping of campaignID => User Address => TotalRewards
    mapping(string => mapping(address => uint256)) public userRewards;
    // Mapping of campaignID => User Address => ClaimedRewards
    mapping(string => mapping(address => uint256)) public claimedRewards;

    // Statistics
    // Total rewards rewarded for each token
    mapping(address => uint256) public totalRewards;

    // Total rewards claimed for each token
    mapping(address => uint256) public totalRewardsClaimed;


    // EVENTS

    event SetRewarder(address indexed rewarder);
    event Reward(string indexed campaignID, address[] users, uint256[] amounts);
    event Fund(string indexed campaignID, address indexed user, uint256 amount);
    event Claim(address indexed user, string campaignID, uint256 amount);
    event Withdraw(address indexed token, uint256 amount);
    event CreateCampaign(string indexed campaignID);

    // CONSTRUCTOR

    constructor(
        address _admin
    ) {
        require(_admin != address(0), '0x0 admin');
        transferOwnership(_admin); 
    }

    // MODIFIERS
     modifier onlyRewarder() {
        require(_msgSender() == rewarder, 'caller not rewarder');
        _;
    }


    // FUNCTIONS

    // Function for owner to set an rewarder
    function setRewarder(address _rewarder) external onlyOwner {
        require(_rewarder != address(0), '0x0 address');

        rewarder = _rewarder;

        emit SetRewarder(_rewarder);
    }

    // Function for funding the tokens to the reward pool
    function fund(uint256 amount, string calldata campaignID) external {
        address tokenAddress = campaigns[campaignID].tokenReward;

        // transfer specified amount from funder to this contract
        ERC20(tokenAddress).safeTransferFrom(_msgSender(), address(this), amount);
        campaigns[campaignID].rewardPool += amount;

        emit Fund(campaignID, _msgSender(), amount);
    }

    // Function for withdrawing money from reward pool, in case we want to sunset this contract
    function withdraw(string calldata campaignID) external onlyOwner {
        address token = campaigns[campaignID].tokenReward;
        uint256 amount = campaigns[campaignID].rewardPool;

        campaigns[campaignID].rewardPool = 0;
        ERC20(token).safeTransfer(_msgSender(), amount);

        emit Withdraw(token, amount);
    }

     // Function to create the campaign/quiz, will be called by rewarder
    function createCampaign(address tokenAddress, string calldata campaignID) external onlyRewarder {
        // Need this check to prevent overwriting existing campaign
        require(campaigns[campaignID].tokenReward == address(0), 'campaign has been set');

        campaigns[campaignID] = CampaignInfo({
            tokenReward: tokenAddress,
            rewardPool: 0
        });
        emit CreateCampaign(campaignID);
    }  

    // Function to be called when we want to reward user after finishing a campaign
    function reward(uint256[] calldata amounts, address[] calldata users, string calldata campaignID) external onlyRewarder {
        require(amounts.length > 0 && users.length > 0 , 'amounts and users should be more than zero');
        require(amounts.length <= users.length , 'amounts is less than users');

        bool singleAmount = amounts.length == 1; 

        // reward each user with the amount
        for (uint256 i = 0; i < users.length; i++) {
            uint256 amount = singleAmount ? amounts[0] : amounts[i];
            userRewards[campaignID][users[i]] += amount;
            address token = campaigns[campaignID].tokenReward;

            // Stats
            totalRewards[token] += amount;
        }

        emit Reward(campaignID, users, amounts);
    }

    // Function to be called when our user wants to claim their reward
    function claim(string calldata campaignID) external nonReentrant {
        address rewardToken = campaigns[campaignID].tokenReward;
        uint256 amountToBeClaimed = userRewards[campaignID][_msgSender()];

        require(amountToBeClaimed <= campaigns[campaignID].rewardPool, 'reward pool is not enough');
        userRewards[campaignID][_msgSender()] = 0;
        claimedRewards[campaignID][_msgSender()] += amountToBeClaimed;

        campaigns[campaignID].rewardPool -= amountToBeClaimed;

        ERC20(rewardToken).safeTransfer(_msgSender(), amountToBeClaimed);

        // Stats
        totalRewardsClaimed[rewardToken] += amountToBeClaimed;

        emit Claim(_msgSender(), campaignID, amountToBeClaimed);
    }
}
