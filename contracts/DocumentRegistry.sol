// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CourtAgent DocumentRegistry
/// @notice Stores only the keccak256 hash of a document, who must sign it, and who has signed.
///         The document text itself never goes on-chain. Anyone can later hash a copy of the
///         document and check it against this registry to prove it has not been changed.
/// @dev    Hackathon vertical slice. Not audited. Not legal advice.
contract DocumentRegistry {
    uint256 public constant MAX_PARTIES = 8;
    uint256 public constant MAX_KIND_LENGTH = 64;

    struct Record {
        address creator;
        uint64 createdAt;
        uint64 fullySignedAt;
        uint8 signedCount;
        string kind;
        address[] parties;
        mapping(address => bool) hasSigned;
    }

    mapping(bytes32 => Record) private records;

    error EmptyHash();
    error InvalidKind();
    error InvalidParties();
    error AlreadyRegistered(bytes32 docHash);
    error NotRegistered(bytes32 docHash);
    error NotAParty(address caller);
    error AlreadySigned(address caller);

    event DocumentRegistered(bytes32 indexed docHash, address indexed creator, string kind, address[] parties);
    event DocumentSigned(bytes32 indexed docHash, address indexed signer, uint8 signedCount, uint8 requiredCount);
    event DocumentFullySigned(bytes32 indexed docHash, uint64 at);

    /// @notice Register a document hash and the parties who must sign it.
    /// @param docHash keccak256 of the final document text.
    /// @param kind Short label such as "TENANCY_AGREEMENT" or "PROPERTY_RECORD".
    /// @param parties Addresses that must each call sign(). Between 1 and MAX_PARTIES, no duplicates.
    function register(bytes32 docHash, string calldata kind, address[] calldata parties) external {
        if (docHash == bytes32(0)) revert EmptyHash();
        uint256 kindLength = bytes(kind).length;
        if (kindLength == 0 || kindLength > MAX_KIND_LENGTH) revert InvalidKind();
        uint256 count = parties.length;
        if (count == 0 || count > MAX_PARTIES) revert InvalidParties();

        Record storage record = records[docHash];
        if (record.createdAt != 0) revert AlreadyRegistered(docHash);

        for (uint256 i = 0; i < count; i++) {
            address party = parties[i];
            if (party == address(0)) revert InvalidParties();
            for (uint256 j = 0; j < i; j++) {
                if (parties[j] == party) revert InvalidParties();
            }
            record.parties.push(party);
        }

        record.creator = msg.sender;
        record.createdAt = uint64(block.timestamp);
        record.kind = kind;

        emit DocumentRegistered(docHash, msg.sender, kind, parties);
    }

    /// @notice A listed party confirms the registered document.
    function sign(bytes32 docHash) external {
        Record storage record = records[docHash];
        if (record.createdAt == 0) revert NotRegistered(docHash);
        if (!_isParty(record, msg.sender)) revert NotAParty(msg.sender);
        if (record.hasSigned[msg.sender]) revert AlreadySigned(msg.sender);

        record.hasSigned[msg.sender] = true;
        record.signedCount += 1;

        uint8 required = uint8(record.parties.length);
        emit DocumentSigned(docHash, msg.sender, record.signedCount, required);

        if (record.signedCount == required) {
            record.fullySignedAt = uint64(block.timestamp);
            emit DocumentFullySigned(docHash, record.fullySignedAt);
        }
    }

    /// @notice Read everything stored about a document hash. Reverts if it was never registered.
    function getRecord(bytes32 docHash)
        external
        view
        returns (
            address creator,
            uint64 createdAt,
            uint64 fullySignedAt,
            string memory kind,
            address[] memory parties,
            bool[] memory signed
        )
    {
        Record storage record = records[docHash];
        if (record.createdAt == 0) revert NotRegistered(docHash);

        uint256 count = record.parties.length;
        bool[] memory signedFlags = new bool[](count);
        for (uint256 i = 0; i < count; i++) {
            signedFlags[i] = record.hasSigned[record.parties[i]];
        }

        return (record.creator, record.createdAt, record.fullySignedAt, record.kind, record.parties, signedFlags);
    }

    /// @notice True if the hash is registered.
    function isRegistered(bytes32 docHash) external view returns (bool) {
        return records[docHash].createdAt != 0;
    }

    /// @notice True if every listed party has signed.
    function isFullySigned(bytes32 docHash) external view returns (bool) {
        return records[docHash].fullySignedAt != 0;
    }

    function _isParty(Record storage record, address account) private view returns (bool) {
        uint256 count = record.parties.length;
        for (uint256 i = 0; i < count; i++) {
            if (record.parties[i] == account) return true;
        }
        return false;
    }
}
