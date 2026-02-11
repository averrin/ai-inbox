# Specifications: Jules Artifact Notifications

Detailed requirements for the artifact notification system.

## Functional Requirements

### Requirement: Background Monitoring
- **GIVEN**: A Jules session has been started with a linked Pull Request.
- **WHEN**: The app is in the background or foreground.
- **THEN**: The system should periodically poll the GitHub Actions API for the latest run associated with that PR.

### Requirement: High-Priority Notification
- **GIVEN**: A GitHub workflow run for a Jules PR has finished with a `success` conclusion.
- **WHEN**: Correct artifacts exist and the user has not been notified yet for this specific run ID.
- **THEN**: Trigger a notification with sound and high importance.

### Requirement: Permission Management
- **GIVEN**: The user has not granted notification permissions.
- **WHEN**: The app starts or the user visits the Jules screen.
- **THEN**: Prompt the user to enable notifications specifically for Jules artifacts.

## Non-Functional Requirements
- **Efficiency**: Background polling should not exceed a 15-minute interval to preserve battery.
- **Reliability**: Use `AsyncStorage` or similar to track which run IDs have already been notified to avoid duplicate alerts.
- **Aesthetics**: The notification title and body should be clear and professional.
