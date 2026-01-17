# UX Gaps Implementation

## ADDED Requirements

### Requirement: Reactive Folder Validation
The application MUST indicate folder validity without user manual confirmation.
#### Scenario: Typing a folder
Given the folder input
When the user types "Inb"
then "Inbox"
Then the validation indicator updates automatically to show "Found" once the name matches.

### Requirement: Folder Browsing
The application MUST allow selecting a subfolder from the vault.
#### Scenario: Picking a folder
Given `vaultUri` is set
When the user taps "Select Folder"
Then a list of immediate subdirectories is shown
And tapping one populates the Folder input.

### Requirement: Content Toggle
The application MUST allow the user to toggle between "Summary" and "Full Content".
#### Scenario: Processing a URL
Given a shared URL
Then the "Save Full Content" toggle defaults to TRUE.

#### Scenario: Processing Text
Given shared text
Then the "Save Full Content" toggle defaults to FALSE.

### Requirement: Navigation
The "Cancel" button MUST exit the app when in manual/direct mode.

### Requirement: Reliable Linking
The application MUST NOT attempt to open Obsidian until the file is confirmed to be written.
