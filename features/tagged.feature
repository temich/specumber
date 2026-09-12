Feature: Tagged step definitions

    Scenario: Binding one step pattern in two classes, one of them tagged
        Given a file named "features/a.feature" with:
            """feature
            Feature: some feature
              Scenario: on the desktop
                Given the platform is prepared

              @mobile
              Scenario: on the phone
                Given the platform is prepared
            """
        And a file named "step_definitions/steps.ts" with:
            """ts
            import {binding, given} from 'pupumber';

            @binding()
            class Common {
                @given("the platform is prepared")
                public prepare() {
                    console.log("prepared the desktop");
                }
            }

            @binding()
            class Mobile {
                @given("the platform is prepared", "@mobile")
                public prepare() {
                    console.log("prepared the phone");
                }
            }

            export default Common;
            """
        When I run cucumber-js
        Then it passes
        And the output contains "prepared the desktop" once
        And the output contains "prepared the phone" once

    Scenario: Leaving a scenario with no step definition that applies
        Given a file named "features/a.feature" with:
            """feature
            Feature: some feature
              Scenario: on the desktop
                Given the platform is prepared
            """
        And a file named "step_definitions/steps.ts" with:
            """ts
            import {binding, given} from 'pupumber';

            @binding()
            class Mobile {
                @given("the platform is prepared", "@mobile")
                public prepare() {
                    console.log("prepared the phone");
                }
            }

            export default Mobile;
            """
        When I run cucumber-js
        Then it fails
        And the output contains "No step definition bound to the platform is prepared applies"
