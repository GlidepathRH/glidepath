// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface VmDeploy {
    function envUint(string calldata name) external view returns (uint256 value);
    function envAddress(string calldata name) external view returns (address value);
    function addr(uint256 privateKey) external pure returns (address signer);
    function getNonce(address account) external view returns (uint64 nonce);
    function computeCreateAddress(address deployer, uint256 nonce) external pure returns (address);
    function getCode(string calldata artifactPath) external returns (bytes memory creationCode);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract GlidepathCreate2Deployer {
    error Create2DeploymentFailed();
    error NotDeployer();

    address public immutable deployer;

    constructor(address deployer_) {
        deployer = deployer_;
    }

    function deploy(bytes calldata initCode, bytes32 salt) external returns (address deployed) {
        if (msg.sender != deployer) revert NotDeployer();
        bytes memory code = initCode;
        assembly ("memory-safe") {
            deployed := create2(0, add(code, 0x20), mload(code), salt)
        }
        if (deployed == address(0)) revert Create2DeploymentFailed();
    }

    function deployCreate(bytes calldata initCode) external returns (address deployed) {
        if (msg.sender != deployer) revert NotDeployer();
        bytes memory code = initCode;
        assembly ("memory-safe") {
            deployed := create(0, add(code, 0x20), mload(code))
        }
        if (deployed == address(0)) revert Create2DeploymentFailed();
    }
}

/// @notice Deploys a hook with mined permission bits, then its predicted CREATE-address factory.
contract DeployGlidepath {
    VmDeploy private constant vm = VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint160 private constant HOOK_PERMISSION_MASK = (1 << 14) - 1;
    uint160 private constant REQUIRED_HOOK_PERMISSIONS = 0x28cc;
    uint256 private constant MAX_SALT_SEARCH = 1 << 20;

    error WrongChain(uint256 chainId);
    error HookAddressSaltNotFound();
    error FactoryAddressPredictionFailed(address expected, address actual);

    function run() external returns (address hookAddress, address factoryAddress) {
        if (block.chainid != 4663) revert WrongChain(block.chainid);

        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        address poolManager = vm.envAddress("POOL_MANAGER_ADDRESS");
        address treasury = vm.envAddress("PLATFORM_TREASURY");
        uint256 launchFee = vm.envUint("LAUNCH_FEE_WEI");

        vm.startBroadcast(privateKey);
        GlidepathCreate2Deployer create2Deployer = new GlidepathCreate2Deployer(deployer);
        vm.stopBroadcast();

        uint64 helperNonce = vm.getNonce(address(create2Deployer));
        address predictedFactory = vm.computeCreateAddress(address(create2Deployer), uint256(helperNonce) + 1);
        bytes memory hookCreationCode = vm.getCode("src/GlidepathHook.sol:GlidepathHook");
        bytes memory hookInitCode = abi.encodePacked(
            hookCreationCode,
            abi.encode(poolManager, predictedFactory, treasury)
        );
        bytes32 initCodeHash = keccak256(hookInitCode);
        bytes32 salt;
        bool found;
        for (uint256 i; i < MAX_SALT_SEARCH; ++i) {
            bytes32 candidate = bytes32(i);
            address candidateAddress = address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(bytes1(0xff), address(create2Deployer), candidate, initCodeHash)
                        )
                    )
                )
            );
            if (uint160(candidateAddress) & HOOK_PERMISSION_MASK == REQUIRED_HOOK_PERMISSIONS) {
                salt = candidate;
                found = true;
                break;
            }
        }
        if (!found) revert HookAddressSaltNotFound();

        vm.startBroadcast(privateKey);
        hookAddress = create2Deployer.deploy(hookInitCode, salt);
        bytes memory factoryCreationCode = vm.getCode("src/GlidepathLaunchFactory.sol:GlidepathLaunchFactory");
        bytes memory factoryInitCode = abi.encodePacked(
            factoryCreationCode,
            abi.encode(poolManager, hookAddress, treasury, launchFee)
        );
        factoryAddress = create2Deployer.deployCreate(factoryInitCode);
        vm.stopBroadcast();

        if (factoryAddress != predictedFactory) {
            revert FactoryAddressPredictionFailed(predictedFactory, factoryAddress);
        }
    }
}
