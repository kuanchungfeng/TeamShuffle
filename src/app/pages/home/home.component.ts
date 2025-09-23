import { CommonModule } from "@angular/common";
import { Component, effect, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { Router } from "@angular/router";
import { StudentService } from "../../services/student.service";

@Component({
  selector: "app-home",
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    FormsModule,
    CommonModule,
  ],
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
})
export class HomeComponent implements OnInit {
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

  constructor(private studentService: StudentService, private router: Router) {
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

  canStartGrouping(): boolean {
    return (
      (this.maleInput().trim() !== "" || this.femaleInput().trim() !== "") &&
      this.groupCount() >= 2 &&
      this.previewStudents().length > 0 &&
      this.maleInputErrors().length === 0 &&
      this.femaleInputErrors().length === 0 &&
      this.duplicateNumbers().length === 0
    );
  }

  startGrouping() {
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

      // Navigate to grouping page
      this.router.navigate(["/grouping"]);
    } catch (error) {
      this.errorMessage.set("發生錯誤，請檢查輸入格式");
    }
  }

  trackByStudentId(
    index: number,
    student: { id: number; gender: "male" | "female" }
  ): number {
    return student.id;
  }

  onMaleInputChange() {
    this.lastModifiedInput.set("male");
  }

  onFemaleInputChange() {
    this.lastModifiedInput.set("female");
  }
}
