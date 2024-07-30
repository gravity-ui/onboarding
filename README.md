# @gravity-ui/onboarding &middot; [![npm package](https://img.shields.io/npm/v/@gravity-ui/onboarding)](https://www.npmjs.com/package/@gravity-ui/onboarding) [![CI](https://img.shields.io/github/actions/workflow/status/gravity-ui/onboarding/.github/workflows/ci.yml?label=CI&logo=github)](https://github.com/gravity-ui/onboarding/actions/workflows/ci.yml?query=branch:main)

Create hint based onboarding scenarios and manage promo activities in your service.
Use with React, any other frameworks or vanilla JS.

- **Small**. Onboarding ~4Kb, promo-manager ~8kb. Zero dependencies
- **Well tested**. ~80% test coverage
- **Small code footprint**. Create onboarding scenario config and connect each step to UI with couple lines of code.
- **No UI**. Use your own components
- Good TypeScript support

# Table of Contents

- Tools
- Onboarding guide
  - how to use
  - deep dive
  - plugins
  - promo presets
- Promo manager
  - how to use
  - onboarding integration

## Install

```shell
npm i @gravity-ui/onboarding
```

# Package contents

This package contains 2 tools:

- Onboarding - tool for creating hint based onboarding for service users. Create presets with steps, bind to elements and call methods. Onboarding will keep user progress and calculate next hint to show.

- Promo manager - tool for managing any promo activities tou push into user: banners, informers, UX surveys, educational popup. Put all promos in config and specify the conditions. Promo manager will keep user progress and calculate next promo to show.

# Onboarding

## How to use

<details>
  <summary>Basic react example</summary>

```typescript jsx
// todo-list-onboarding.ts
import {createOnboarding} from '@gravity-ui/onboarding';

export const {
  useOnboardingStep,
  useOnboardingPreset,
  useOnboardingHint,
  useOnboarding,
  controller,
} = createOnboarding({
  config: {
    presets: {
      todoListFirstUsage: {
        name: '',
        steps: [
          createStep({
            slug: 'createTodoList',
            name: 'create-todo-list',
            description: 'Click button to create todo list',
          }),
          /* other scanario steps */
        ],
      },
    },
  },
  // onboarding state from backend
  baseState: () => {/* ... */},
  getProgressState: () => {/* ... */},
  // save new onboarding state to backend
  onSave: {
    state: (state) => {/* ... */},
    progress: (progress) => {/* ... */},
  },
});
```

```typescript jsx
// App.tsx
import {useOnboardingHint} from '../todo-list-onboarding.ts';

const {anchorRef, hint, open, onClose} = useOnboardingHint();

return (
  <HintPopup
    open={open}
    anchor={anchorRef}
    title={hint?.step.name}
    description={hint?.step.description}
    onClose={onClose}
  />
);
```

```typescript jsx
// todo-list.tsx
import {useOnboardingStep} from '../todo-list-onboarding.ts';

const {pass, ref} = useOnboardingStep('createFirstIssue');

return (
  <Button
    onClick={() => {
      pass();
      handleAddTodoList();
    }}
    ref={ref}
    // ...
  >
    "Add new list"
  </Button>
);
```

</details>

## Onboarding deep dive

You can configure onboarding

```typescript jsx
const onboardingOptions = {
  config: {
    presets: {/**/},
    baseState: {/**/}, // initial state for current user
    getProgressState: () => {/**/}, // function to load user progress
    onSave: {
      // functions to save user state
      state: (state) => {/**/},
      progress: (progress) => {/**/},
    },
    showHint: (state) => {
      /**/
    }, // optional. function to shoe hint. Only for vanilla js usage
    logger: {
      // optional. you can specify custom logger
      level: 'error' as const,
      logger: {
        debug: () => {/**/},
        error: () => {/**/},
      },
    },
    debugMode: true, // optional. true will show a lot of debug messages. Recommended for dev environment
    plugins: [/**/], // optional. you can use existing plugins or write your own
    hooks: {
      // optional. you can subscribe to onboarding events
      showHint: ({preset, step}) => {/**/},
      stepPass: ({preset, step}) => {/**/},
      addPreset: ({preset}) => {/**/},
      beforeRunPreset: ({preset}) => {/**/},
      runPreset: ({preset}) => {/**/},
      finishPreset: ({preset}) => {/**/},
      beforeSuggestPreset: ({preset}) => {/**/},
      beforeShowHint: ({stepData}) => {/**/},
      stateChange: ({state}) => {/**/},
      hintDataChanged: ({state}) => {/**/},
      closeHint: ({hint}) => {/**/},
      init: () => {/**/},
      wizardStateChanged: ({wizardState}) => {/**/},
    },
  },
};
```

---

For default preset you can specify properties:

```typescript jsx
const onboardingOptions = {
  config: {
    presets: {
      createProject: {
        // preset name should be unique
        name: 'Creating project', // text for user
        type: 'default', // optional. 'default'(default value) | 'interlal' | 'combined'
        visibility: 'visible', // optional. 'visible'(defaule value) | 'initialHidden' | 'alwaysHidden';
        description: '', // optional, text for user
        steps: [
          {
            slug: 'openBoard', // step slug must be unique across all presets
            name: '', // text to show in popup
            description: '', // text to show in popup
            placement: 'top', // optional. Hint placement for step
            passMode: 'onAction', // optional. 'onAction'(default value) | 'onShowHint' - trigger step pass on hint show
            hintParams: {}, // optional. any custom properties for hint
            closeOnElementUnmount: false, // optional. default valeue - false. Will close hint when element umnounts. 'True' not reccomended in general^ but may me helpful for some corners
            passRestriction: 'afterPrevious', // optional. afterPrevious will block pass step is previous not passed
            hooks: {
              // optional
              onStepPass: () => {/**/},
              onCloseHint: () => {/**/},
              onCloseHintByUser: () => {/**/},
            },
          },
        ],
        hooks: {
          // optional
          onBeforeStart: () => {/**/},
          onStart: () => {/**/},
          onEnd: () => {/**/},
        },
      },
    },
  },
};
```

Also, there are combined preset. It is group presets, but it acts like one. When combined preset runs, it resolves to one of internal preset. You can find example in [test data](https://github.com/gravity-ui/onboarding/blob/main/src/tests/utils.ts#L71)

---

You can use event system. Available events: `showHint`, `stepPass`, `addPreset`, `beforeRunPreset`, `runPreset`, `finishPreset`, `beforeSuggestPreset`, `beforeShowHint`, `stateChange`, `hintDataChanged`, `closeHint`, `init`, `wizardStateChange`

```typescript jsx
controller.events.subscribe('beforeShowHint', callback);
```

---

You can use plugins

- MultiTabSyncPlugin - closes hint in all browser tabs
- PromoPresetsPlugin - all 'always hidden presets' becomes 'promo presets'. They can turn on onboarding, can only show hint only if user not interact with common onboarding presets. Perfect for educational hints
- WizardPlugin - highly recommended, if wizard is used. hide wizard on run preset, show on finish, erase progress for not finished presets on wizard close.

```typescript jsx
import {createOnboardin} from '@gravity-ui/onboarding';
import {
  MultiTabSyncPlugin,
  PromoPresetsPlugin,
  WizardPlugin,
} from '@gravity-ui/onboarding/dist/plugins';

const {controller} = createOnboarding({
  /**/
  plugins: [
    new MultiTabSyncPlugin({enableStateSync: false}), //
    new PromoPresetsPlugin(),
    new WizardPlugin(),
  ],
});
```

---

You can write your own plugin

```typescript jsx
import {createOnboardin} from '@gravity-ui/onboarding';
import {WizardPlugin} from '@gravity-ui/onboarding/dist/plugins';

const myPlugin = {
  apply: (onboarding) => {
    /**
     * Do something with onboarding controller
     * For exampe subscribe on event
     *  onboarding.events.subscribe('init', () => {});
     */
  },
};

const {controller} = createOnboarding({
  /**/
  plugins: [new WizardPlugin(), myPlugin],
});
```

# Promo manager
