// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Crowd warehouse order registry
/// @notice On-chain enforcement layer for the fulfillment pipeline. The hub
///         records a readable trail on HCS; this contract is what makes the
///         trail trustworthy:
///
///          1. Phase ordering is enforced — an order cannot be packed before
///             it is picked, or shipped before it is delivered. Invalid
///             transitions revert instead of being silently logged.
///          2. Robot assignment is drawn from Hedera's PRNG system contract,
///             so the operator cannot choose which robot handles an order.
contract WarehouseRegistry {
    /// Hedera pseudorandom number generator system contract.
    address private constant PRNG_SYSTEM_CONTRACT = address(0x169);

    uint8 private constant FLEET_SIZE = 5;

    enum Phase {
        None,
        Received,
        Picking,
        Packing,
        Delivery,
        Shipped
    }

    enum RobotType {
        Picking,
        Packing,
        Delivery
    }

    struct Order {
        uint8 productId;
        Phase phase;
        // Robot assigned per type, indexed by RobotType.
        uint8[3] robots;
    }

    address public immutable operator;

    mapping(string => Order) private orders;

    event OrderReceived(string orderId, uint8 productId);
    event RobotSelected(string orderId, RobotType robotType, uint8 robotId);
    event OrderShipped(string orderId);

    error NotOperator();
    error OrderAlreadyExists(string orderId);
    error UnknownOrder(string orderId);
    error InvalidTransition(Phase current, Phase requested);
    error RandomnessUnavailable();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor() {
        operator = msg.sender;
    }

    /// @notice Register a paid order. Payment settles off-chain via x402
    ///         before this is called, so reaching Received implies paid.
    function receiveOrder(string calldata orderId, uint8 productId) external onlyOperator {
        if (orders[orderId].phase != Phase.None) revert OrderAlreadyExists(orderId);

        orders[orderId].productId = productId;
        orders[orderId].phase = Phase.Received;

        emit OrderReceived(orderId, productId);
    }

    /// @notice Advance the order into the next phase and assign a robot for it.
    ///         Reverts unless the requested phase directly follows the current
    ///         one, which is what makes the pipeline tamper-resistant.
    /// @return robotId The fleet member selected by on-chain randomness.
    function selectRobot(string calldata orderId, RobotType robotType)
        external
        onlyOperator
        returns (uint8 robotId)
    {
        Phase current = orders[orderId].phase;
        if (current == Phase.None) revert UnknownOrder(orderId);

        Phase requested = _phaseFor(robotType);
        if (uint8(requested) != uint8(current) + 1) revert InvalidTransition(current, requested);

        robotId = _randomRobot();

        orders[orderId].phase = requested;
        orders[orderId].robots[uint8(robotType)] = robotId;

        emit RobotSelected(orderId, robotType, robotId);
    }

    /// @notice Close out the order once delivery has run.
    function shipOrder(string calldata orderId) external onlyOperator {
        Phase current = orders[orderId].phase;
        if (current == Phase.None) revert UnknownOrder(orderId);
        if (current != Phase.Delivery) revert InvalidTransition(current, Phase.Shipped);

        orders[orderId].phase = Phase.Shipped;

        emit OrderShipped(orderId);
    }

    /// @notice Full order state — anyone can verify a fulfillment independently.
    function getOrder(string calldata orderId)
        external
        view
        returns (uint8 productId, uint8 phase, uint8 pickingRobot, uint8 packingRobot, uint8 deliveryRobot)
    {
        Order storage order = orders[orderId];
        return (
            order.productId,
            uint8(order.phase),
            order.robots[0],
            order.robots[1],
            order.robots[2]
        );
    }

    function _phaseFor(RobotType robotType) private pure returns (Phase) {
        if (robotType == RobotType.Picking) return Phase.Picking;
        if (robotType == RobotType.Packing) return Phase.Packing;
        return Phase.Delivery;
    }

    /// @dev Load balancing: the fleet member is drawn from network randomness,
    ///      not chosen by the caller.
    function _randomRobot() private returns (uint8) {
        (bool ok, bytes memory result) = PRNG_SYSTEM_CONTRACT.call(
            abi.encodeWithSignature("getPseudorandomSeed()")
        );
        if (!ok || result.length < 32) revert RandomnessUnavailable();

        bytes32 seed = abi.decode(result, (bytes32));
        return uint8(uint256(seed) % FLEET_SIZE);
    }
}
