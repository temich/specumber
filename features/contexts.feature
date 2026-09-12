Feature: Custom context objects

    Scenario: Using custom context objects to share state
        Given a file named "features/a.feature" with:
            """feature
            Feature: some feature
              Scenario: scenario a
                Given the state is "initial value"
                When I set the state to "step value"
                Then the state is "step value"
            """
        And a file named "support/state.ts" with:
            """ts
            export class State {
                public value: string = "initial value";
            }
            """
        And a file named "step_definitions/one.ts" with:
            """ts
            import {State} from '../support/state.ts';
            import {binding, when} from 'specumber';

            @binding([State])
            class Steps {
                public constructor(private readonly state: State) {}

                @when("I set the state to {string}")
                public setState(newValue: string) {
                    this.state.value = newValue;
                }
            }

            export default Steps;
            """
        And a file named "step_definitions/two.ts" with:
            """ts
            import {State} from '../support/state.ts';
            import {binding, then} from 'specumber';
            import * as assert from 'node:assert';

            @binding([State])
            class Steps {
                public constructor(private readonly state: State) {}

                @then("the state is {string}")
                public checkValue(value: string) {
                    console.log(`The state is '${this.state.value}'`);
                    assert.equal(this.state.value, value, "State value does not match");
                }
            }

            export default Steps;
            """
        When I run cucumber-js
        Then it passes
        And the output contains "The state is 'initial value'"
        And the output contains "The state is 'step value'"

    Scenario: Custom context objects can depend on other custom context objects two levels deep
        Given a file named "features/a.feature" with:
            """feature
            Feature: some feature
              Scenario: scenario a
                Given the state is "initial value"
                When I set the state to "step value"
                Then the state is "step value"
            """
        And a file named "support/level-one-state.ts" with:
            """ts
            import {binding} from 'specumber';
            import {LevelTwoState} from './level-two-state.ts';

            @binding([LevelTwoState])
            export class LevelOneState {
                constructor(public levelTwoState: LevelTwoState) {
                }
            }
            """
        And a file named "support/level-two-state.ts" with:
            """ts
            export class LevelTwoState {
                public value: string = "initial value";
            }
            """
        And a file named "step_definitions/one.ts" with:
            """ts
            import {LevelTwoState} from '../support/level-two-state.ts';
            import {binding, when} from 'specumber';

            @binding([LevelTwoState])
            class Steps {
                public constructor(private readonly levelTwoState: LevelTwoState) {
                }

                @when("I set the state to {string}")
                public setState(newValue: string) {
                    this.levelTwoState.value = newValue;
                }
            }

            export default Steps;
            """
        And a file named "step_definitions/two.ts" with:
            """ts
            import {LevelOneState} from '../support/level-one-state.ts';
            import {binding, then} from 'specumber';
            import * as assert from 'node:assert';

            @binding([LevelOneState])
            class Steps {
                public constructor(private readonly levelOneState: LevelOneState) {}

                @then("the state is {string}")
                public checkValue(value: string) {
                    console.log(`The state is '${this.levelOneState.levelTwoState.value}'`);
                    assert.equal(this.levelOneState.levelTwoState.value, value, "State value does not match");
                }
            }

            export default Steps;
            """
        When I run cucumber-js
        Then it passes
        And the output contains "The state is 'initial value'"
        And the output contains "The state is 'step value'"

    Scenario: Custom context objects can depend on other custom context objects three levels deep
        Given a file named "features/a.feature" with:
            """feature
            Feature: some feature
              Scenario: scenario a
                Given the state is "initial value"
                When I set the state to "step value"
                Then the state is "step value"
            """
        And a file named "support/level-one-state.ts" with:
            """ts
            import {binding} from 'specumber';
            import {LevelTwoState} from './level-two-state.ts';

            @binding([LevelTwoState])
            export class LevelOneState {
                constructor(public levelTwoState: LevelTwoState) {
                }
            }
            """
        And a file named "support/level-two-state.ts" with:
            """ts
            import {binding} from 'specumber';
            import {LevelThreeState} from './level-three-state.ts';

            @binding([LevelThreeState])
            export class LevelTwoState {
                constructor(public levelThreeState: LevelThreeState) {
                }
            }
            """
        And a file named "support/level-three-state.ts" with:
            """ts
            export class LevelThreeState {
                public value: string = "initial value";
            }
            """
        And a file named "step_definitions/one.ts" with:
            """ts
            import {LevelThreeState} from '../support/level-three-state.ts';
            import {binding, when} from 'specumber';

            @binding([LevelThreeState])
            class Steps {
                public constructor(private readonly levelThreeState: LevelThreeState) {
                }

                @when("I set the state to {string}")
                public setState(newValue: string) {
                    this.levelThreeState.value = newValue;
                }
            }

            export default Steps;
            """
        And a file named "step_definitions/two.ts" with:
            """ts
            import {LevelOneState} from '../support/level-one-state.ts';
            import {binding, then} from 'specumber';
            import * as assert from 'node:assert';

            @binding([LevelOneState])
            class Steps {
                public constructor(private readonly levelOneState: LevelOneState) {}

                @then("the state is {string}")
                public checkValue(value: string) {
                    console.log(`The state is '${this.levelOneState.levelTwoState.levelThreeState.value}'`);
                    assert.equal(this.levelOneState.levelTwoState.levelThreeState.value, value, "State value does not match");
                }
            }

            export default Steps;
            """
        When I run cucumber-js
        Then it passes
        And the output contains "The state is 'initial value'"
        And the output contains "The state is 'step value'"

    Scenario: Cyclic state dependencies are detected and communicated to the developer
        Given a file named "features/a.feature" with:
            """feature
            Feature: some feature
              Scenario: scenario a
                Given the state is "initial value"
                When I set the state to "step value"
                Then the state is "step value"
            """
        And a file named "support/state.ts" with:
            """ts
            import {binding} from 'specumber';

            class One {
                constructor(public stateTwo: StateTwo) { }
            }

            @binding([One])
            export class StateTwo {
                public value: string = "initial value";
                constructor(public stateOne: One) { }
            }

            export const StateOne = binding([StateTwo])(One);
            """
        And a file named "step_definitions/one.ts" with:
            """ts
            import {StateTwo} from '../support/state.ts';
            import {binding, when} from 'specumber';

            @binding([StateTwo])
            class StepsOne {
                public constructor(private readonly stateTwo: StateTwo) {
                }

                @when("I set the state to {string}")
                public setState(newValue: string) {
                    this.stateTwo.value = newValue;
                }
            }

            export default StepsOne;
            """
        And a file named "step_definitions/two.ts" with:
            """ts
            import {StateOne} from '../support/state.ts';
            import {binding, then} from 'specumber';
            import * as assert from 'node:assert';

            @binding([StateOne])
            class StepsTwo {
                public constructor(private readonly stateOne: StateOne) {}

                @then("the state is {string}")
                public checkValue(value: string) {
                    console.log(`The state is '${this.stateOne.stateTwo.value}'`);
                    assert.equal(this.stateOne.stateTwo.value, value, "State value does not match");
                }
            }

            export default StepsTwo;
            """
        When I run cucumber-js
        Then it fails
        And the error output contains text:
            """
            Error: Cyclic dependency detected: One -> StateTwo -> One
            """

    Scenario: Cyclic single-file state dependencies are detected and communicated to the developer
        Given a file named "features/a.feature" with:
        """feature
        Feature: some feature
          Scenario: scenario a
            Given the state is "initial value"
            When I set the state to "step value"
            Then the state is "step value"
        """
        And a file named "support/circular.ts" with:
        """ts
        import {binding} from 'specumber';

        class One {
            constructor(public stateTwo: StateTwo) { }
        }

        @binding([One])
        export class StateTwo {
            public value: string = "initial value";
            constructor(public stateOne: One) { }
        }

        export const StateOne = binding([StateTwo])(One);
        """
        And a file named "step_definitions/one.ts" with:
        """ts
        import {StateTwo} from '../support/circular.ts';
        import * as assert from 'node:assert';
        import {binding, when, then} from 'specumber';

        @binding([StateTwo])
        class Steps {
            public constructor(private readonly stateTwo: StateTwo) {
            }

            @when("I set the state to {string}")
            public setState(newValue: string) {
                this.stateTwo.value = newValue;
            }

            @then("the state is {string}")
            public checkValue(value: string) {
                console.log(`The state is '${this.stateTwo.value}'`);
                assert.equal(this.stateTwo.value, value, "State value does not match");
            }
        }

        export default Steps;
        """
        When I run cucumber-js
        Then it fails
        And the error output contains text:
            """
            Error: Cyclic dependency detected: One -> StateTwo -> One
            """
