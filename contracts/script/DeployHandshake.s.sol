// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Handshake} from "../src/Handshake.sol";

/// @dev Run with:
///   forge script script/DeployHandshake.s.sol:DeployHandshake \
///     --rpc-url sepolia --broadcast --verify -vvvv
contract DeployHandshake is Script {
    function run() external returns (Handshake handshake) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        handshake = new Handshake(usdc);
        vm.stopBroadcast();

        console.log("Handshake deployed at:", address(handshake));
        console.log("Using USDC at:", usdc);
    }
}
