Feature: Timeouts

    Scenario Outline: A <Decorator> hook runs under the timeout it was given
        Given a file named "features/a.feature" with:
            """feature
            Feature: Feature
                Scenario: example
                    Given a step
            """
        And a file named "step_definitions/steps.ts" with:
            """ts
            import {binding, given, <Decorator>} from 'specumber';

            @binding()
            class Steps {
                @<Decorator>({ timeout: 100 })
                public async hook() {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                @given("a step")
                public step() {}
            }

            export default Steps;
            """
        When I run cucumber-js
        Then it fails
        And the output contains "within 100 milliseconds"

        Examples:
            | Decorator  |
            | before     |
            | after      |
            | beforeStep |
            | afterStep  |

    Scenario Outline: A <Decorator> hook runs under the timeout it was given
        Given a file named "features/a.feature" with:
            """feature
            Feature: Feature
                Scenario: example
                    Given a step
            """
        And a file named "step_definitions/steps.ts" with:
            """ts
            import {binding, given, <Decorator>} from 'specumber';

            @binding()
            class Steps {
                @<Decorator>({ timeout: 100 })
                public static async hook() {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                @given("a step")
                public step() {}
            }

            export default Steps;
            """
        When I run cucumber-js
        Then it fails
        And the output contains "within 100 milliseconds"

        Examples:
            | Decorator |
            | beforeAll |
            | afterAll  |

    Scenario: A step runs under the timeout it was given
        Given a file named "features/a.feature" with:
            """feature
            Feature: Feature
                Scenario: example
                    Given a step
            """
        And a file named "step_definitions/steps.ts" with:
            """ts
            import {binding, given} from 'specumber';

            @binding()
            class Steps {
                @given("a step", { timeout: 100 })
                public async step() {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            export default Steps;
            """
        When I run cucumber-js
        Then it fails
        And the output contains "within 100 milliseconds"

    Scenario: A hook is given longer than Cucumber allows by default
        Given a file named "features/a.feature" with:
            """feature
            Feature: Feature
                Scenario: example
                    Given a step
            """
        And a file named "step_definitions/steps.ts" with:
            """ts
            import {binding, given, beforeAll} from 'specumber';

            @binding()
            class Steps {
                @beforeAll({ timeout: 6000 })
                public static async hook() {
                    await new Promise(resolve => setTimeout(resolve, 5500));
                }

                @given("a step")
                public step() {
                    console.log("the step ran");
                }
            }

            export default Steps;
            """
        When I run cucumber-js
        Then it passes
        And the output contains "the step ran"
