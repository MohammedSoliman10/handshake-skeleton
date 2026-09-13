// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHandshake} from "./interfaces/IHandshake.sol";
import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";

/// @title Handshake
/// @notice A deal between two people becomes an on-chain object: both sides
///         stake collateral, funds lock until completion or dispute, and the
///         full lifecycle is queryable on-chain (this is what the ENS
///         wildcard resolver reads live — see HandshakeResolver.sol).
///
/// @dev Design choices, on purpose, for a hackathon MVP:
///      - Single contract, no factory/registry split (matches locked scope).
///      - No "edit deal" function exists at all. Once a Deal struct is
///        written, the only way its terms-relevant fields change is via the
///        defined state transitions below — this is what "terms locked
///        after acceptance" means in practice, no separate hash-check needed.
///      - State written BEFORE external token transfers in every function
///        (checks-effects-interactions) + a manual reentrancy guard, so a
///        malicious ERC20 callback can't re-enter and double-spend a payout.
contract Handshake is IHandshake {
    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    IERC20Minimal public immutable paymentToken; // e.g. USDC on Sepolia

    mapping(uint256 => Deal) private _deals;
    uint256 public nextDealId;

    uint256 private _locked = 1; // reentrancy guard: 1 = unlocked, 2 = locked

    // ---------------------------------------------------------------------
    // Events — these double as the data source for the frontend Deal
    // Passport timeline (no separate off-chain indexer needed for the MVP).
    // ---------------------------------------------------------------------

    event DealCreated(
        uint256 indexed dealId,
        address indexed creator,
        address indexed counterparty,
        uint256 amount,
        uint256 collateral,
        uint256 deadline,
        address reviewer
    );
    event DealFunded(uint256 indexed dealId, uint256 timestamp);
    event DealAccepted(uint256 indexed dealId, uint256 timestamp);
    event CompletionRequested(uint256 indexed dealId, uint256 timestamp);
    event DealCompleted(uint256 indexed dealId, uint256 timestamp);
    event DisputeOpened(uint256 indexed dealId, uint256 timestamp);
    event DisputeResolved(uint256 indexed dealId, address indexed winner, uint256 timestamp);
    event DealExpired(uint256 indexed dealId, uint256 timestamp);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotCreator();
    error NotCounterparty();
    error NotParty();
    error NotReviewer();
    error NoReviewerSet();
    error WrongState(DealState expected, DealState actual);
    error InvalidCounterparty();
    error InvalidAmount();
    error InvalidDeadline();
    error CompletionNotRequested();
    error DeadlineNotPassed();
    error DeadlineAlreadyPassed();
    error InvalidWinner();
    error TransferFailed();
    error Reentrant();

    modifier nonReentrant() {
        if (_locked == 2) revert Reentrant();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address _paymentToken) {
        paymentToken = IERC20Minimal(_paymentToken);
    }

    // ---------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------

    /// @notice Step 1: creator proposes a deal. No funds move yet.
    function createDeal(
        address counterparty,
        uint256 amount,
        uint256 collateral,
        uint256 deadline,
        address reviewer
    ) external returns (uint256 dealId) {
        if (counterparty == address(0) || counterparty == msg.sender) revert InvalidCounterparty();
        if (amount == 0) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        dealId = nextDealId++;

        _deals[dealId] = Deal({
            creator: msg.sender,
            counterparty: counterparty,
            amount: amount,
            collateral: collateral,
            deadline: deadline,
            reviewer: reviewer,
            completionRequested: false,
            state: DealState.CREATED,
            createdAt: block.timestamp,
            completedAt: 0
        });

        emit DealCreated(dealId, msg.sender, counterparty, amount, collateral, deadline, reviewer);
    }

    /// @notice Step 2: creator deposits amount + their own collateral.
    function fundDeal(uint256 dealId) external nonReentrant {
        Deal storage deal = _deals[dealId];
        if (msg.sender != deal.creator) revert NotCreator();
        _requireState(deal, DealState.CREATED);
        if (block.timestamp > deal.deadline) revert DeadlineAlreadyPassed();

        deal.state = DealState.FUNDED; // effects before interaction

        uint256 total = deal.amount + deal.collateral;
        _pull(msg.sender, total);

        emit DealFunded(dealId, block.timestamp);
    }

    /// @notice Step 3: counterparty accepts by posting their own collateral.
    function acceptDeal(uint256 dealId) external nonReentrant {
        Deal storage deal = _deals[dealId];
        if (msg.sender != deal.counterparty) revert NotCounterparty();
        _requireState(deal, DealState.FUNDED);
        if (block.timestamp > deal.deadline) revert DeadlineAlreadyPassed();

        deal.state = DealState.ACTIVE; // terms are now effectively locked —
        // there is no function anywhere in this contract that can edit
        // creator/counterparty/amount/collateral/deadline from this point on.

        _pull(msg.sender, deal.collateral);

        emit DealAccepted(dealId, block.timestamp);
    }

    /// @notice Counterparty signals the work is done. Does not move funds.
    function requestCompletion(uint256 dealId) external {
        Deal storage deal = _deals[dealId];
        if (msg.sender != deal.counterparty) revert NotCounterparty();
        _requireState(deal, DealState.ACTIVE);

        deal.completionRequested = true;
        emit CompletionRequested(dealId, block.timestamp);
    }

    /// @notice Creator confirms the work is done. Pays out immediately.
    function confirmCompletion(uint256 dealId) external nonReentrant {
        Deal storage deal = _deals[dealId];
        if (msg.sender != deal.creator) revert NotCreator();
        _requireState(deal, DealState.ACTIVE);
        if (!deal.completionRequested) revert CompletionNotRequested();

        deal.state = DealState.COMPLETED;
        deal.completedAt = block.timestamp;

        address counterparty = deal.counterparty;
        uint256 counterpartyPayout = deal.amount + deal.collateral;
        uint256 creatorRefund = deal.collateral;

        _push(counterparty, counterpartyPayout);
        _push(deal.creator, creatorRefund);

        emit DealCompleted(dealId, block.timestamp);
    }

    /// @notice Either party can escalate to the trusted reviewer while ACTIVE.
    function openDispute(uint256 dealId) external {
        Deal storage deal = _deals[dealId];
        if (msg.sender != deal.creator && msg.sender != deal.counterparty) revert NotParty();
        _requireState(deal, DealState.ACTIVE);
        if (deal.reviewer == address(0)) revert NoReviewerSet();

        deal.state = DealState.DISPUTED;
        emit DisputeOpened(dealId, block.timestamp);
    }

    /// @notice Reviewer answers one question only: who gets the full pot?
    ///         The reviewer never touches funds directly — this function does.
    function resolveDispute(uint256 dealId, address winner) external nonReentrant {
        Deal storage deal = _deals[dealId];
        if (msg.sender != deal.reviewer) revert NotReviewer();
        _requireState(deal, DealState.DISPUTED);
        if (winner != deal.creator && winner != deal.counterparty) revert InvalidWinner();

        deal.state = DealState.COMPLETED;
        deal.completedAt = block.timestamp;

        // Full pot (amount + both collaterals) goes to the winner. Simple,
        // deterministic, easy to test — intentionally not a partial-refund
        // model for the MVP.
        uint256 pot = deal.amount + (deal.collateral * 2);
        _push(winner, pot);

        emit DisputeResolved(dealId, winner, block.timestamp);
    }

    /// @notice Anyone can trigger cleanup once the deadline has passed
    ///         without completion. Refunds go back to whoever funded them.
    function claimExpired(uint256 dealId) external nonReentrant {
        Deal storage deal = _deals[dealId];
        if (block.timestamp <= deal.deadline) revert DeadlineNotPassed();

        if (deal.state == DealState.CREATED) {
            // no funds were ever deposited
            deal.state = DealState.EXPIRED;
        } else if (deal.state == DealState.FUNDED) {
            deal.state = DealState.EXPIRED;
            _push(deal.creator, deal.amount + deal.collateral);
        } else if (deal.state == DealState.ACTIVE) {
            deal.state = DealState.EXPIRED;
            _push(deal.creator, deal.amount + deal.collateral);
            _push(deal.counterparty, deal.collateral);
        } else {
            revert WrongState(DealState.ACTIVE, deal.state);
        }

        deal.completedAt = block.timestamp;
        emit DealExpired(dealId, block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Views — getDeal is the function HandshakeResolver.sol calls live.
    // ---------------------------------------------------------------------

    function getDeal(uint256 dealId) external view returns (Deal memory) {
        return _deals[dealId];
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    function _requireState(Deal storage deal, DealState expected) private view {
        if (deal.state != expected) revert WrongState(expected, deal.state);
    }

    function _pull(address from, uint256 amount) private {
        bool ok = paymentToken.transferFrom(from, address(this), amount);
        if (!ok) revert TransferFailed();
    }

    function _push(address to, uint256 amount) private {
        if (amount == 0) return;
        bool ok = paymentToken.transfer(to, amount);
        if (!ok) revert TransferFailed();
    }
}
