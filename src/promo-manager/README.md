# Promo manager

Manager of activities that we push to the user. Examples: onboarding steps, polls, advertisements of new features, etc.

## Install

```shell
npm i @gravity-ui/onboarding
```

## Usage

### 1. Init promo manager and setup the progress update

```typescript jsx
# promo-example.ts

import { createPromoManager } from '@gravity-ui/onboarding';
import type { PromoProgressState } from '@gravity-ui/onboarding';

import { pollPreset } from './preset';

export const { controller, usePromoManager, useActivePromo } = createPromoManager({
    config: {
        presets: [pollPreset],
    },
    progressState: () => {
      /* ... */
    },
    getProgressState: () => {
      /* ... */
    },
    onSave: {
        progress: (state: PromoProgressState) => () => {
          /* ... */
        },
    },
});
```

### 2. Add activity conditions and meta info

Import a ready-made one or write your own ✨

```typescript jsx
# preset.ts

import { ShowOncePerMonths, PromoInCurrentDay } from '@gravity-ui/onboarding';

export const pollPreset: TypePreset = {
    slug: 'poll',
    conditions: [ShowOncePerMonths(1), PromoInCurrentDay(new Date('2000-01-26'))],
    promos: [
        {
            slug: 'issuePoll',
            conditions: [ShowOncePerMonths(6)],
            meta: {...}
        },
    ],
};
```

### 3. Trigger promo in your component

```typescript jsx
# TriggerExample.tsx

import { usePromoManager } from './promo-example';

const { requestStart, cancelStart } = usePromoManager(promo);

useMount(() => {
    requestStart();
});

useUnmount(() => {
    cancelStart();
});
```

### 4. Use active promo

```typescript jsx
# WorkWithActivePromoExample.tsx

import { useActivePromo } from './promo-example';

const { promo, preset, metaInfo, cancel, finish } = useActivePromo();
```

## Setup

[Survey setup](./setups/survey-manager.ts)

```typescript jsx
const {controller, useSurveyManager, useActiveSurvey} = createSurveyManager({
  preset: [preset],
  progressState: () => {
    /* ... */
  },
  getProgressState: () => {
    /* ... */
  },
  onProgressSave: (state: ProgressState) => {
    /* ... */
  },
});
```
