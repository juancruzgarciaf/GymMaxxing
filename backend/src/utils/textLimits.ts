export const DESCRIPTION_MAX_LENGTH = 80;
export const TITLE_MAX_LENGTH = 28;
export const USERNAME_MAX_LENGTH = 30;

export const limitTitle = (value: unknown) => {
  if (typeof value !== "string") {
    return value == null ? null : String(value).slice(0, TITLE_MAX_LENGTH);
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, TITLE_MAX_LENGTH) : null;
};

export const limitDescription = (value: unknown) => {
  if (typeof value !== "string") {
    return value == null ? null : String(value).slice(0, DESCRIPTION_MAX_LENGTH);
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, DESCRIPTION_MAX_LENGTH) : null;
};
