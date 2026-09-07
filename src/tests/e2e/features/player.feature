@shell
Feature: Playing a track, from the library to the floating dock

  Scenario: The player opens on the track and grows to the full view
    Given the TuneLib library is open
    When I play the track "Midnight Ride"
    Then the player bar shows "Midnight Ride"
    When I expand the player
    Then the full player shows "Midnight Ride"
    When I collapse the player
    Then the player bar shows "Midnight Ride"
    And the full player is gone

  Scenario: Closing the full player leaves the library on screen
    Given the TuneLib library is open
    When I play the track "Midnight Ride"
    And I expand the player
    And I close the full player
    Then no player is on screen
    And the library view is visible

  Scenario: Sending the window away hands the track to the floating dock
    Given the TuneLib library is open
    When I play the track "Midnight Ride"
    And I send the window to the tray
    Then the shell is asked to open the floating dock as horizontal

  Scenario: The dock draws what the main window is playing
    Given the floating dock is open
    Then the dock asks the main window for what is playing
    And the dock shows "Midnight Ride"

  Scenario: The dock grows to its second level
    Given the floating dock is open
    When I expand the dock
    Then the dock is expanded
    And the shell is asked to reshape the dock as expanded

  Scenario: The dock turns on its side
    Given the floating dock is open
    When I turn the dock vertical
    Then the dock is vertical
    And the shell is asked to reshape the dock as vertical

  Scenario: Closing the dock asks what closing means
    Given the floating dock is open
    When I close the dock
    Then the closing question is on screen
    When I keep the dock open
    Then the closing question is gone

  Scenario: Closing only the dock leaves the app running
    Given the floating dock is open
    When I close the dock
    And I answer that only the dock closes
    Then the shell is asked to close the floating dock
    And the main window is never asked to quit

  Scenario: The question stands in a window of its own
    Given the floating dock is open
    And the shell can open the closing question in its own window
    When I close the dock
    Then the dock stands behind the question
