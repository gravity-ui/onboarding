const eventGuards = new WeakMap<object, () => boolean>();

export function registerEventGuard(event: object, isCurrent: () => boolean) {
    eventGuards.set(event, isCurrent);
}

export function isEventCurrent(event: object) {
    return eventGuards.get(event)?.() ?? true;
}

export function hasEventGuard(event: object) {
    return eventGuards.has(event);
}
