// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HandshakeResolver} from "../src/HandshakeResolver.sol";

/// @dev Run AFTER DeployHandshake.s.sol. Requires HANDSHAKE_ADDRESS in .env
///      (the address printed by that script).
///
///   forge script script/DeployResolver.s.sol:DeployResolver \
///     --rpc-url sepolia --broadcast --verify -vvvv
contract DeployResolver is Script {
    function run() external returns (HandshakeResolver resolver) {
        address handshakeAddress = vm.envAddress("HANDSHAKE_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        resolver = new HandshakeResolver(handshakeAddress);
        vm.stopBroadcast();

        console.log("HandshakeResolver deployed at:", address(resolver));
        console.log("Pointing at Handshake:", handshakeAddress);
        console.log("Next: run SetupENS.s.sol with RESOLVER_ADDRESS set to this address");
    }
}
