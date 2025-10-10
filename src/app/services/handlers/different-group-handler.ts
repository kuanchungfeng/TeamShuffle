import {
  GroupingContext,
  GroupingHandler,
  GroupingResult,
} from "../../models/grouping-handler.model";
import { Student } from "../../models/student.model";

export class DifferentGroupHandler extends GroupingHandler {
  protected process(context: GroupingContext): GroupingResult {
    console.log('🔴 [DifferentGroupHandler] 開始處理');
    console.log('輸入Context:', context);
    
    const differentGroupCondition = context.conditions.find(
      (c) => c.type === "different-group" && c.enabled
    );

    if (!differentGroupCondition) {
      console.log('🔴 [DifferentGroupHandler] 條件未啟用，跳過');
      return {
        success: false,
        groups: context.groups,
        handled: false,
        remainingStudents: context.remainingStudents,
        message: "Different group condition not found or not enabled",
      };
    }

    // 從用戶輸入解析不同組條件 (例如: "1-2,3-5" 表示1與2不同組，3與5不同組)
    const differentGroupPairs = this.parseDifferentGroupInput(
      differentGroupCondition.config?.input || ""
    );

    if (differentGroupPairs.length === 0) {
      // 如果沒有配置，直接跳過處理
      return {
        success: true,
        groups: context.groups,
        handled: false,
        remainingStudents: context.remainingStudents,
        message: "No different group pairs configured",
      };
    }

    const groups = context.groups.map((g) => ({
      ...g,
      students: [...g.students],
    }));
    const remainingStudents = [...context.remainingStudents];
    const processedStudentIds = new Set<number>();

    // 處理每組不同組條件
    for (const pair of differentGroupPairs) {
      // 確保這些學生被分配到不同的組別
      // 注意：這裡傳入完整的 pair，而不是只有 remainingStudents 中的學生
      this.assignToDifferentGroups(
        groups,
        pair,
        remainingStudents,
        processedStudentIds
      );
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
        const differentGroupSummary =
          processedCount > 0 ? `不同組條件處理了${processedCount}位學生; ` : "";

        return {
          success: true,
          groups: nextResult.groups,
          handled: true,
          remainingStudents: nextResult.remainingStudents,
          message: `${differentGroupSummary}${nextResult.message}`,
        };
      }
    }

    // 如果沒有下一個處理器或者下一個處理器沒有處理，將剩餘學生隨機分配
    if (finalRemainingStudents.length > 0) {
      this.distributeRemainingStudents(groups, finalRemainingStudents);
    }

    const processedCount = processedStudentIds.size;
    const groupSummary = groups
      .filter((g) => g.students.length > 0)
      .map((g) => `${g.name}: ${g.students.map((s) => s.id).join(",")}`)
      .join("; ");

    const result = {
      success: true,
      groups,
      handled: true,
      remainingStudents: [],
      message:
        processedCount > 0
          ? `已處理不同組條件: ${processedCount}位學生按條件分組，${
              context.remainingStudents.length - processedCount
            }位學生隨機分配 - ${groupSummary}`
          : `已隨機分配${context.remainingStudents.length}位學生 - ${groupSummary}`,
    };

    console.log('🔴 [DifferentGroupHandler] 處理完成');
    console.log('結果:', result);
    
    return result;
  }

  private parseDifferentGroupInput(input: string): number[][] {
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
        console.warn(`不同組條件解析錯誤: ${error}`);
        continue;
      }
    }

    return pairs;
  }

  private parseStudentNumbers(input: string): number[] {
    const numbers: number[] = [];
    const seenNumbers = new Set<number>();
    const duplicates = new Set<number>();

    // 處理用逗號分隔的數字（如 1,2,3 表示1,2,3要不同組）
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

  private assignToDifferentGroups(
    groups: any[],
    studentIds: number[],
    remainingStudents: Student[],
    processedStudentIds: Set<number>
  ): void {
    // 檢查是否有學生已經被分配到組別中，以及他們的位置
    const studentGroupMap = new Map<number, number>(); // studentId -> groupIndex

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      for (const student of group.students) {
        if (studentIds.includes(student.id)) {
          studentGroupMap.set(student.id, groupIndex);
        }
      }
    }

    // 檢查是否已經有學生在同一組，如果有則需要重新分配
    const groupsWithStudents = Array.from(new Set(studentGroupMap.values()));

    if (groupsWithStudents.length > 1) {
      // 已經在不同組，符合不同組條件，標記為已處理
      for (const studentId of studentIds) {
        if (studentGroupMap.has(studentId)) {
          processedStudentIds.add(studentId);
        }
      }
    } else if (groupsWithStudents.length === 1) {
      // 所有已分配的學生都在同一組，違反不同組條件，需要重新分配
      const conflictGroupIndex = groupsWithStudents[0];
      const studentsInConflictGroup = studentIds.filter(
        (id) => studentGroupMap.get(id) === conflictGroupIndex
      );

      // 從衝突組別中移除這些學生（除了第一個）
      for (let i = 1; i < studentsInConflictGroup.length; i++) {
        const studentId = studentsInConflictGroup[i];
        const studentObj = groups[conflictGroupIndex].students.find(
          (s) => s.id === studentId
        );
        if (studentObj) {
          // 從原組別移除
          groups[conflictGroupIndex].students = groups[
            conflictGroupIndex
          ].students.filter((s) => s.id !== studentId);
          // 加回到剩餘學生池中
          remainingStudents.push(studentObj);
        }
      }

      // 重新分配被移除的學生
      const studentsToReassign = studentsInConflictGroup.slice(1);
      this.redistributeStudents(
        groups,
        studentsToReassign,
        remainingStudents,
        conflictGroupIndex
      );

      // 標記所有學生為已處理
      for (const studentId of studentIds) {
        processedStudentIds.add(studentId);
      }
    }

    // 處理還在 remainingStudents 中的學生
    const usedGroups = new Set<number>();

    // 標記已經有相關學生的組別
    for (const [studentId, groupIndex] of studentGroupMap) {
      if (studentIds.includes(studentId)) {
        usedGroups.add(groupIndex);
      }
    }

    for (const studentId of studentIds) {
      // 如果學生已經在某個組別中，跳過
      if (studentGroupMap.has(studentId)) {
        processedStudentIds.add(studentId);
        continue;
      }

      const student = remainingStudents.find((s) => s.id === studentId);
      if (!student) continue;

      // 找到一個還沒被這個不同組條件使用的組別
      let targetGroup = null;

      // 優先選擇人數較少且沒被使用的組別
      const availableGroups = groups
        .map((group, index) => ({ group, index }))
        .filter(({ index }) => !usedGroups.has(index))
        .sort((a, b) => a.group.students.length - b.group.students.length);

      if (availableGroups.length > 0) {
        targetGroup = availableGroups[0].group;
        usedGroups.add(availableGroups[0].index);
      } else {
        // 如果所有組別都被使用了，選擇人數最少的組別
        targetGroup = groups.reduce((minGroup, currentGroup) => {
          return currentGroup.students.length < minGroup.students.length
            ? currentGroup
            : minGroup;
        });
      }

      if (targetGroup) {
        targetGroup.students.push(student);
        processedStudentIds.add(studentId);
      }
    }
  }

  private redistributeStudents(
    groups: any[],
    studentIds: number[],
    remainingStudents: Student[],
    avoidGroupIndex: number
  ): void {
    for (const studentId of studentIds) {
      const student = remainingStudents.find((s) => s.id === studentId);
      if (!student) continue;

      // 找到人數最少且不是衝突組別的組別
      const availableGroups = groups
        .map((group, index) => ({ group, index }))
        .filter(({ index }) => index !== avoidGroupIndex)
        .sort((a, b) => a.group.students.length - b.group.students.length);

      if (availableGroups.length > 0) {
        availableGroups[0].group.students.push(student);
      }
    }
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
