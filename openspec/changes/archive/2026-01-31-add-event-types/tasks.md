## 1. Store Updates & Vault Integration

- [x] 1.1 Create `services/eventTypeService.ts` to handle reading/writing `event-types.json` in the Vault (using `vaultService`).
- [x] 1.2 Implement caching/state in `useSettingsStore` (or a new `useEventTypesStore`) to hold the loaded configuration in memory to avoid constant file I/O.
- [x] 1.3 Implement actions: `addType`, `updateType`, `deleteType`, `assignTypeToTitle`, `unassignType`.
- [x] 1.4 Ensure `TypeId` (UUID) is generated for new types and used for assignments.

## 2. Event Type Management UI

- [x] 2.1 Create `components/EventTypeSettings.tsx`: A view to list, add, edit, and delete event types.
- [x] 2.2 Add entry point to `EventTypeSettings` from the existing Schedule Settings modal.

## 3. Assignment UI

- [x] 3.1 Create `components/EventContextModal.tsx`: A modal invoked on event press/long-press to assign a type.
- [x] 3.2 Implement logic to list available types and handle selection.

## 4. Visual Integration

- [x] 4.1 Update `ScheduleScreen.tsx` (fetchEvents/rendering) to apply color overrides based on `eventTypeAssignments`.
- [x] 4.2 Update `BigCalendar` event rendering (or custom cell style) to display the Type Tag in the top-right corner.
