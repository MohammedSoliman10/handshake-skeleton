// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Handshake} from "../../src/Handshake.sol";

/// @notice Simulates a token with a transfer hook (e.g. ERC777-style) that
/// tries to re-enter confirmCompletion mid-payout. Standard USDC has no such
/// hook, but this proves the guard holds even against a token that does.
contract ReentrantAttackerToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    Handshake public target;
    uint256 public dealIdToReenter;
    bool public armed;

    function setTarget(Handshake _target, uint256 _dealId) external {
        target = _target;
        dealIdToReenter = _dealId;
    }

    function arm() external {
        armed = true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        if (armed) {
            armed = false; // only attempt once, avoid infinite loop in the test
            // Attempt to re-enter: this must revert with Handshake's
            // Reentrant() error if the guard is working.
            target.confirmCompletion(dealIdToReenter);
        }

        return true;
    }
}
