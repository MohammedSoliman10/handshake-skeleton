// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Handshake} from "../src/Handshake.sol";
import {IHandshake} from "../src/interfaces/IHandshake.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {ReentrantAttackerToken} from "./mocks/ReentrantAttackerToken.sol";

contract HandshakeTest is Test {
    Handshake internal handshake;
    MockUSDC internal usdc;

    address internal alice = makeAddr("alice"); // creator
    address internal bob = makeAddr("bob"); // counterparty
    address internal carol = makeAddr("carol"); // reviewer
    address internal mallory = makeAddr("mallory"); // unauthorized third party

    uint256 internal constant AMOUNT = 100e6; // 100 USDC
    uint256 internal constant COLLATERAL = 20e6; // 20 USDC each

    function setUp() public {
        usdc = new MockUSDC();
        handshake = new Handshake(address(usdc));

        usdc.mint(alice, 1_000e6);
        usdc.mint(bob, 1_000e6);

        vm.prank(alice);
        usdc.approve(address(handshake), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(handshake), type(uint256).max);
    }

    // ---------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------

    function _createDeal(address reviewer) internal returns (uint256 dealId) {
        vm.prank(alice);
        dealId = handshake.createDeal(bob, AMOUNT, COLLATERAL, block.timestamp + 7 days, reviewer);
    }

    function _createFundedAndActiveDeal(address reviewer) internal returns (uint256 dealId) {
        dealId = _createDeal(reviewer);
        vm.prank(alice);
        handshake.fundDeal(dealId);
        vm.prank(bob);
        handshake.acceptDeal(dealId);
    }

    // ---------------------------------------------------------------------
    // 1. happy path
    // ---------------------------------------------------------------------

    function test_HappyPath_FullLifecyclePaysOutCorrectly() public {
        uint256 dealId = _createFundedAndActiveDeal(carol);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);
        assertEq(usdc.balanceOf(address(handshake)), AMOUNT + 2 * COLLATERAL);

        vm.prank(bob);
        handshake.requestCompletion(dealId);

        vm.prank(alice);
        handshake.confirmCompletion(dealId);

        IHandshake.Deal memory deal = handshake.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(IHandshake.DealState.COMPLETED));
        assertGt(deal.completedAt, 0);

        // bob gets amount + his own collateral back; alice gets her collateral back
        assertEq(usdc.balanceOf(bob), bobBefore + AMOUNT + COLLATERAL);
        assertEq(usdc.balanceOf(alice), aliceBefore + COLLATERAL);
        assertEq(usdc.balanceOf(address(handshake)), 0);
    }

    // ---------------------------------------------------------------------
    // 2. unauthorized address cannot resolve a dispute
    // ---------------------------------------------------------------------

    function test_RevertWhen_UnauthorizedResolvesDispute() public {
        uint256 dealId = _createFundedAndActiveDeal(carol);

        vm.prank(alice);
        handshake.openDispute(dealId);

        vm.prank(mallory);
        vm.expectRevert(Handshake.NotReviewer.selector);
        handshake.resolveDispute(dealId, alice);

        // bob (a real party but not the reviewer) can't resolve it either
        vm.prank(bob);
        vm.expectRevert(Handshake.NotReviewer.selector);
        handshake.resolveDispute(dealId, bob);
    }

    // ---------------------------------------------------------------------
    // 3. terms are locked once ACTIVE — no edit function exists at all, so
    //    we prove it by showing accept/fund can't be re-run to "change" a deal
    // ---------------------------------------------------------------------

    function test_RevertWhen_ReacceptingOrRefundingAnActiveDeal() public {
        uint256 dealId = _createFundedAndActiveDeal(carol);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(Handshake.WrongState.selector, IHandshake.DealState.FUNDED, IHandshake.DealState.ACTIVE)
        );
        handshake.acceptDeal(dealId);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Handshake.WrongState.selector, IHandshake.DealState.CREATED, IHandshake.DealState.ACTIVE)
        );
        handshake.fundDeal(dealId);
    }

    // ---------------------------------------------------------------------
    // 4. double-claim: confirmCompletion cannot be called twice
    // ---------------------------------------------------------------------

    function test_RevertWhen_ConfirmCompletionCalledTwice() public {
        uint256 dealId = _createFundedAndActiveDeal(carol);

        vm.prank(bob);
        handshake.requestCompletion(dealId);
        vm.prank(alice);
        handshake.confirmCompletion(dealId);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Handshake.WrongState.selector, IHandshake.DealState.ACTIVE, IHandshake.DealState.COMPLETED)
        );
        handshake.confirmCompletion(dealId);
    }

    // ---------------------------------------------------------------------
    // 5. claimExpired before the deadline reverts
    // ---------------------------------------------------------------------

    function test_RevertWhen_ClaimExpiredBeforeDeadline() public {
        uint256 dealId = _createFundedAndActiveDeal(carol);

        vm.expectRevert(Handshake.DeadlineNotPassed.selector);
        handshake.claimExpired(dealId);
    }

    function test_ClaimExpired_ActiveDeal_RefundsBothParties() public {
        uint256 dealId = _createFundedAndActiveDeal(carol);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.warp(block.timestamp + 8 days); // past the 7-day deadline

        handshake.claimExpired(dealId); // callable by anyone, including mallory
        IHandshake.Deal memory deal = handshake.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(IHandshake.DealState.EXPIRED));

        assertEq(usdc.balanceOf(alice), aliceBefore + AMOUNT + COLLATERAL);
        assertEq(usdc.balanceOf(bob), bobBefore + COLLATERAL);
        assertEq(usdc.balanceOf(address(handshake)), 0);
    }

    // ---------------------------------------------------------------------
    // 6. wrong winner cannot receive funds in resolveDispute
    // ---------------------------------------------------------------------

    function test_RevertWhen_ResolveDisputeWinnerIsNotAParty() public {
        uint256 dealId = _createFundedAndActiveDeal(carol);

        vm.prank(bob);
        handshake.openDispute(dealId);

        vm.prank(carol);
        vm.expectRevert(Handshake.InvalidWinner.selector);
        handshake.resolveDispute(dealId, mallory);
    }

    function test_DisputeResolution_WinnerReceivesFullPot() public {
        uint256 dealId = _createFundedAndActiveDeal(carol);

        vm.prank(bob);
        handshake.openDispute(dealId);

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(carol);
        handshake.resolveDispute(dealId, alice); // client wins the dispute

        assertEq(usdc.balanceOf(alice), aliceBefore + AMOUNT + 2 * COLLATERAL);
        assertEq(usdc.balanceOf(address(handshake)), 0);

        IHandshake.Deal memory deal = handshake.getDeal(dealId);
        assertEq(uint8(deal.state), uint8(IHandshake.DealState.COMPLETED));
    }

    // ---------------------------------------------------------------------
    // 7. counterparty cannot accept without posting collateral (insufficient
    //    allowance surfaces as a revert from the token, propagated as
    //    TransferFailed only if transferFrom returns false; MockUSDC/most
    //    real ERC20s revert directly, which Foundry will also catch)
    // ---------------------------------------------------------------------

    function test_RevertWhen_AcceptWithoutApproval() public {
        uint256 dealId = _createDeal(carol);
        vm.prank(alice);
        handshake.fundDeal(dealId);

        vm.prank(bob);
        usdc.approve(address(handshake), 0); // revoke the setUp approval

        vm.prank(bob);
        vm.expectRevert(); // MockUSDC reverts with "insufficient allowance"
        handshake.acceptDeal(dealId);
    }

    // ---------------------------------------------------------------------
    // 8. reentrancy: a token with a transfer hook cannot re-enter a payout
    // ---------------------------------------------------------------------

    function test_RevertWhen_ReentrantTokenAttemptsNestedPayout() public {
        ReentrantAttackerToken evilToken = new ReentrantAttackerToken();
        Handshake evilHandshake = new Handshake(address(evilToken));

        evilToken.mint(alice, 1_000e6);
        evilToken.mint(bob, 1_000e6);
        vm.prank(alice);
        evilToken.approve(address(evilHandshake), type(uint256).max);
        vm.prank(bob);
        evilToken.approve(address(evilHandshake), type(uint256).max);

        vm.prank(alice);
        uint256 dealId = evilHandshake.createDeal(bob, AMOUNT, COLLATERAL, block.timestamp + 7 days, carol);
        vm.prank(alice);
        evilHandshake.fundDeal(dealId);
        vm.prank(bob);
        evilHandshake.acceptDeal(dealId);
        vm.prank(bob);
        evilHandshake.requestCompletion(dealId);

        evilToken.setTarget(evilHandshake, dealId);
        evilToken.arm(); // next transfer() call will try to re-enter confirmCompletion

        vm.prank(alice);
        vm.expectRevert(Handshake.Reentrant.selector);
        evilHandshake.confirmCompletion(dealId);
    }

    // ---------------------------------------------------------------------
    // 9. getDeal reflects live state after every transition — this is the
    //    property HandshakeResolver.sol's "not hardcoded" claim depends on.
    // ---------------------------------------------------------------------

    function test_GetDeal_ReflectsLiveStateAcrossTransitions() public {
        uint256 dealId = _createDeal(carol);
        assertEq(uint8(handshake.getDeal(dealId).state), uint8(IHandshake.DealState.CREATED));

        vm.prank(alice);
        handshake.fundDeal(dealId);
        assertEq(uint8(handshake.getDeal(dealId).state), uint8(IHandshake.DealState.FUNDED));

        vm.prank(bob);
        handshake.acceptDeal(dealId);
        assertEq(uint8(handshake.getDeal(dealId).state), uint8(IHandshake.DealState.ACTIVE));

        vm.prank(bob);
        handshake.requestCompletion(dealId);
        assertTrue(handshake.getDeal(dealId).completionRequested);

        vm.prank(alice);
        handshake.confirmCompletion(dealId);
        assertEq(uint8(handshake.getDeal(dealId).state), uint8(IHandshake.DealState.COMPLETED));
    }
}
