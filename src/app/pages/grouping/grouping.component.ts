import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
import { CommonModule } from "@angular/common";
import { Component, computed, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";
import { GroupingConditionsDialogComponent } from "../../components/grouping-conditions-dialog/grouping-conditions-dialog.component";
import { Group, Student } from "../../models/student.model";
import { GroupingConditionsService } from "../../services/grouping-conditions.service";
import { StudentService } from "../../services/student.service";

@Component({
  selector: "app-grouping",
  imports: [
    DragDropModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    FormsModule,
    CommonModule,
  ],
  templateUrl: "./grouping.component.html",
  styleUrl: "./grouping.component.scss",
})
export class GroupingComponent implements OnInit {
  newMaleInput = signal("");
  newFemaleInput = signal("");
  absentInput = signal("");
  isLoading = signal(false);
  isDragOver = signal(false);

  constructor(
    private studentService: StudentService,
    private groupingConditionsService: GroupingConditionsService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    // 不需要初始化 conditionInputs，這些現在由 GroupingConditionsService 管理
  }

  // Computed properties
  students = this.studentService.students;
  groups = this.studentService.groups;
  conditions = this.studentService.conditions;

  availableStudents = computed(() => {
    const allStudents = this.students();
    const groupedStudents = this.groups().flatMap((g) =>
      g.students.map((s) => s.id)
    );
    return allStudents.filter((s) => !groupedStudents.includes(s.id));
  });

  // 獲取啟用的條件數量
  enabledConditionsCount = computed(() => {
    return this.groupingConditionsService.getEnabledConditions().length;
  });

  openConditionsDialog() {
    const dialogRef = this.dialog.open(GroupingConditionsDialogComponent, {
      width: "600px",
      maxHeight: "80vh",
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // 保存了條件，可能需要重新分組或顯示提示
        this.snackBar.open("分組條件已更新", "關閉", { duration: 2000 });
      }
    });
  }

  goBack() {
    this.router.navigate(["/"]);
  }

  addMaleStudents() {
    try {
      this.studentService.addStudents(this.newMaleInput(), "male");
      this.newMaleInput.set("");
      this.snackBar.open("男生已新增", "關閉", { duration: 3000 });
    } catch (error: any) {
      this.snackBar.open(error.message, "關閉", { duration: 3000 });
    }
  }

  addFemaleStudents() {
    try {
      this.studentService.addStudents(this.newFemaleInput(), "female");
      this.newFemaleInput.set("");
      this.snackBar.open("女生已新增", "關閉", { duration: 3000 });
    } catch (error: any) {
      this.snackBar.open(error.message, "關閉", { duration: 3000 });
    }
  }

  setAbsentStudents() {
    try {
      this.studentService.setAbsentStudents(this.absentInput());
      this.snackBar.open("已設定缺席學生", "關閉", { duration: 3000 });
    } catch (error: any) {
      this.snackBar.open("設定失敗", "關閉", { duration: 3000 });
    }
  }

  removeStudent(studentId: number) {
    this.studentService.removeStudent(studentId);
    this.snackBar.open("學生已移除", "關閉", { duration: 2000 });
  }

  async performGrouping() {
    this.isLoading.set(true);

    // Simulate 2 seconds loading
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      // 現在 StudentService 會直接從 GroupingConditionsService 獲取條件
      this.studentService.performGrouping();
      this.snackBar.open("分組完成！", "關閉", { duration: 3000 });
    } catch (error: any) {
      this.snackBar.open("分組失敗: " + error.message, "關閉", {
        duration: 3000,
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  onDrop(event: CdkDragDrop<Student[]>) {
    if (event.previousContainer === event.container) {
      // 同一個容器內的重新排序
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      // 跨容器移動
      const student = event.previousContainer.data[event.previousIndex];
      const fromGroupId = event.previousContainer.id || "available";
      const toGroupId = event.container.id || "available";

      // 只使用 service 的方法來移動學生，不要同時使用 transferArrayItem
      // UI 會通過 signal 自動更新
      this.studentService.moveStudentToGroup(
        student.id,
        fromGroupId,
        toGroupId
      );
    }
  }

  toggleLeader(groupId: string, studentId: number) {
    this.studentService.toggleLeader(groupId, studentId);
  }

  selectRandomLeaders() {
    this.studentService.selectRandomLeaders();
    this.snackBar.open("已隨機選取組長", "關閉", { duration: 3000 });
  }

  copyResults() {
    const result = this.studentService.copyGroupsToClipboard();
    this.snackBar.open("分組結果已複製到剪貼簿", "關閉", { duration: 3000 });
  }

  // TrackBy functions
  trackByStudentId(index: number, student: Student): number {
    return student.id;
  }

  trackByGroupId(index: number, group: Group): string {
    return group.id;
  }

  trackByConditionId(index: number, condition: any): string {
    return condition.id;
  }

  trackByError(index: number, error: string): string {
    return error;
  }

  // Helper methods for template
  hasNoStudentsInGroups(): boolean {
    return this.groups().every((g) => g.students.length === 0);
  }

  getStudentGenderClass(student: Student): string {
    return student.gender === "male"
      ? "bg-blue-100 text-blue-800 border border-blue-300"
      : "bg-pink-100 text-pink-800 border border-pink-300";
  }

  getStudentCardClass(student: Student): string {
    const baseClass =
      student.gender === "male"
        ? "bg-blue-100 text-blue-800"
        : "bg-pink-100 text-pink-800";

    const leaderClass = student.isLeader
      ? " leader-card ring-2 ring-yellow-400"
      : "";

    return baseClass + leaderClass;
  }

  getGenderDistribution(group: Group): string {
    const maleCount = group.students.filter((s) => s.gender === "male").length;
    const femaleCount = group.students.filter(
      (s) => s.gender === "female"
    ).length;

    if (maleCount === 0 && femaleCount === 0) {
      return "";
    }

    const parts: string[] = [];
    if (maleCount > 0) parts.push(`${maleCount}男`);
    if (femaleCount > 0) parts.push(`${femaleCount}女`);

    return `(${parts.join("")})`;
  }

  isConditionInputType(condition: any): boolean {
    return (
      condition.type === "same-group" || condition.type === "different-group"
    );
  }

  validateSameGroupInput(
    input: string,
    maxStudentsPerGroup: number
  ): { error?: string } {
    if (!input || input.trim() === "") {
      return {};
    }

    const trimmedInput = input.trim();

    // 檢查基本格式：只允許數字、逗號和分號
    if (!/^[\d,;\s]+$/.test(trimmedInput)) {
      return { error: "輸入格式錯誤，只能包含數字、逗號和分號" };
    }

    // 檢查是否有連續的逗號或分號
    if (
      /[,;]{2,}/.test(trimmedInput) ||
      trimmedInput.startsWith(",") ||
      trimmedInput.endsWith(",") ||
      trimmedInput.startsWith(";") ||
      trimmedInput.endsWith(";")
    ) {
      return { error: "輸入格式錯誤，請使用格式: 1,2,3;4,7" };
    }

    // 解析輸入並檢查每組人數
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

          // 檢查跨組別重複
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

      // 如果有跨組別重複，回傳錯誤
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

  parseStudentNumbers(input: string): number[] {
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

  parseStudentIds(input: string): number[] {
    // 簡化版本的 parseStudentNumbers，只解析數字不檢查重複
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

  parseAllStudentIds(input: string): number[] {
    // 解析同組條件中的所有學生ID（跨所有組別）
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
