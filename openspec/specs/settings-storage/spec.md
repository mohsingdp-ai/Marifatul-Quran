# settings-storage Specification

## Purpose
How the app keeps the reader's settings and hifz progress in browser storage, and how it behaves
when that storage is blocked or full.

## Requirements

### Requirement: App opens when storage is blocked

The app SHALL load and be usable when the browser refuses access to storage. Every setting SHALL
fall back to its default value.

#### Scenario: Storage access throws on load
- **WHEN** the reader opens the app and every storage access throws an error
- **THEN** the page renders with the default theme, script, language and playback settings
- **AND** no uncaught storage error appears in the console

#### Scenario: First-paint setup on the home page
- **WHEN** the home page's first-paint setup runs and storage access throws
- **THEN** the page still paints with the dark theme and hifz on
- **AND** the rest of the page loads

### Requirement: Settings changes last the visit when they cannot be saved

When saving a setting fails, the app SHALL keep running and SHALL NOT show an error for ordinary
settings. The setting MAY reset on the next visit.

#### Scenario: Changing a setting with storage blocked
- **WHEN** storage is blocked and the reader changes a setting (theme, speed, repeat, toggles)
- **THEN** the change does not raise an error
- **AND** the app keeps working

### Requirement: Hifz import tells the truth about saving

Hifz progress is the reader's own data. When an imported hifz file cannot be saved, the app SHALL
say it was not saved, and SHALL NOT report it as imported.

#### Scenario: Import with storage blocked or full
- **WHEN** the reader imports a valid hifz file and saving it fails
- **THEN** the app shows a "could not save" message in the reader's language
- **AND** it does not show the "imported N" message

#### Scenario: Import with storage working
- **WHEN** the reader imports a valid hifz file and saving succeeds
- **THEN** the app shows the "imported N" message as before

### Requirement: No change when storage works

With storage available, every setting and hifz record SHALL be read and saved exactly as before,
under the same keys and in the same format.

#### Scenario: Existing reader upgrades
- **WHEN** a reader with saved settings and hifz progress opens the updated app
- **THEN** all their settings and progress are still there
