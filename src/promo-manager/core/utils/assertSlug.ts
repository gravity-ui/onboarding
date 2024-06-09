import {Nullable} from '../types';

export const assertSlug = (slug: Nullable<string>, target?: string) => {
    if (!target) {
        return slug;
    }

    return target === slug ? slug : null;
};
