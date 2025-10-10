import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
import { CommonModule } from "@angular/common";
import { Component, computed, effect, OnInit, signal } from "@angular/core";
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
  selector: "app-home",
  imports: [
    DragDropModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    FormsModule,
    CommonModule,
  ],
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
})
export class HomeComponent implements OnInit {
  // Original home page signals
  maleInput = signal("");
  femaleInput = signal("");
  groupCount = signal(5);
  errorMessage = signal("");

  // Track which input was last modified
  lastModifiedInput = signal<"male" | "female" | null>(null);

  // Validation signals
  maleInputErrors = signal<string[]>([]);
  femaleInputErrors = signal<string[]>([]);
  duplicateNumbers = signal<number[]>([]);

  // Grouping page signals
  newMaleInput = signal("");
  newFemaleInput = signal("");
  absentInput = signal("");
  isLoading = signal(false);
  isDragOver = signal(false);
  hasGrouped = signal(false); // 跟蹤是否已經執行過分組

  constructor(
    private studentService: StudentService,
    private groupingConditionsService: GroupingConditionsService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    // Watch for input changes to update preview automatically
    effect(() => {
      this.updatePreview();
    });
  }

  previewStudents = signal<Array<{ id: number; gender: "male" | "female" }>>(
    []
  );

  ngOnInit() {
    // Initial preview update is handled by the effect
  }

  // Computed properties from grouping page
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

  private updatePreview() {
    // Reset validation errors
    this.maleInputErrors.set([]);
    this.femaleInputErrors.set([]);
    this.duplicateNumbers.set([]);
    this.errorMessage.set("");

    try {
      let maleNumbers: number[] = [];
      let femaleNumbers: number[] = [];

      // Parse male input
      try {
        if (this.maleInput().trim()) {
          maleNumbers = this.studentService.parseNumberInput(this.maleInput());
        }
      } catch (error) {
        this.maleInputErrors.set(["輸入格式錯誤"]);
      }

      // Parse female input
      try {
        if (this.femaleInput().trim()) {
          femaleNumbers = this.studentService.parseNumberInput(
            this.femaleInput()
          );
        }
      } catch (error) {
        this.femaleInputErrors.set(["輸入格式錯誤"]);
      }

      // Check for duplicates between male and female
      const duplicates = maleNumbers.filter((num) =>
        femaleNumbers.includes(num)
      );

      if (duplicates.length > 0) {
        this.duplicateNumbers.set(duplicates);

        // Only show error on the input that was last modified
        if (this.lastModifiedInput() === "male") {
          this.maleInputErrors.set([
            `座號 ${duplicates.join(", ")} 與女生重複`,
          ]);
        } else if (this.lastModifiedInput() === "female") {
          this.femaleInputErrors.set([
            `座號 ${duplicates.join(", ")} 與男生重複`,
          ]);
        }
      }

      // Create students list only if no errors
      if (
        this.maleInputErrors().length === 0 &&
        this.femaleInputErrors().length === 0
      ) {
        const students = [
          ...maleNumbers.map((id) => ({ id, gender: "male" as const })),
          ...femaleNumbers.map((id) => ({ id, gender: "female" as const })),
        ].sort((a, b) => a.id - b.id);

        this.previewStudents.set(students);
      } else {
        this.previewStudents.set([]);
      }
    } catch (error) {
      this.errorMessage.set("發生未知錯誤");
      this.previewStudents.set([]);
    }
  }

  canInitialize(): boolean {
    return (
      (this.maleInput().trim() !== "" || this.femaleInput().trim() !== "") &&
      this.groupCount() >= 2 &&
      this.previewStudents().length > 0 &&
      this.maleInputErrors().length === 0 &&
      this.femaleInputErrors().length === 0 &&
      this.duplicateNumbers().length === 0
    );
  }

  initializeFromInputs() {
    try {
      this.updatePreview();

      if (this.previewStudents().length === 0) {
        this.errorMessage.set("請至少輸入一位學生");
        return;
      }

      if (this.previewStudents().length < this.groupCount()) {
        this.errorMessage.set("學生人數不能少於分組數量");
        return;
      }

      // Initialize students and groups in service
      this.studentService.initializeStudents(
        this.maleInput(),
        this.femaleInput()
      );
      this.studentService.initializeGroups(this.groupCount());
      
      // 重置分組狀態
      this.hasGrouped.set(false);

      this.snackBar.open("學生與分組已載入", "關閉", { duration: 3000 });
    } catch (error) {
      this.errorMessage.set("發生錯誤，請檢查輸入格式");
    }
  }

  updateGroupCount() {
    if (this.groups().length > 0) {
      this.studentService.initializeGroups(this.groupCount());
      // 當分組數量改變時，重置分組狀態
      this.hasGrouped.set(false);
    }
  }

  // Grouping page methods
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

  addMaleStudents() {
    try {
      this.studentService.addStudents(this.newMaleInput(), "male");
      this.newMaleInput.set("");
      this.hasGrouped.set(false); // 重置分組狀態
      this.snackBar.open("男生已新增", "關閉", { duration: 3000 });
    } catch (error: any) {
      this.snackBar.open(error.message, "關閉", { duration: 3000 });
    }
  }

  addFemaleStudents() {
    try {
      this.studentService.addStudents(this.newFemaleInput(), "female");
      this.newFemaleInput.set("");
      this.hasGrouped.set(false); // 重置分組狀態
      this.snackBar.open("女生已新增", "關閉", { duration: 3000 });
    } catch (error: any) {
      this.snackBar.open(error.message, "關閉", { duration: 3000 });
    }
  }

  setAbsentStudents() {
    try {
      this.studentService.setAbsentStudents(this.absentInput());
      this.hasGrouped.set(false); // 重置分組狀態
      this.snackBar.open("已設定缺席學生", "關閉", { duration: 3000 });
    } catch (error: any) {
      this.snackBar.open("設定失敗", "關閉", { duration: 3000 });
    }
  }

  removeStudent(studentId: number) {
    this.studentService.removeStudent(studentId);
    this.hasGrouped.set(false); // 重置分組狀態
    this.snackBar.open("學生已移除", "關閉", { duration: 2000 });
  }

  async performGrouping() {
    this.isLoading.set(true);

    // Simulate 2 seconds loading
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      // 現在 StudentService 會直接從 GroupingConditionsService 獲取條件
      this.studentService.performGrouping();
      this.hasGrouped.set(true); // 設置已完成分組狀態
      this.snackBar.open("分組完成！", "關閉", { duration: 3000 });
    } catch (error: any) {
      this.snackBar.open("分組失敗: " + error.message, "關閉", {
        duration: 3000,
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  // 重新分組方法
  async regroupStudents() {
    await this.performGrouping();
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

  // Helper methods
  hasNoStudentsInGroups(): boolean {
    return this.groups().every((g) => g.students.length === 0);
  }

  getGenderDistribution(group: Group): string {
    const males = group.students.filter((s) => s.gender === "male").length;
    const females = group.students.filter((s) => s.gender === "female").length;
    return males > 0 || females > 0 ? ` (男${males}/女${females})` : "";
  }

  getStudentGenderClass(student: Student): string {
    return student.gender === "male"
      ? "bg-blue-100 text-blue-800"
      : "bg-pink-100 text-pink-800";
  }

  getStudentCardClass(student: Student): string {
    if (student.isLeader) {
      return student.gender === "male"
        ? "bg-yellow-100 text-yellow-900 border-2 border-yellow-300"
        : "bg-yellow-100 text-yellow-900 border-2 border-yellow-300";
    }
    return student.gender === "male"
      ? "bg-blue-100 text-blue-800"
      : "bg-pink-100 text-pink-800";
  }

  // TrackBy functions
  trackByStudentId(index: number, student: Student): number {
    return student.id;
  }

  trackByGroupId(index: number, group: Group): string {
    return group.id;
  }

  onMaleInputChange() {
    this.lastModifiedInput.set("male");
  }

  onFemaleInputChange() {
    this.lastModifiedInput.set("female");
  }
}
