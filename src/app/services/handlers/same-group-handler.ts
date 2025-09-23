import {
  GroupingContext,
  GroupingHandler,
  GroupingResult,
} from "../../models/grouping-handler.model";
import { Student } from "../../models/student.model";

export class SameGroupHandler extends GroupingHandler {
  protected process(context: GroupingContext): GroupingResult {
    const sameGroupCondition = context.conditions.find(
      (c) => c.type === "same-group" && c.enabled
    );

    if (!sameGroupCondition) {
      return {
        success: false,
        groups: context.groups,
        handled: false,
        remainingStudents: context.remainingStudents,
        message: "Same group condition not found or not enabled",
      };
    }

    // 從用戶輸入解析同組條件 (例如: "1-2,3-5" 表示1與2同組，3與5同組，"3-4-5" 表示3,4,5同組)
    const sameGroupPairs = this.parseSameGroupInput(
      sameGroupCondition.config?.input || ""
    );

    if (sameGroupPairs.length === 0) {
      // 如果沒有配置，直接跳過處理
      return {
        success: true,
        groups: context.groups,
        handled: false,
        remainingStudents: context.remainingStudents,
        message: "No same group pairs configured",
      };
    }

    const groups = context.groups.map((g) => ({
      ...g,
      students: [...g.students],
    }));
    const remainingStudents = [...context.remainingStudents];
    const processedStudentIds = new Set<number>();

    // 處理每組同組條件，每個同組條件分配到不同的組別
    for (const pair of sameGroupPairs) {
      // 找到可用的學生
      const availableStudents = pair.filter(
        (studentId) =>
          remainingStudents.some((s) => s.id === studentId) &&
          !processedStudentIds.has(studentId)
      );

      if (availableStudents.length === 0) continue;

      // 為每個同組條件找一個新的組別（優先選擇人數較少的組別）
      const targetGroup = this.findAvailableGroup(
        groups,
        availableStudents.length
      );

      if (targetGroup) {
        // 將學生添加到組別中
        for (const studentId of availableStudents) {
          const student = remainingStudents.find((s) => s.id === studentId);
          if (student) {
            targetGroup.students.push(student);
            processedStudentIds.add(studentId);
          }
        }
      }
    }

    // 從 remainingStudents 中移除已處理的學生
    const finalRemainingStudents = remainingStudents.filter(
      (s) => !processedStudentIds.has(s.id)
    );

    // 如果有下一個處理器，將結果傳遞給它
    if (this.nextHandler && finalRemainingStudents.length > 0) {
      const nextContext: GroupingContext = {
        ...context,
        groups: groups,
        remainingStudents: finalRemainingStudents,
      };
      const nextResult = this.nextHandler.handle(nextContext);

      if (nextResult.handled) {
        // 生成完整的分組結果說明
        const processedCount = processedStudentIds.size;
        const sameGroupSummary =
          processedCount > 0 ? `同組條件處理了${processedCount}位學生; ` : "";

        return {
          success: true,
          groups: nextResult.groups,
          handled: true,
          remainingStudents: nextResult.remainingStudents,
          message: `${sameGroupSummary}${nextResult.message}`,
        };
      }
    }

    // 如果沒有下一個處理器或者下一個處理器沒有處理，將剩餘學生隨機分配
    if (finalRemainingStudents.length > 0) {
      this.distributeRemainingStudents(groups, finalRemainingStudents);
    }

    const processedCount = processedStudentIds.size;
    const totalProcessed =
      processedCount +
      (context.remainingStudents.length - finalRemainingStudents.length);
    const groupSummary = groups
      .filter((g) => g.students.length > 0)
      .map((g) => `${g.name}: ${g.students.map((s) => s.id).join(",")}`)
      .join("; ");

    return {
      success: true,
      groups,
      handled: true,
      remainingStudents: [],
      message:
        processedCount > 0
          ? `已處理同組條件: ${processedCount}位學生按條件分組，${
              context.remainingStudents.length - processedCount
            }位學生隨機分配 - ${groupSummary}`
          : `已隨機分配${context.remainingStudents.length}位學生 - ${groupSummary}`,
    };
  }

  private parseSameGroupInput(input: string): number[][] {
    if (!input || input.trim() === "") {
      return [];
    }

    const pairs: number[][] = [];
    const groups = input
      .split(";")
      .map((group) => group.trim())
      .filter((group) => group.length > 0);

    for (const group of groups) {
      try {
        const studentNumbers = this.parseStudentNumbers(group);
        if (studentNumbers.length >= 2) {
          pairs.push(studentNumbers);
        }
      } catch (error) {
        // 如果解析時發現重複座號，跳過這個群組
        console.warn(`同組條件解析錯誤: ${error}`);
        continue;
      }
    }

    return pairs;
  }

  private parseStudentNumbers(input: string): number[] {
    const numbers: number[] = [];
    const seenNumbers = new Set<number>();
    const duplicates = new Set<number>();

    // 處理用逗號分隔的數字（如 1,2,3 表示1,2,3要同組）
    const parts = input.split(",").map((part) => part.trim());

    for (const part of parts) {
      const num = parseInt(part);
      if (!isNaN(num)) {
        if (seenNumbers.has(num)) {
          // 記錄重複的數字
          duplicates.add(num);
        } else {
          seenNumbers.add(num);
          numbers.push(num);
        }
      }
    }

    // 如果有重複的數字，拋出包含所有重複數字的錯誤
    if (duplicates.size > 0) {
      const duplicateList = Array.from(duplicates)
        .sort((a, b) => a - b)
        .join(",");
      throw new Error(`重複的座號: ${duplicateList}`);
    }

    return numbers.sort((a, b) => a - b);
  }

  private findAvailableGroup(
    groups: any[],
    requiredCapacity: number
  ): any | null {
    // 設定每組的合理上限
    const maxStudentsPerGroup = 8;

    // 尋找有足夠容量的組別，優先選擇學生數量較少的組別
    const availableGroups = groups.filter((group) =>
      this.canFitInGroup(group, requiredCapacity)
    );

    if (availableGroups.length > 0) {
      // 返回人數最少的組別
      return availableGroups.reduce((minGroup, currentGroup) => {
        return currentGroup.students.length < minGroup.students.length
          ? currentGroup
          : minGroup;
      });
    }

    // 如果沒有組別有足夠空間，返回人數最少的組別
    return groups.reduce((minGroup, currentGroup) => {
      return currentGroup.students.length < minGroup.students.length
        ? currentGroup
        : minGroup;
    });
  }

  private canFitInGroup(group: any, requiredCapacity: number): boolean {
    if (!group) return false;

    // 設定每組的合理上限，避免一組人數過多
    const maxStudentsPerGroup = 8; // 可以根據需要調整
    const currentStudents = group.students.length;

    return currentStudents + requiredCapacity <= maxStudentsPerGroup;
  }

  private distributeRemainingStudents(
    groups: any[],
    remainingStudents: Student[]
  ): void {
    // 將剩餘學生分配到各組，優先填充人數較少的組別以保持平衡
    const shuffledStudents = [...remainingStudents].sort(
      () => Math.random() - 0.5
    );

    for (const student of shuffledStudents) {
      // 找到人數最少的組別
      const targetGroup = groups.reduce((minGroup, currentGroup) => {
        return currentGroup.students.length < minGroup.students.length
          ? currentGroup
          : minGroup;
      });

      targetGroup.students.push(student);
    }
  }
}
