# UX and Configuration Enhancements

## ADDED Requirements

### Requirement: Full Content Capture
The application MUST process and save the full content of the shared text or URL, rather than a summary.

#### Scenario: Saving a web article
Given a shared URL
When the AI processes the content
Then the resulting markdown body MUST contain the full extracted text of the article
And the markdown body MUST NOT be a summary.

### Requirement: Settings Access
The user MUST be able to access the configuration screen after the initial setup is complete.

#### Scenario: changing API key
Given the user is on the Processing Screen
When they tap the "Settings" button
Then the Setup Screen is displayed
And they can modify the API Key and Prompt.

### Requirement: Frontmatter Icon
The application MUST support the `icon` frontmatter field.

#### Scenario: Iconize support
Given a shared item
When the AI generates metadata
Then the frontmatter MAY include an `icon` field (emoji or string).

### Requirement: Folder Validation
The application MUST provide feedback on whether the target folder exists.

#### Scenario: Invalid Folder
Given the user types "NonExistent" in the Folder field
Then the UI displays an indicator (e.g. Red border or text) showing the folder is not found.

#### Scenario: Valid Folder
Given the user types "Inbox" (which exists)
Then the UI displays an indicator (e.g. Green check) showing the folder is valid.
