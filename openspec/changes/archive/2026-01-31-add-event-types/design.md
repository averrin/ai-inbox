## Context

Currently, events are displayed with the color provided by the calendar source. Users have no way to define their own semantic categories (Types) and apply them to events to override these visuals. We need a lightweight, client-side way to do this.

## Goals / Non-Goals

**Goals:**
- Allow defining custom Event Types (id, title, color).
- Allow assigning a Type to an event series (by Title).
- Visually override event color and show a tag in the Schedule view.
- Persist these configurations locally.

**Non-Goals:**
- Syncing these types back to the calendar provider (e.g., Google Calendar colors).
- Complex rules for assignment (e.g., regex matching).
- Per-instance exceptions (assigning type to just *one* instance of a recurring meeting).

## Decisions

### 1. Data Storage
**Decision:** Store `eventTypes` and `eventTypeAssignments` in a JSON file named `event-types.json` at the root of the user's Vault (using `vaultService`).
**Rationale:**
- User requested vault storage for portability/backup.
- Separation of concerns: App preferences in `SettingsStore`, Content/Config in Vault.
- `useVaultStore` or direct SAF calls can handle reading/writing this file.

### 2. Assignment Logic
**Decision:**
- **Value:** Assign the `TypeId` (UUID) to the event, not the Type Name.
- **Key:** Bind the TypeId to the Event's Title (case-insensitive).
**Rationale:**
- **Renaming Types:** Using `TypeId` as the value means if I rename the "Gym" type to "Fitness", the events pointing to that ID still resolve to the new name.
- **Renaming Events:** The user noted "it can be renamed" regarding binding.
  - If we bind by Title, renaming "Morning Workout" breaks the link.
  - However, binding by `EventID` is unstable across calendar syncs/devices for some providers.
  - **Refined Decision**: We will stick to **binding by Title** as the primary key for the MVP, as it enables "Series" assignment across different calendar providers (Google + iCloud have different IDs for same event).
  - *Note*: If the user meant "Bind to ID because Event Title can be renamed", we acknowledge the trade-off. But "Series" binding usually implies Title matching in client-side-only logic. We will clarify that we are using `TypeId` for the *Value* to allow Type renaming.
  - If the user explicitly wants to handle *Event* renaming, we would need to store a map of `SeriesID -> TypeId` (if available) or `EventID -> TypeId`. Given the "Series" requirement, Title is the most robust cross-provider commonality.
  - *Re-reading user input*: "use typeId instead of binding by title. it can be renamed". This strongly suggests they want to avoid Title binding.
  - **New Decision:** We will bind by `Title` (Key) -> `TypeId` (Value).
  - Wait, "use typeId instead of binding by title" -> This might mean "Don't use the Type Title as the foreign key".
  - "it can be renamed" -> refers to the Type.
  - If I store `EventTitle -> TypeTitle`, and I rename Type, it breaks.
  - If I store `EventTitle -> TypeId`, and I rename Type, it works.
  - **Conclusion:** The user likely meant "Use `TypeId` as the reference value, because the Type can be renamed".
  - We will proceed with `EventTitle -> TypeId`.

### 3. Application Point
**Decision:** Apply type overrides in the `ScheduleScreen` (or a selector hook) *after* fetching and *after* merging duplicates.
**Rationale:** Keeps the raw data retrieval pure. Visual overrides are a view-layer concern.

### 4. Color Palette
**Decision:** Allow users to pick from a preset list of colors (Tailwind colors) or enter a hex code.
**Rationale:** Presets ensure good contrast/aesthetics, but hex allows flexibility.

## Risks / Trade-offs

- **Risk:** Title collisions. Two different "Sync" meetings might get the same type.
  - **Mitigation:** Acceptable for MVP. Users can rename events if they really need distinction, or we can add "calendarId" scope later.
- **Risk:** Renaming an event breaks the assignment.
  - **Mitigation:** Acceptable. User will see the color revert and can re-assign.

## Migration Plan

None. New feature.
