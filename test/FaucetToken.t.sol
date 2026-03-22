// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FaucetToken.sol";

contract FaucetTokenTest is Test {
    FaucetToken public token;
    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);

    function setUp() public {
        vm.prank(owner);
        token = new FaucetToken();
        // Warp to 1 day to allow the first claim to pass
        vm.warp(1 days);
    }

    function test_InitialState() public {
        assertEq(token.name(), "FaucetToken");
        assertEq(token.symbol(), "FCT");
        assertEq(token.decimals(), 18);
        assertEq(token.owner(), owner);
        assertEq(token.totalSupply(), 0);
        assertEq(token.MAX_SUPPLY(), 10_000_000 * 10**18);
    }

    function test_Mint() public {
        vm.prank(owner);
        token.mint(user1, 1000 * 10**18);
        assertEq(token.balanceOf(user1), 1000 * 10**18);
        assertEq(token.totalSupply(), 1000 * 10**18);
    }

    function test_MintOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert("Only the owner can call this function");
        token.mint(user1, 1000 * 10**18);
    }

    function test_MintExceedMaxSupply() public {
        vm.prank(owner);
        token.mint(user1, 10_000_000 * 10**18);
        
        vm.prank(owner);
        vm.expectRevert("Would exceed MAX_SUPPLY");
        token.mint(user1, 1);
    }

    function test_RequestToken() public {
        vm.prank(user1);
        token.requestToken();
        assertEq(token.balanceOf(user1), 100 * 10**18);
        assertEq(token.lastClaim(user1), block.timestamp);
    }

    function test_RequestTokenCooldown() public {
        vm.startPrank(user1);
        token.requestToken();
        
        vm.expectRevert("Wait 24 hours");
        token.requestToken();
        
        // Advance time by 24 hours
        vm.warp(block.timestamp + 24 hours);
        token.requestToken();
        assertEq(token.balanceOf(user1), 200 * 10**18);
        vm.stopPrank();
    }

    function test_Transfer() public {
        vm.prank(owner);
        token.mint(user1, 1000 * 10**18);
        
        vm.prank(user1);
        token.transfer(user2, 400 * 10**18);
        
        assertEq(token.balanceOf(user1), 600 * 10**18);
        assertEq(token.balanceOf(user2), 400 * 10**18);
    }

    function test_ApproveAndTransferFrom() public {
        vm.prank(owner);
        token.mint(user1, 1000 * 10**18);
        
        vm.prank(user1);
        token.approve(user2, 500 * 10**18);
        assertEq(token.allowance(user1, user2), 500 * 10**18);
        
        vm.prank(user2);
        token.transferFrom(user1, user2, 300 * 10**18);
        
        assertEq(token.balanceOf(user1), 700 * 10**18);
        assertEq(token.balanceOf(user2), 300 * 10**18);
        assertEq(token.allowance(user1, user2), 200 * 10**18);
    }
}
