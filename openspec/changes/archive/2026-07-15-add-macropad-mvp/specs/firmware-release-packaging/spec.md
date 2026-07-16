## ADDED Requirements

### Requirement: CI builds firmware for the target board
A CI workflow SHALL build the firmware for the ESP32-2432S028R target using the
documented PlatformIO build command, without requiring manual/local-only steps.

#### Scenario: CI build from a clean checkout
- **WHEN** the CI workflow runs against a clean checkout of the repository
- **THEN** it produces a firmware build for the ESP32-2432S028R target using only the documented build command

### Requirement: Build output is an app-only binary
The build SHALL produce a standalone application-partition `.bin` (not a merged
bootloader+partition-table+app image), matching the format bmorcelli Launcher expects
to install into a partition slot it allocates.

#### Scenario: Build artifact is app-only
- **WHEN** the CI build completes
- **THEN** the produced `.bin` contains only the application image, not a merged flash image

### Requirement: Release artifact is published for installation
On a tagged release, the CI workflow SHALL publish the built `.bin` as a downloadable
release artifact so a user can install it through bmorcelli Launcher's WebUI or SD
card flow.

#### Scenario: Tagging a release publishes a downloadable binary
- **WHEN** a version tag is pushed to the repository
- **THEN** CI publishes the corresponding `.bin` as a release artifact available for download

### Requirement: Published binary installs successfully via bmorcelli Launcher
A published release binary SHALL be verified to install and boot correctly when
installed through bmorcelli Launcher, not merely assumed compatible from
documentation.

#### Scenario: Manual install verification
- **WHEN** a published release `.bin` is installed on a physical ESP32-2432S028R through bmorcelli Launcher's WebUI
- **THEN** the firmware installs without error and boots into the macro pad UI
