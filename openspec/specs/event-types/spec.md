## ADDED Requirements

### Requirement: Manage Event Types
The system SHALL allow creating, updating, and deleting custom Event Types. Each type consists of a unique ID (UUID), a Title, and a Color. Configuration is persisted to `event-types.json` in the user's Vault.

#### Scenario: Create new event type
- **WHEN** user creates a new event type "Focus" with color "Blue"
- **THEN** a new type entry is created with a generated UUID
- **AND** the configuration is saved to `event-types.json` in the Vault

#### Scenario: Edit existing event type
- **WHEN** user renames "Focus" to "Deep Work"
- **THEN** the Type Title is updated
- **AND** the Type ID remains unchanged
- **AND** events assigned to this Type ID automatically reflect the new name (if displayed) or color

#### Scenario: Delete event type
- **WHEN** user deletes the "Focus" type
- **THEN** the type is removed from storage
- **AND** any events assigned to this type revert to their original calendar color
