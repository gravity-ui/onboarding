import {createPromoManager} from '../core/index';
import type {PromoProgressState, PromoOptions, TypePreset} from '../core/types';

type CreateSurveyOptions = {
    preset?: TypePreset;
    onProgressSave: (state: PromoProgressState) => Promise<any>;
} & Pick<PromoOptions, 'progressState' | 'getProgressState'>;

export const createSurveyManager = ({
    preset: surveyPreset,
    progressState,
    getProgressState,
    onProgressSave,
}: CreateSurveyOptions) => {
    const {controller, usePromoManager, useActivePromo} = createPromoManager({
        config: {
            presets: surveyPreset ? [surveyPreset] : [],
        },
        progressState,
        getProgressState,
        onSave: {
            progress: onProgressSave,
        },
    });

    const surveySlug = surveyPreset?.slug;

    const useActiveSurvey = () => {
        const {promo, preset, metaInfo, finish, cancel, cancelStart, updateProgressInfo} =
            useActivePromo();

        return {
            active: preset === surveySlug ? promo : null,
            config: metaInfo,
            finish,
            cancel,
            cancelStart,
            updateProgressInfo,
        };
    };

    return {
        controller,
        useSurveyManager: usePromoManager,
        useActiveSurvey,
    };
};
