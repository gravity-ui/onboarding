# @gravity-ui/onboarding &middot; [![npm package](https://img.shields.io/npm/v/@gravity-ui/onboarding)](https://www.npmjs.com/package/@gravity-ui/onboarding) [![CI](https://img.shields.io/github/actions/workflow/status/gravity-ui/onboarding/.github/workflows/ci.yml?label=CI&logo=github)](https://github.com/gravity-ui/onboarding/actions/workflows/ci.yml?query=branch:main)

Onboarding for users - important part of any service.
@gravity-ui/onboarding helps you to create hint based onboarding scenarios. Can use with React, any other frameworks and vanilla JS.

- **Small**. ~3Kb(minified and gzipped) with zero dependencies
- **Well tested**. ~90% test coverage
- **Small code footprint**. Create onboarding scenario config and connect each step to UI with couple lines of code.
- **No UI**. Use your own components
- Good TypeScript support

```typescript jsx
// todo-list-onboarding.ts
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
  baseState: () => {
    /* ... */
  },
  getProgressState: () => {
    /* ... */
  },
  // save new onboarding state to backend
  onSave: {
    state: (state) => {
      /* ... */
    },
    progress: (progress) => {
      /* ... */
    },
  },
});
```

```typescript jsx
// App.tsx
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

## Install

```shell
npm i @gravity-ui/onboarding
```

## Usage

TBD
