// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FaucetToken
 * @dev ERC20 token with a faucet and owner-only minting capability.
 * No external libraries (like OpenZeppelin) were used.
 */
contract FaucetToken {
    // State variables
    string public name = "FaucetToken";
    string public symbol = "FCT";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10**uint256(decimals);
    
    address public owner;

    // ERC20 Mappings
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // Faucet State
    mapping(address => uint256) public lastClaim;
    uint256 public constant FAUCET_AMOUNT = 100 * 10**uint256(decimals);

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event FaucetClaimed(address indexed account, uint256 amount);

    /**
     * @dev Simple access control modifier.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Returns the balance of a specific address.
     */
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev ERC20 Transfer function.
     */
    function transfer(address to, uint256 amount) public returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(_balances[msg.sender] >= amount, "Insufficient balance");

        _balances[msg.sender] -= amount;
        _balances[to] += amount;

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    /**
     * @dev ERC20 Approve function.
     */
    function approve(address spender, uint256 amount) public returns (bool) {
        require(spender != address(0), "Approve to zero address");

        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @dev Returns the allowance for a spender.
     */
    function allowance(address _owner, address spender) public view returns (uint256) {
        return _allowances[_owner][spender];
    }

    /**
     * @dev ERC20 TransferFrom function.
     */
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(_balances[from] >= amount, "Insufficient balance");
        require(_allowances[from][msg.sender] >= amount, "Insufficient allowance");

        _allowances[from][msg.sender] -= amount;
        _balances[from] -= amount;
        _balances[to] += amount;

        emit Transfer(from, to, amount);
        return true;
    }

    /**
     * @dev Minting logic, restricted to owner.
     * Must not exceed MAX_SUPPLY.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(to != address(0), "Mint to zero address");
        require(totalSupply + amount <= MAX_SUPPLY, "Would exceed MAX_SUPPLY");

        totalSupply += amount;
        _balances[to] += amount;

        emit Transfer(address(0), to, amount);
    }

    /**
     * @dev Faucet function: Claim 100 tokens every 24 hours.
     */
    function requestToken() public {
        require(
            block.timestamp >= lastClaim[msg.sender] + 1 days,
            "Wait 24 hours"
        );
        require(totalSupply + FAUCET_AMOUNT <= MAX_SUPPLY, "Faucet empty: MAX_SUPPLY reached");

        lastClaim[msg.sender] = block.timestamp;
        totalSupply += FAUCET_AMOUNT;
        _balances[msg.sender] += FAUCET_AMOUNT;

        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
        emit Transfer(address(0), msg.sender, FAUCET_AMOUNT);
    }
}
