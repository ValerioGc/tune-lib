Feature: Application navigation

  Scenario: Open the settings from the library
    Given the TuneLib library is open
    When I open the settings view
    Then the settings page is visible

  Scenario: Return to the library from the settings
    Given the TuneLib library is open
    When I open the settings view
    And I return to the library
    Then the library view is visible
