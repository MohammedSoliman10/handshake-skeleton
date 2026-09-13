// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

/// @notice Minimal ENS registry interface. Deliberately not importing
///         ENS's official "ens-contracts" package here: ENSv2 is in active beta on
///         Sepolia and its Permissioned Registry package is still moving
///         (see docs.ens.domains/ensv2). `setResolver(node, resolver)` is
///         the one part of the ENS interface that the docs explicitly say
///         is stable across versions ("the resolver interface remains the
///         same"), so that's the only call this script depends on.
interface IENSRegistry {
    function setResolver(bytes32 node, address resolver) external;
    function owner(bytes32 node) external view returns (address);
}

/// @dev MANUAL STEPS REQUIRED BEFORE running this script — these cannot be
///      safely scripted because they involve real ETH/stablecoin spend and
///      a UI-driven commit-reveal flow:
///
///      1. Register `handshake.eth` (or your chosen parent name) on Sepolia
///         via the ENS App (https://app.ens.domains, switch to Sepolia).
///         As of ENSv2, registration is paid in an approved stablecoin
///         (Sepolia USDC or test DAI), not ETH — the UI handles the
///         approval step for you.
///      2. Confirm the registration succeeded and note the exact registry
///         address ENSv2 is using on Sepolia — check the canonical
///         "Deployments" page at docs.ens.domains/learn/deployments before
///         running this, since ENSv2 addresses are still being finalized.
///      3. Set REGISTRY_ADDRESS, PARENT_NAME ("handshake.eth"), and
///         RESOLVER_ADDRESS (the address DeployResolver.s.sol printed) in
///         your .env.
///
///      What this script then does — the one safe, idempotent part to
///      automate: point handshake.eth's resolver at HandshakeResolver.
///      Because HandshakeResolver implements ENSIP-10 wildcard resolution,
///      this single call is sufficient for every `<dealId>.handshake.eth`
///      subname to resolve through it — no per-deal ENS transaction needed.
///
///   forge script script/SetupENS.s.sol:SetupENS --rpc-url sepolia --broadcast -vvvv
contract SetupENS is Script {
    function run() external {
        address registryAddress = vm.envAddress("REGISTRY_ADDRESS");
        address resolverAddress = vm.envAddress("RESOLVER_ADDRESS");
        string memory parentName = vm.envOr("PARENT_NAME", string("handshake.eth"));
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        bytes32 node = _namehash(parentName);
        IENSRegistry registry = IENSRegistry(registryAddress);

        address currentOwner = registry.owner(node);
        console.log("Parent name:", parentName);
        console.log("Namehash owner on registry:", currentOwner);
        console.log("Will set resolver to:", resolverAddress);

        vm.startBroadcast(deployerKey);
        registry.setResolver(node, resolverAddress);
        vm.stopBroadcast();

        console.log("Done. *.%s now resolves through HandshakeResolver.", parentName);
    }

    /// @dev Standard ENS namehash algorithm, split on ".". Two passes over
    ///      the name: first record each label's [start,end) range, then
    ///      fold the hash root-to-leaf (rightmost label first).
    function _namehash(string memory name) internal pure returns (bytes32 node) {
        bytes memory nameBytes = bytes(name);
        if (nameBytes.length == 0) return bytes32(0);

        uint256 labelCount = 1;
        for (uint256 i = 0; i < nameBytes.length; i++) {
            if (nameBytes[i] == ".") labelCount++;
        }

        uint256[] memory labelStarts = new uint256[](labelCount);
        uint256[] memory labelEnds = new uint256[](labelCount);
        uint256 n = 0;
        uint256 start = 0;
        for (uint256 i = 0; i < nameBytes.length; i++) {
            if (nameBytes[i] == ".") {
                labelStarts[n] = start;
                labelEnds[n] = i;
                n++;
                start = i + 1;
            }
        }
        labelStarts[n] = start;
        labelEnds[n] = nameBytes.length;
        n++;

        node = bytes32(0);
        for (uint256 i = n; i > 0; i--) {
            bytes memory label = new bytes(labelEnds[i - 1] - labelStarts[i - 1]);
            for (uint256 j = 0; j < label.length; j++) {
                label[j] = nameBytes[labelStarts[i - 1] + j];
            }
            node = keccak256(abi.encodePacked(node, keccak256(label)));
        }
    }
}
