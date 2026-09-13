// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Shared types + read interface. HandshakeResolver depends ONLY on
/// this interface (not the implementation) so the "live read, never
/// hardcoded" property is easy to audit: the resolver cannot see or store
/// anything except what getDeal() returns at call time.
interface IHandshake {
    enum DealState {
        CREATED, // created, awaiting funding
        FUNDED, // creator has deposited amount + collateral
        ACTIVE, // counterparty has accepted + posted collateral
        DISPUTED, // either party raised a dispute during ACTIVE
        COMPLETED, // settled, funds paid out
        EXPIRED // deadline passed before completion, funds refunded

    }

    struct Deal {
        address creator;
        address counterparty;
        uint256 amount; // in paymentToken's smallest unit (USDC = 6 decimals)
        uint256 collateral; // per side, equal for both parties
        uint256 deadline; // unix timestamp
        address reviewer; // trusted dispute resolver; address(0) disables openDispute
        bool completionRequested; // set by counterparty inside ACTIVE, avoids an extra state
        DealState state;
        uint256 createdAt;
        uint256 completedAt; // 0 until COMPLETED or EXPIRED
    }

    function getDeal(uint256 dealId) external view returns (Deal memory);
    function nextDealId() external view returns (uint256);
}
