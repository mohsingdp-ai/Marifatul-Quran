# Spec Delta

## Purpose

Checks that the Urdu meaning the app shows for each Quran word, and for each grammar piece inside
it, is right in its ayah: Jev screens everything, Claude judges and fixes in context and by root.

## ADDED Requirements

### Requirement: Review covers what the app shows

The review SHALL check every whole-word meaning and every piece meaning exactly as the app shows
them, including all hand fixes. Pieces the app shows with no meaning SHALL be skipped and counted.

#### Scenario: Piece meaning built from shared tables
- **WHEN** a piece's meaning comes from the label table, the stem table or a piece fix
- **THEN** the review checks that same text, not a raw source value

#### Scenario: Coverage count
- **WHEN** a full screen finishes
- **THEN** the report states words checked, pieces checked and pieces skipped, per para
- **AND** the totals match the words and pieces in the app's data

### Requirement: Jev screens every item in its ayah

Jev SHALL judge every word and piece meaning with the full ayah and its translations in view,
plus whether multi-piece words agree with their whole meaning. Jev SHALL NOT write meanings.

#### Scenario: Meaning wrong for this ayah
- **WHEN** a word's meaning is right in some ayat but wrong in this one
- **THEN** it is flagged for this ayah only

#### Scenario: Pieces and whole disagree
- **WHEN** the pieces read "ضرور" but the whole word lacks it
- **THEN** the word is flagged as a piece/whole mismatch

### Requirement: Screen results are graded in three bands

Each Jev judgment SHALL land in right, doubtful or wrong by two limits kept in one place with
the question wording.

#### Scenario: Above the upper limit
- **WHEN** Jev's probability that a meaning is right is above the upper limit
- **THEN** it is marked right

#### Scenario: Below the lower limit
- **WHEN** the probability is below the lower limit
- **THEN** it is marked wrong

#### Scenario: Between the limits
- **WHEN** the probability is between the limits
- **THEN** it is marked doubtful

### Requirement: Jev passes a calibration gate first

Before a full screen, Jev SHALL be tested on known old-wrong / new-right pairs. The full screen
SHALL NOT start if it misses the pass mark.

#### Scenario: Calibration fails
- **WHEN** the pass mark is missed on the held-out pairs
- **THEN** the review stops and reports how Jev did, with examples

### Requirement: Claude judges every flagged item

Every wrong and doubtful item, and a random sample of right items, SHALL get a Claude verdict:
wrong, right, or style only. A wrong verdict SHALL come with a fix.

#### Scenario: Jev false alarm
- **WHEN** Jev flags a meaning that fits the ayah
- **THEN** the verdict is right and nothing changes

#### Scenario: Style difference only
- **WHEN** the meaning is correct but worded differently from a translation
- **THEN** the verdict is style only and nothing changes

#### Scenario: Missed by Jev
- **WHEN** a sampled "right" item is judged wrong
- **THEN** it gets a fix and the report counts it as a Jev miss

### Requirement: Fixes follow context and root

A fix SHALL fit the ayah's meaning and the word's grammar, and SHALL agree with the core meaning
of the word's Arabic root. Each fix SHALL record the root meaning and a one-line reason.

#### Scenario: Fix recorded
- **WHEN** a reviewer writes a fix
- **THEN** the record holds the fix, the root, its core meaning, the reason, and the source used

#### Scenario: Word with no root
- **WHEN** the piece is a particle or pronoun with no root
- **THEN** the fix is judged by grammar and context only, and the root field says "none"

#### Scenario: Piece fix keeps the whole in step
- **WHEN** a piece meaning is fixed
- **THEN** the whole-word meaning is checked against it and fixed too if they disagree

### Requirement: Every fix is double-checked

A second, independent Claude checker SHALL re-check each fix. Only fixes both agree on SHALL be
confirmed; others SHALL go to the owner as doubtful with both opinions.

#### Scenario: Checker disagrees
- **WHEN** the checker rejects or changes a fix
- **THEN** the item is doubtful and the owner sees both versions

### Requirement: Pilot para before the rest

Claude SHALL run on one para first. The other paras SHALL NOT run until the owner has read the
pilot's fixes and said go.

#### Scenario: Pilot review
- **WHEN** the pilot para finishes
- **THEN** the owner sees all its fixes, verdict counts and the run's cost before deciding

### Requirement: Data changes only after owner go-ahead

The review SHALL NOT edit the app's meaning data on its own. Confirmed fixes SHALL be written to
the fix files only after the owner's go-ahead, minus any rows the owner strikes, followed by the
normal rebuild and checks.

#### Scenario: Run without go-ahead
- **WHEN** a run finishes
- **THEN** the app's meaning files and fix files are unchanged

#### Scenario: Apply after go-ahead
- **WHEN** the owner gives the go-ahead
- **THEN** confirmed, unstruck fixes are written and the meaning checks and tests pass after rebuild

### Requirement: Failed calls are errors, not answers

A failed Jev call or reviewer run SHALL be retried and, if it still fails, reported as not
checked. It SHALL NOT count as a verdict. A stopped run SHALL resume where it left off.

#### Scenario: Failure
- **WHEN** a call for an ayah fails after retries
- **THEN** that ayah is listed as not checked and the run continues

#### Scenario: Resume
- **WHEN** a stopped run is started again
- **THEN** items already judged are not sent again

### Requirement: Only public text leaves the machine

Jev requests SHALL hold only Quran text, public translations and meanings. The API key SHALL be
read from the environment and never written to the report. Hafiz Ahmad Yar text SHALL NOT be
committed.

#### Scenario: Saved request
- **WHEN** a request or context pack is saved
- **THEN** it holds no key, no personal data, and sits outside git if it holds Hafiz Ahmad Yar text
