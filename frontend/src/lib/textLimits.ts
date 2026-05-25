export const DESCRIPTION_MAX_LENGTH = 80;

export const limitDescription = (value: string) => value.slice(0, DESCRIPTION_MAX_LENGTH);
