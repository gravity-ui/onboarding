import {Condition, ConditionContext, ConditionObject, PromoState} from '../types';
import {Logger} from '../../../logger';

const resolveConditionObject = (
    condition: ConditionObject,
    state: PromoState,
    ctx: ConditionContext,
    logger: Logger,
) => {
    const conditionHelper = ctx.helpers?.[condition.helper];
    if (!conditionHelper) {
        // ignore undefined helper -> resolve to false
        logger.error('Condition helper not found', condition.helper);
        return false;
    }

    const args = condition.args ?? [];

    return conditionHelper(...args)(state, ctx);
};

export const checkCondition = (
    state: PromoState,
    ctx: ConditionContext,
    conditions: Condition[],
    logger: Logger,
) => {
    for (const condition of conditions) {
        let result = false;
        if (typeof condition === 'function') {
            result = condition(state, ctx);
        } else {
            result = resolveConditionObject(condition, state, ctx, logger);
        }

        if (!result) {
            return false;
        }
    }

    return true;
};
