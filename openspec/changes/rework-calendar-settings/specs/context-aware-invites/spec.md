# Context Aware Invites

## Requirements

-   **Trigger**: When an event is created or updated with `isWork: true` OR `typeTag: "lunch"`.
-   **Action**: Automatically add the configured "Work Account" email to the attendees list.
-   **Constraint**: If no "Work Account" is configured, do not add any attendees.
-   **Constraint**: Do not duplicate the attendee if already present.
