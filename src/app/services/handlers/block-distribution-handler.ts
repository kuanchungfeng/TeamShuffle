import {
  GroupingContext,
  GroupingHandler,
  GroupingResult,
} from "../../models/grouping-handler.model";
import { Student } from "../../models/student.model";

export class BlockDistributionHandler extends GroupingHandler {
  protected process(context: GroupingContext): GroupingResult {
    console.log('🔵 [BlockDistributionHandler] 開始處理');
    console.log('輸入Context:', context);
    
    const blockDistributionCondition = context.conditions.find(
      (c) => c.type === "block-distribution" && c.enabled
    );

    if (!blockDistributionCondition) {
      console.log('🔵 [BlockDistributionHandler] 條件未啟用，跳過');
      return {
        success: false,
        groups: context.groups,
        handled: false,
        remainingStudents: context.remainingStudents,
        message: "Block distribution condition not found or not enabled",
      };
    }

    // 從新的 blockInputs 格式中解析區塊
    const blockInputs = (blockDistributionCondition.config as any)?.blockInputs;
    const blocks: number[][] = [];

    if (Array.isArray(blockInputs)) {
      // 解析每個區塊的輸入
      for (const input of blockInputs) {
        if (typeof input === "string" && input.trim()) {
          const parsedBlock = this.parseBlockInput(input);
          if (parsedBlock.length > 0) {
            blocks.push(parsedBlock);
          }
        }
      }
    }

    if (blocks.length === 0) {
      // 如果沒有配置區塊，直接跳過處理
      return {
        success: true,
        groups: context.groups,
        handled: false,
        remainingStudents: context.remainingStudents,
        message: "No blocks configured",
      };
    }

    const groups = context.groups.map((g) => ({
      ...g,
      students: [...g.students],
    }));
    const remainingStudents = [...context.remainingStudents];
    const processedStudentIds = new Set<number>();

    // 分配區塊學生
    this.distributeBlockStudents(
      groups,
      blocks,
      remainingStudents,
      processedStudentIds
    );

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
        const processedCount = processedStudentIds.size;
        const blockDistributionSummary =
          processedCount > 0 ? `區塊分配處理了${processedCount}位學生; ` : "";

        return {
          success: true,
          groups: nextResult.groups,
          handled: true,
          remainingStudents: nextResult.remainingStudents,
          message: `${blockDistributionSummary}${nextResult.message}`,
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
          ? `已處理區塊分配: ${processedCount}位學生按區塊分散，${
              context.remainingStudents.length - processedCount
            }位學生隨機分配 - ${groupSummary}`
          : `已隨機分配${context.remainingStudents.length}位學生 - ${groupSummary}`,
    };

    console.log('🔵 [BlockDistributionHandler] 處理完成');
    console.log('結果:', result);
    
    return result;
  }

  private parseBlockInput(input: string): number[] {
    if (!input || !input.trim()) {
      return [];
    }

    const lines = input
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const numbers: number[] = [];

    for (const line of lines) {
      // 支援逗號分隔和空格分隔
      const parts = line
        .split(/[,\s]+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      for (const part of parts) {
        if (part.includes("-")) {
          // 處理範圍 (例如: 1-5)
          const [start, end] = part.split("-").map((n) => parseInt(n.trim()));
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
              numbers.push(i);
            }
          }
        } else {
          const num = parseInt(part);
          if (!isNaN(num)) {
            numbers.push(num);
          }
        }
      }
    }

    return [...new Set(numbers)].sort((a, b) => a - b);
  }

  private parseStudentNumbers(input: string): number[] {
    const numbers: number[] = [];
    const seenNumbers = new Set<number>();

    // 支援逗號分隔的數字
    const parts = input.split(",").map((part) => part.trim());

    for (const part of parts) {
      const num = parseInt(part);
      if (!isNaN(num) && !seenNumbers.has(num)) {
        seenNumbers.add(num);
        numbers.push(num);
      }
    }

    return numbers.sort((a, b) => a - b);
  }

  private distributeBlockStudents(
    groups: any[],
    blocks: number[][],
    remainingStudents: Student[],
    processedStudentIds: Set<number>
  ): void {
    // 創建每個區塊的學生映射
    const blockStudentMap = new Map<number, number>(); // studentId -> blockIndex

    blocks.forEach((block, blockIndex) => {
      block.forEach((studentId) => {
        blockStudentMap.set(studentId, blockIndex);
      });
    });

    // 按區塊分組學生
    const blockGroups: Student[][] = blocks.map(() => []);

    // 找到屬於區塊的學生
    for (const student of remainingStudents) {
      const blockIndex = blockStudentMap.get(student.id);
      if (blockIndex !== undefined) {
        blockGroups[blockIndex].push(student);
        processedStudentIds.add(student.id);
      }
    }

    // 輪流分配策略：確保每個區塊的學生平均分散到各組
    const totalGroups = groups.length;
    let currentGroupIndex = 0;

    // 為每個區塊分配學生
    for (let blockIndex = 0; blockIndex < blockGroups.length; blockIndex++) {
      const blockStudents = blockGroups[blockIndex];

      // 打亂區塊內的學生順序以增加隨機性
      const shuffledStudents = [...blockStudents].sort(
        () => Math.random() - 0.5
      );

      for (const student of shuffledStudents) {
        // 找到當前應該分配的組別
        const targetGroup = groups[currentGroupIndex];
        targetGroup.students.push(student);

        // 移動到下一個組別
        currentGroupIndex = (currentGroupIndex + 1) % totalGroups;
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
