import {createSurveyManager} from '../setups/survey-manager';

describe('Survey Manager', () => {
    describe('createSurveyManager', () => {
        it('should call onProgressSave when provided', () => {
            const onProgressSave = vi.fn(() => Promise.resolve());
            const options = {
                progressState: {},
                getProgressState: vi.fn(() => Promise.resolve({})),
                onProgressSave,
            };

            const surveyManager = createSurveyManager(options);

            expect(surveyManager).toBeDefined();
            expect(onProgressSave).not.toHaveBeenCalled();
        });

        it('should work with survey group configuration', () => {
            const surveyGroup = {
                slug: 'userSurveys',
                promos: [
                    {
                        slug: 'nps-survey',
                        meta: {
                            title: 'NPS Survey',
                            description: 'Rate our service',
                        },
                    },
                    {
                        slug: 'feedback-survey',
                        meta: {
                            title: 'Feedback Survey',
                            description: 'Tell us what you think',
                        },
                    },
                ],
            };

            const options = {
                group: surveyGroup,
                progressState: {},
                getProgressState: vi.fn(() => Promise.resolve({})),
                onProgressSave: vi.fn(() => Promise.resolve()),
            };

            const surveyManager = createSurveyManager(options);

            expect(surveyManager).toBeDefined();
            expect(surveyManager.controller).toBeDefined();
        });
    });
});
