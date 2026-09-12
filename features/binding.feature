Feature: Binding steps

    Scenario Outline: Bind steps with <Bind Mode>
        Given a file named "features/a.feature" with:
            """feature
            Feature: some feature
              Scenario: scenario a
                Given step one
                When step two
                Then step three
            """
        And a file named "step_definitions/steps.ts" with:
            """ts
            import {binding, given, when, then} from 'specumber';

            @binding()
            class Steps {
                @given(<Step 1>)
                public given() {
                    console.log("Step one executed");
                }

                @when(<Step 2>)
                public when() {
                    console.log("Step two executed");
                }

                @then(<Step 3>)
                public then() {
                    console.log("Step three executed");
                }
            }

            export default Steps;
            """
        When I run cucumber-js
        Then it passes
        And the output contains "Step one executed"
        And the output contains "Step two executed"
        And the output contains "Step three executed"

        Examples:
            | Bind Mode | Step 1       | Step 2       | Step 3         |
            | names     | "step one"   | "step two"   | "step three"   |
            | regex     | /^step one$/ | /^step two$/ | /^step three$/ |

    Scenario: Failing test
        Given a file named "features/a.feature" with:
            """feature
            Feature: Some feature
              Scenario: example
                Given a step
            """
        And a file named "step_definitions/steps.ts" with:
            """ts
            import {binding, given} from 'specumber';

            @binding()
            class Step {
                @given("a step")
                public step() {
                    throw new Error("Inner error message.");
                }
            }

            export default Step;
            """
        When I run cucumber-js
        Then it fails
        And the output contains "Error: Inner error message."

    Scenario: Missing step definition
        Given a file named "features/a.feature" with:
            """feature
            Feature: some feature
              Scenario: scenario a
                Given missing step
            """
        When I run cucumber-js
        Then it fails
        And the output contains "Given('missing step'"

    Scenario: Reporting where a step is defined
        Given a file named "features/a.feature" with:
            """feature
            Feature: some feature
              Scenario: scenario a
                Given a step
            """
        And a file named "step_definitions/steps.ts" with:
            """ts
            import {binding, given} from 'specumber';

            @binding()
            class Steps {
                @given("a step")
                public step() {}
            }

            export default Steps;
            """
        When I run cucumber-js
        Then it passes
        And the step "a step" is defined at "step_definitions/steps.ts:5"
