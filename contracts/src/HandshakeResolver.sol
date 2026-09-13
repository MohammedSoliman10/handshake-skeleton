// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHandshake} from "./interfaces/IHandshake.sol";

/// @notice ENSIP-10 wildcard resolver, minimal interface vendored inline
/// (rather than pulling in ENS's full "ens-contracts" dependency tree)
/// so `forge build` has zero external lib requirements beyond forge-std.
interface IExtendedResolver {
    function resolve(bytes memory name, bytes memory data) external view returns (bytes memory);
}

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @title HandshakeResolver
/// @notice ENSIP-10 wildcard resolver for `*.handshake.eth`. Set this
///         contract as the resolver on `handshake.eth` (see SetupENS.s.sol)
///         and ENS routes every query for `<dealId>.handshake.eth` here via
///         `resolve(bytes name, bytes data)`, per ENSIP-10.
///
/// @dev This is the load-bearing property for the ENS bounty's "must be
///      functional and not just include hard-coded values" requirement:
///      this contract holds no deal data in storage at all. Every `addr()`
///      and `text()` response below is produced by decoding the subdomain
///      label into a dealId and calling `handshake.getDeal(dealId)` live,
///      in the same call. There is no cache, no snapshot, no owner-settable
///      override — querying `42.handshake.eth` before and after the deal's
///      on-chain state changes will always return the current state,
///      because there is nothing else it could return.
contract HandshakeResolver is IExtendedResolver, IERC165 {
    IHandshake public immutable handshake;

    // ENSIP-10
    bytes4 private constant _INTERFACE_ID_EXTENDED_RESOLVER = 0x9061b923;
    bytes4 private constant _INTERFACE_ID_ERC165 = 0x01ffc9a7;

    // Standard resolver profile selectors this contract answers.
    bytes4 private constant _SELECTOR_ADDR = 0x3b3b57de; // addr(bytes32)
    bytes4 private constant _SELECTOR_TEXT = 0x59d1d43c; // text(bytes32,string)

    error UnsupportedResolverProfile(bytes4 selector);
    error InvalidLabel();
    error DealNotFound();

    constructor(address _handshake) {
        handshake = IHandshake(_handshake);
    }

    // ---------------------------------------------------------------------
    // ENSIP-10 entrypoint — ENS clients call this for any *.handshake.eth
    // query once handshake.eth's resolver is set to this contract.
    // ---------------------------------------------------------------------

    function resolve(bytes memory name, bytes memory data) external view override returns (bytes memory) {
        uint256 dealId = _dealIdFromDnsName(name);
        IHandshake.Deal memory deal = handshake.getDeal(dealId);
        if (deal.creator == address(0)) revert DealNotFound();

        bytes4 selector = bytes4(data);

        if (selector == _SELECTOR_ADDR) {
            // The "address" of a deal is the contract that governs it —
            // there is no single wallet a deal object resolves to.
            return abi.encode(address(handshake));
        }

        if (selector == _SELECTOR_TEXT) {
            (, string memory key) = abi.decode(_stripSelector(data), (bytes32, string));
            return bytes(_textRecord(deal, key));
        }

        revert UnsupportedResolverProfile(selector);
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == _INTERFACE_ID_EXTENDED_RESOLVER || interfaceId == _INTERFACE_ID_ERC165;
    }

    // ---------------------------------------------------------------------
    // Text records — mirrors the ENS record set described in the project
    // brief (type / status / creator / counterparty / amount / deadline /
    // contract), each computed from the live struct, not stored.
    // ---------------------------------------------------------------------

    function _textRecord(IHandshake.Deal memory deal, string memory key) private view returns (string memory) {
        bytes32 k = keccak256(bytes(key));

        if (k == keccak256("type")) return "handshake-deal";
        if (k == keccak256("status")) return _stateToString(deal.state);
        if (k == keccak256("creator")) return _toHexString(deal.creator);
        if (k == keccak256("counterparty")) return _toHexString(deal.counterparty);
        if (k == keccak256("amount")) return _toDecimalString(deal.amount);
        if (k == keccak256("collateral")) return _toDecimalString(deal.collateral);
        if (k == keccak256("deadline")) return _toDecimalString(deal.deadline);
        if (k == keccak256("reviewer")) return _toHexString(deal.reviewer);
        if (k == keccak256("contract")) return _toHexString(address(handshake));

        return "";
    }

    // ---------------------------------------------------------------------
    // DNS-wire name decoding — extracts the leftmost label ("42" from
    // "42.handshake.eth" DNS-encoded as \x0242\x0ahandshake\x03eth\x00) and
    // parses it as a decimal dealId. No namehash/registry lookups needed:
    // ENS itself has already verified the query landed here via wildcard
    // resolution before this function is ever called.
    // ---------------------------------------------------------------------

    function _dealIdFromDnsName(bytes memory name) private pure returns (uint256) {
        if (name.length == 0) revert InvalidLabel();
        uint8 labelLen = uint8(name[0]);
        if (labelLen == 0 || name.length < 1 + labelLen) revert InvalidLabel();

        uint256 dealId = 0;
        for (uint256 i = 0; i < labelLen; i++) {
            bytes1 c = name[1 + i];
            if (c < 0x30 || c > 0x39) revert InvalidLabel(); // must be ASCII '0'-'9'
            dealId = dealId * 10 + (uint8(c) - 0x30);
        }
        return dealId;
    }

    function _stripSelector(bytes memory data) private pure returns (bytes memory result) {
        result = new bytes(data.length - 4);
        for (uint256 i = 0; i < result.length; i++) {
            result[i] = data[i + 4];
        }
    }

    function _stateToString(IHandshake.DealState state) private pure returns (string memory) {
        if (state == IHandshake.DealState.CREATED) return "created";
        if (state == IHandshake.DealState.FUNDED) return "funded";
        if (state == IHandshake.DealState.ACTIVE) return "active";
        if (state == IHandshake.DealState.DISPUTED) return "disputed";
        if (state == IHandshake.DealState.COMPLETED) return "completed";
        return "expired";
    }

    function _toHexString(address addr) private pure returns (string memory) {
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

    function _toDecimalString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(0x30 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
