@large-audio
Feature: Large audio files use bounded range responses

  Scenario: A WAV larger than the whole-response limit plays, seeks and resumes
    Given the TuneLib library is open
    When I play the track "Midnight Ride"
    Then the large audio file plays through byte ranges
    When I seek near the end of the large audio file
    Then the large audio file resumes after a pause
