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

const { requestStart, cancelStart } = usePromoManager('issuePoll');

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

const { promo, metaInfo, cancel, finish } = useActivePromo('poll');
```

```typescript jsx
/**
 * @param updateProgressInfo - to save progress info
 * @param closeActiveTimeout - close current promo after timeout
  */

 finish: (updateProgressInfo = false, closeActiveTimeout = 0) => {...} // trigger next promo and add current to the finishedPromos
 cancel: (updateProgressInfo = false, closeActiveTimeout = 0) => {...} // trigger next promo
```

## Progress info

```typescript jsx
{
    "base": {
        "activePromo": "pollIssue",
        "activeQueue": []
    },
    // get in getProgressState()
    // save in onSave.progress(...)
    "progress": {
        "finishedPromos": ["openBoardPoll"],
        "progressInfoByType": {
            "poll": {
                "lastCallTime": 1706110831370
            }
        },
        "progressInfoByPromo": {
            "openBoardPoll": {
                "lastCallTime": 1706110831370
            }
        }
    }
}

```

## Setups

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
