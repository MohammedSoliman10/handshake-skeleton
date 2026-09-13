// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Handshake} from "../src/Handshake.sol";
import {HandshakeResolver} from "../src/HandshakeResolver.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @notice Proves the resolver's answers track live contract state — i.e.
///         the exact "not hardcoded" property the ENS bounty requires.
contract HandshakeResolverTest is Test {
    Handshake handshake;
    HandshakeResolver resolver;
    MockUSDC usdc;

    address creator = makeAddr("creator");
    address counterparty = makeAddr("counterparty");
    address reviewer = makeAddr("reviewer");

    uint256 dealId;

    function setUp() public {
        usdc = new MockUSDC();
        handshake = new Handshake(address(usdc));
        resolver = new HandshakeResolver(address(handshake));

        usdc.mint(creator, 1_000e6);
        usdc.mint(counterparty, 1_000e6);

        vm.prank(creator);
        dealId = handshake.createDeal(counterparty, 100e6, 20e6, block.timestamp + 7 days, reviewer);

        vm.prank(creator);
        usdc.approve(address(handshake), type(uint256).max);
        vm.prank(creator);
        handshake.fundDeal(dealId);
    }

    /// @dev Builds the DNS-wire encoding of "<dealId>.handshake.eth" the
    ///      same way an ENS universal resolver would before calling us.
    function _dnsEncode(uint256 id) internal pure returns (bytes memory) {
        bytes memory label = bytes(vm.toString(id));
        return abi.encodePacked(
            bytes1(uint8(label.length)), label, bytes1(uint8(9)), "handshake", bytes1(uint8(3)), "eth", bytes1(uint8(0))
        );
    }

    function test_SupportsInterface() public view {
        assertTrue(resolver.supportsInterface(0x9061b923)); // IExtendedResolver
        assertTrue(resolver.supportsInterface(0x01ffc9a7)); // IERC165
        assertFalse(resolver.supportsInterface(0xdeadbeef));
    }

    function test_TextRecord_ReflectsLiveState_Funded() public view {
        bytes memory name = _dnsEncode(dealId);
        bytes memory data = abi.encodeWithSelector(0x59d1d43c, bytes32(0), "status");

        bytes memory result = resolver.resolve(name, data);
        assertEq(string(result), "funded");
    }

    /// @dev The key assertion: resolve the SAME name twice, with a real
    ///      state transition in between, and prove the second answer
    ///      changes. A hardcoded/cached resolver would return "funded"
    ///      both times.
    function test_TextRecord_ChangesAfterStateTransition() public {
        bytes memory name = _dnsEncode(dealId);
        bytes memory statusQuery = abi.encodeWithSelector(0x59d1d43c, bytes32(0), "status");

        assertEq(string(resolver.resolve(name, statusQuery)), "funded");

        vm.prank(counterparty);
        usdc.approve(address(handshake), type(uint256).max);
        vm.prank(counterparty);
        handshake.acceptDeal(dealId);

        assertEq(string(resolver.resolve(name, statusQuery)), "active");
    }

    function test_TextRecord_Creator() public view {
        bytes memory name = _dnsEncode(dealId);
        bytes memory data = abi.encodeWithSelector(0x59d1d43c, bytes32(0), "creator");
        bytes memory result = resolver.resolve(name, data);
        assertEq(string(result), _toLowerHex(creator));
    }

    function test_Addr_ReturnsHandshakeContract() public view {
        bytes memory name = _dnsEncode(dealId);
        bytes memory data = abi.encodeWithSelector(0x3b3b57de, bytes32(0));
        bytes memory result = resolver.resolve(name, data);
        assertEq(abi.decode(result, (address)), address(handshake));
    }

    function test_RevertsOnUnknownDeal() public {
        bytes memory name = _dnsEncode(999);
        bytes memory data = abi.encodeWithSelector(0x59d1d43c, bytes32(0), "status");
        vm.expectRevert(HandshakeResolver.DealNotFound.selector);
        resolver.resolve(name, data);
    }

    function test_RevertsOnUnsupportedSelector() public {
        bytes memory name = _dnsEncode(dealId);
        bytes memory data = abi.encodeWithSelector(bytes4(0xdeadbeef));
        vm.expectRevert(abi.encodeWithSelector(HandshakeResolver.UnsupportedResolverProfile.selector, bytes4(0xdeadbeef)));
        resolver.resolve(name, data);
    }

    function _toLowerHex(address addr) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result = new bytes(42);
        result[0] = "0";
        result[1] = "x";
        uint160 value = uint160(addr);
        for (uint256 i = 0; i < 20; i++) {
            result[2 + i * 2] = hexChars[uint8(value >> (8 * (19 - i) + 4)) & 0xf];
            result[3 + i * 2] = hexChars[uint8(value >> (8 * (19 - i))) & 0xf];
        }
        return string(result);
    }
}
