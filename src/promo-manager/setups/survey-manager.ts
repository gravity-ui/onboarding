import {createPromoManager} from '../core';
import type {PromoProgressState, PromoOptions, PromoGroup} from '../core/types';

type CreateSurveyOptions = {
    group?: PromoGroup;
    onProgressSave: (state: PromoProgressState) => Promise<any>;
} & Pick<PromoOptions, 'progressState' | 'getProgressState'>;

export const createSurveyManager = ({
    group: surveyGroup,
    progressState,
    getProgressState,
    onProgressSave,
}: CreateSurveyOptions) => {
    const {controller, usePromoManager, useActivePromo} = createPromoManager({
        config: {
            promoGroups: surveyGroup ? [surveyGroup] : [],
        },
        progressState,
        getProgressState,
        onSave: {
            progress: onProgressSave,
        },
    });

    const surveySlug = surveyGroup?.slug;

    const useActiveSurvey = () => {
        const {promo, promoGroup, metaInfo, finish, cancel, skipPromo, updateProgressInfo} =
            useActivePromo();

        return {
            active: promoGroup === surveySlug ? promo : null,
            config: metaInfo,
            finish,
            cancel,
            skipPromo,
            updateProgressInfo,
        };
    };

    return {
        controller,
        useSurveyManager: usePromoManager,
        useActiveSurvey,
    };
};
