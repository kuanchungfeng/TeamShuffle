import { CommonModule } from "@angular/common";
import { Component, computed, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTooltipModule } from "@angular/material/tooltip";
import {
  GroupingConditionsService,
  GroupingConditionState,
} from "../../services/grouping-conditions.service";
import { StudentService } from "../../services/student.service";

@Component({
  selector: "app-grouping-conditions-dialog",
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: "./grouping-conditions-dialog.component.html",
  styleUrl: "./grouping-conditions-dialog.component.scss",
})
export class GroupingConditionsDialogComponent implements OnInit {
  editingConditions = this.groupingConditionsService.getEditingConditions();

  // 驗證錯誤
  validationErrors = computed(() => {
    const errors: string[] = [];
    const conditions = this.editingConditions();
    const totalStudents = this.studentService.students().length;
    const groupCount = this.studentService.groups().length;

    if (groupCount === 0) return errors;

    const maxStudentsPerGroup = Math.ceil(totalStudents / groupCount);

    conditions.forEach((condition) => {
      if (!condition.enabled) return;

      if (condition.type === "same-group" && condition.input) {
        const validationResult = this.validateSameGroupInput(
          condition.input,
          maxStudentsPerGroup
        );
        if (validationResult.error) {
          errors.push(`同組條件: ${validationResult.error}`);
        }
      }

      if (condition.type === "different-group" && condition.input) {
        const validationResult = this.validateDifferentGroupInput(
          condition.input,
          groupCount
        );
        if (validationResult.error) {
          errors.push(`不同組條件: ${validationResult.error}`);
        }
      }
    });

    // 檢查同組條件和不同組條件的邏輯衝突
    const sameGroupCondition = conditions.find(
      (c) => c.type === "same-group" && c.enabled
    );
    const differentGroupCondition = conditions.find(
      (c) => c.type === "different-group" && c.enabled
    );

    if (sameGroupCondition && differentGroupCondition) {
      const sameGroupInput = sameGroupCondition.input;
      const differentGroupInput = differentGroupCondition.input;

      if (sameGroupInput && differentGroupInput) {
        const sameGroupStudentIds = this.parseAllStudentIds(sameGroupInput);
        const differentGroupSegments = differentGroupInput
          .split(";")
          .map((segment) => segment.trim())
          .filter((segment) => segment.length > 0);

        const conflictingStudents = new Set<number>();

        for (const diffSegment of differentGroupSegments) {
          const diffStudentIds = this.parseStudentIds(diffSegment);
          const studentsInSameGroup = diffStudentIds.filter((id) =>
            sameGroupStudentIds.includes(id)
          );

          if (studentsInSameGroup.length >= 2) {
            studentsInSameGroup.forEach((id) => conflictingStudents.add(id));
          }
        }

        if (conflictingStudents.size > 0) {
          const conflictList = Array.from(conflictingStudents)
            .sort((a, b) => a - b)
            .join(", ");
          errors.push(
            `邏輯衝突：學生 ${conflictList} 不能同時滿足同組條件和不同組條件`
          );
        }
      }
    }

    return errors;
  });

  constructor(
    private dialogRef: MatDialogRef<GroupingConditionsDialogComponent>,
    private groupingConditionsService: GroupingConditionsService,
    private studentService: StudentService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    // 開始編輯時初始化編輯狀態
    this.groupingConditionsService.startEditing();
  }

  toggleCondition(conditionId: string, enabled: boolean) {
    this.groupingConditionsService.updateEditingCondition(conditionId, {
      enabled,
    });
  }

  updateConditionInput(conditionId: string, value: string) {
    this.groupingConditionsService.updateEditingCondition(conditionId, {
      input: value,
    });
  }

  // 區塊分配專用方法
  updateBlockInput(conditionId: string, blockIndex: number, value: string) {
    this.groupingConditionsService.updateBlockInput(
      conditionId,
      blockIndex,
      value
    );
  }

  addBlock(conditionId: string) {
    this.groupingConditionsService.addBlock(conditionId);
  }

  removeBlock(conditionId: string, blockIndex: number) {
    this.groupingConditionsService.removeBlock(conditionId, blockIndex);
  }

  isBlockDistribution(condition: GroupingConditionState): boolean {
    return condition.type === "block-distribution";
  }

  getConditionName(type: string): string {
    const names: { [key: string]: string } = {
      "same-group": "同組條件",
      "different-group": "不同組條件",
      "gender-ratio": "男女比例",
      "block-distribution": "區塊平均分配",
    };
    return names[type] || type;
  }

  getConditionPlaceholder(type: string): string {
    const placeholders: { [key: string]: string } = {
      "same-group": "例如: 1,2,3;4,7 (1,2,3同組；4,7同組)",
      "different-group": "例如: 1,2,3;4,7 (1,2,3不同組；4,7不同組)",
    };
    return placeholders[type] || "";
  }

  isConditionInputType(condition: GroupingConditionState): boolean {
    return (
      condition.type === "same-group" || condition.type === "different-group"
    );
  }

  hasConditionValidationError(condition: GroupingConditionState): boolean {
    if (!condition.enabled) return false;

    if (condition.type === "same-group") {
      return !!this.getSameGroupValidationError(condition.id);
    }

    if (condition.type === "different-group") {
      return !!this.getDifferentGroupValidationError(condition.id);
    }

    return this.validationErrors().some((error) =>
      error.includes(this.getConditionName(condition.type))
    );
  }

  getSameGroupValidationError(conditionId: string): string | null {
    const condition = this.editingConditions().find(
      (c) => c.id === conditionId
    );
    if (!condition || !condition.input) return null;

    const totalStudents = this.studentService.students().length;
    const groupCount = this.studentService.groups().length;
    const maxStudentsPerGroup = Math.ceil(totalStudents / groupCount);

    const result = this.validateSameGroupInput(
      condition.input,
      maxStudentsPerGroup
    );
    return result.error || null;
  }

  getDifferentGroupValidationError(conditionId: string): string | null {
    const condition = this.editingConditions().find(
      (c) => c.id === conditionId
    );
    if (!condition || !condition.input) return null;

    const groupCount = this.studentService.groups().length;
    const result = this.validateDifferentGroupInput(
      condition.input,
      groupCount
    );
    return result.error || null;
  }

  onSave() {
    if (this.validationErrors().length > 0) {
      this.snackBar.open("請先修正所有錯誤", "關閉", { duration: 3000 });
      return;
    }

    this.groupingConditionsService.saveConditions();
    this.snackBar.open("分組條件已保存", "關閉", { duration: 2000 });
    this.dialogRef.close(true);
  }

  onCancel() {
    this.groupingConditionsService.cancelEditing();
    this.dialogRef.close(false);
  }

  trackByConditionId(index: number, condition: GroupingConditionState): string {
    return condition.id;
  }

  trackByBlockIndex(index: number, blockInput: string): number {
    return index;
  }

  // 驗證方法（從原組件複製）
  private validateSameGroupInput(
    input: string,
    maxStudentsPerGroup: number
  ): { error?: string } {
    if (!input || input.trim() === "") {
      return {};
    }

    const trimmedInput = input.trim();

    if (!/^[\d,;\s]+$/.test(trimmedInput)) {
      return { error: "輸入格式錯誤，只能包含數字、逗號和分號" };
    }

    if (
      /[,;]{2,}/.test(trimmedInput) ||
      trimmedInput.startsWith(",") ||
      trimmedInput.endsWith(",") ||
      trimmedInput.startsWith(";") ||
      trimmedInput.endsWith(";")
    ) {
      return { error: "輸入格式錯誤，請使用格式: 1,2,3;4,7" };
    }

    try {
      const groups = trimmedInput
        .split(";")
        .map((group) => group.trim())
        .filter((group) => group.length > 0);

      const allStudentNumbers = new Set<number>();
      const crossGroupDuplicates = new Set<number>();

      for (const group of groups) {
        try {
          const students = this.parseStudentNumbers(group);
          if (students.length === 0) {
            return { error: `無效的群組格式: "${group}"` };
          }
          if (students.length > maxStudentsPerGroup) {
            return {
              error: `輸入人數超過每組人數上限 (${maxStudentsPerGroup}人)，群組 "${group}" 有 ${students.length} 人`,
            };
          }

          for (const studentNumber of students) {
            if (allStudentNumbers.has(studentNumber)) {
              crossGroupDuplicates.add(studentNumber);
            } else {
              allStudentNumbers.add(studentNumber);
            }
          }
        } catch (parseError: any) {
          return { error: `群組 "${group}" 有錯誤: ${parseError.message}` };
        }
      }

      if (crossGroupDuplicates.size > 0) {
        const duplicateList = Array.from(crossGroupDuplicates)
          .sort((a, b) => a - b)
          .join(",");
        return {
          error: `座號 ${duplicateList} 重複出現在不同組別中，請將這些學生分配到相同的組別`,
        };
      }
    } catch (error) {
      return { error: "輸入格式錯誤，請使用格式: 1,2,3;4,7" };
    }

    return {};
  }

  private validateDifferentGroupInput(
    input: string,
    totalGroups: number
  ): { error?: string } {
    if (!input || input.trim() === "") {
      return {};
    }

    const trimmedInput = input.trim();

    if (!/^[\d,;\s]+$/.test(trimmedInput)) {
      return { error: "輸入格式錯誤，只能包含數字、逗號和分號" };
    }

    if (
      /[,;]{2,}/.test(trimmedInput) ||
      trimmedInput.startsWith(",") ||
      trimmedInput.endsWith(",") ||
      trimmedInput.startsWith(";") ||
      trimmedInput.endsWith(";")
    ) {
      return { error: "輸入格式錯誤，請使用格式: 1,2,3;4,7" };
    }

    try {
      const groups = trimmedInput
        .split(";")
        .map((group) => group.trim())
        .filter((group) => group.length > 0);

      for (const group of groups) {
        const students = this.parseDifferentGroupNumbers(group);
        if (students.length === 0) {
          return { error: `無效的群組格式: "${group}"` };
        }

        const originalParts = group
          .split(",")
          .map((part) => parseInt(part.trim()))
          .filter((num) => !isNaN(num));
        const uniqueParts = [...new Set(originalParts)];
        if (originalParts.length !== uniqueParts.length) {
          return { error: `輸入到重複的號碼: "${group}"` };
        }

        if (students.length > totalGroups) {
          return {
            error: `${group}超過總組數（${totalGroups}組）`,
          };
        }
      }

      const allStudentNumbers: number[] = [];
      const duplicates = new Set<number>();

      for (const group of groups) {
        const students = this.parseDifferentGroupNumbers(group);
        for (const studentNum of students) {
          if (allStudentNumbers.includes(studentNum)) {
            duplicates.add(studentNum);
          } else {
            allStudentNumbers.push(studentNum);
          }
        }
      }

      if (duplicates.size > 0) {
        const duplicateList = Array.from(duplicates)
          .sort((a, b) => a - b)
          .join(",");
        return { error: `跨區塊重複的座號: ${duplicateList}` };
      }
    } catch (error) {
      return { error: "輸入格式錯誤，請使用格式: 1,2,3;4,7" };
    }

    return {};
  }

  private parseStudentNumbers(input: string): number[] {
    const numbers: number[] = [];
    const seenNumbers = new Set<number>();
    const duplicates = new Set<number>();

    const parts = input.split(",").map((part) => part.trim());

    for (const part of parts) {
      const num = parseInt(part);
      if (!isNaN(num)) {
        if (seenNumbers.has(num)) {
          duplicates.add(num);
        } else {
          seenNumbers.add(num);
          numbers.push(num);
        }
      }
    }

    if (duplicates.size > 0) {
      const duplicateList = Array.from(duplicates)
        .sort((a, b) => a - b)
        .join(",");
      throw new Error(`重複的座號: ${duplicateList}`);
    }

    return numbers.sort((a, b) => a - b);
  }

  private parseDifferentGroupNumbers(input: string): number[] {
    const numbers: number[] = [];
    const parts = input.split(",").map((part) => part.trim());

    for (const part of parts) {
      const num = parseInt(part);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }

    return [...new Set(numbers)].sort((a, b) => a - b);
  }

  private parseStudentIds(input: string): number[] {
    const numbers: number[] = [];
    const parts = input.split(",").map((part) => part.trim());

    for (const part of parts) {
      const num = parseInt(part);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }

    return numbers.sort((a, b) => a - b);
  }

  private parseAllStudentIds(input: string): number[] {
    const allStudentIds: number[] = [];
    const segments = input
      .split(";")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    for (const segment of segments) {
      const studentIds = this.parseStudentIds(segment);
      allStudentIds.push(...studentIds);
    }

    return allStudentIds;
  }
}
