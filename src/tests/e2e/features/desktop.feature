@desktop
Feature: Player windows communicate through the desktop bridge

  Scenario: The full player goes to the dock and returns with the same track
    Given the TuneLib library is open
    When I play the track "Midnight Ride"
    And I expand the player
    And I send the window to the tray
    Then the separate dock shows "Midnight Ride"
    When I restore the full player from the separate dock
    Then the full player shows "Midnight Ride"
    And the main window is shown and focused

  Scenario: The separate dock changes shape and opens a focused close confirmation
    Given the TuneLib library is open
    When I play the track "Midnight Ride"
    And I send the window to the tray
    Then the separate dock shows "Midnight Ride"
    When I expand and rotate the separate dock
    Then the separate dock is expanded and vertical
    When I close the separate dock
    Then the separate confirmation is shown and focused after one click
    When I cancel the separate confirmation
    Then the separate dock is interactive again
    When I close the separate dock
    Then the separate confirmation is shown and focused after one click
    When I close only the dock from the separate confirmation
    Then the application remains running without the separate dock

  Scenario: Playback emits no dock updates without a connected dock
    Given the TuneLib library is open
    When I play the track "Midnight Ride"
    Then playback advances without publishing dock updates

  Scenario: Repeated dock openings release their windows and subscriptions
    Given the TuneLib library is open
    When I play the track "Midnight Ride"
    Then ten dock round trips leave one window and no extra main subscriptions

  Scenario: The settings return button has the same compact shape as the help button
    Given the TuneLib library is open
    When I open the settings view
    Then the return button matches the help button
