export const DESCRIPTION_MAX_LENGTH = 80;
export const TITLE_MAX_LENGTH = 28;
export const USERNAME_MAX_LENGTH = 30;

export const limitDescription = (value: string) => value.slice(0, DESCRIPTION_MAX_LENGTH);
export const limitTitle = (value: string) => value.slice(0, TITLE_MAX_LENGTH);
export const limitUsername = (value: string) => value.slice(0, USERNAME_MAX_LENGTH);
