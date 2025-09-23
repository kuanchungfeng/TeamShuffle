import { Group, GroupingCondition, Student } from "./student.model";

export interface GroupingContext {
  students: Student[];
  groups: Group[];
  conditions: GroupingCondition[];
  remainingStudents: Student[];
}

export interface GroupingResult {
  success: boolean;
  groups: Group[];
  message?: string;
  handled: boolean;
  remainingStudents: Student[];
}

export abstract class GroupingHandler {
  protected nextHandler?: GroupingHandler;

  public setNext(handler: GroupingHandler): GroupingHandler {
    this.nextHandler = handler;
    return handler;
  }

  public handle(context: GroupingContext): GroupingResult {
    const result = this.process(context);

    if (!result.success && this.nextHandler) {
      return this.nextHandler.handle(context);
    }

    return result;
  }

  protected abstract process(context: GroupingContext): GroupingResult;
}
