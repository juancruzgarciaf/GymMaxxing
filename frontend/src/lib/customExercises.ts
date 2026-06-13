export const CUSTOM_EXERCISES_UPDATED_EVENT = "gymmaxxing:custom-exercises-updated";

export const notifyCustomExercisesUpdated = () => {
  window.dispatchEvent(new Event(CUSTOM_EXERCISES_UPDATED_EVENT));
};
