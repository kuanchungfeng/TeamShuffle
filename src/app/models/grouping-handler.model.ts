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
    console.log(`⚡ [${this.constructor.name}] handle() 被調用`);
    const result = this.process(context);

    if (!result.success && this.nextHandler) {
      console.log(`⚡ [${this.constructor.name}] 處理失敗，傳遞給下一個handler: ${this.nextHandler.constructor.name}`);
      return this.nextHandler.handle(context);
    }

    if (result.success) {
      console.log(`⚡ [${this.constructor.name}] 處理成功，停止責任鏈`);
    } else {
      console.log(`⚡ [${this.constructor.name}] 處理失敗，且沒有下一個handler`);
    }

    return result;
  }

  protected abstract process(context: GroupingContext): GroupingResult;
}
