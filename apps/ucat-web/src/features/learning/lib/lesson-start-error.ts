export class StudyPlanLessonConflictError extends Error {
  constructor() {
    super("This Study-plan task is no longer available.");
    this.name = "StudyPlanLessonConflictError";
  }
}
