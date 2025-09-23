import { computed, inject, Injectable, signal } from "@angular/core";
import { GroupingContext } from "../models/grouping-handler.model";
import {
  Block,
  Group,
  GroupingCondition,
  Student,
} from "../models/student.model";
import { GroupingConditionsService } from "./grouping-conditions.service";
import { BlockDistributionHandler } from "./handlers/block-distribution-handler";
import { DifferentGroupHandler } from "./handlers/different-group-handler";
import { GenderRatioHandler } from "./handlers/gender-ratio-handler";
import { SameGroupHandler } from "./handlers/same-group-handler";

@Injectable({
  providedIn: "root",
})
export class StudentService {
  private groupingConditionsService = inject(GroupingConditionsService);
  private studentsSignal = signal<Student[]>([]);
  private groupsSignal = signal<Group[]>([]);
  private conditionsSignal = signal<GroupingCondition[]>([
    {
      id: "same-group",
      type: "same-group",
      enabled: false,
      priority: 1,
      config: { pairs: [] },
    },
    {
      id: "different-group",
      type: "different-group",
      enabled: false,
      priority: 2,
      config: { groups: [] },
    },
    {
      id: "gender-ratio",
      type: "gender-ratio",
      enabled: false,
      priority: 3,
      config: { type: "auto" },
    },
    {
      id: "block-distribution",
      type: "block-distribution",
      enabled: false,
      priority: 4,
      config: { enabled: false },
    },
  ]);
  private blocksSignal = signal<Block[]>([
    {
      id: "default",
      name: "預設區塊",
      students: [],
    },
  ]);
  private absentStudentsSignal = signal<number[]>([]);

  // Computed signals
  students = computed(() => this.studentsSignal());
  groups = computed(() => this.groupsSignal());
  conditions = computed(() => this.conditionsSignal());
  blocks = computed(() => this.blocksSignal());
  absentStudents = computed(() => this.absentStudentsSignal());

  // Helper methods
  parseNumberInput(input: string): number[] {
    const numbers: number[] = [];
    const parts = input.split(",").map((part) => part.trim());

    for (const part of parts) {
      if (part.includes("-")) {
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

    return [...new Set(numbers)].sort((a, b) => a - b);
  }

  initializeStudents(maleInput: string, femaleInput: string): void {
    const maleNumbers = this.parseNumberInput(maleInput);
    const femaleNumbers = this.parseNumberInput(femaleInput);

    const students: Student[] = [
      ...maleNumbers.map((id) => ({
        id,
        gender: "male" as const,
        isLeader: false,
      })),
      ...femaleNumbers.map((id) => ({
        id,
        gender: "female" as const,
        isLeader: false,
      })),
    ].sort((a, b) => a.id - b.id);

    this.studentsSignal.set(students);

    // Initialize default block with all students
    this.blocksSignal.update((blocks) => [
      {
        ...blocks[0],
        students: [...students],
      },
    ]);
  }

  initializeGroups(groupCount: number): void {
    const groups: Group[] = Array.from({ length: groupCount }, (_, i) => ({
      id: `group-${i + 1}`,
      name: `組別${i + 1}`,
      students: [],
    }));

    this.groupsSignal.set(groups);
  }

  removeStudent(studentId: number): void {
    this.studentsSignal.update((students) =>
      students.filter((s) => s.id !== studentId)
    );
    this.updateBlocksAfterStudentChange();
  }

  addStudents(input: string, gender: "male" | "female"): void {
    const newNumbers = this.parseNumberInput(input);
    const existingIds = this.studentsSignal().map((s) => s.id);
    const duplicates = newNumbers.filter((id) => existingIds.includes(id));

    if (duplicates.length > 0) {
      throw new Error(`座號 ${duplicates.join(", ")} 已存在`);
    }

    const newStudents = newNumbers.map((id) => ({
      id,
      gender,
      isLeader: false,
    }));
    this.studentsSignal.update((students) =>
      [...students, ...newStudents].sort((a, b) => a.id - b.id)
    );
    this.updateBlocksAfterStudentChange();
  }

  setAbsentStudents(input: string): void {
    const absentIds = this.parseNumberInput(input);
    this.absentStudentsSignal.set(absentIds);

    // Remove absent students from the active student list
    this.studentsSignal.update((students) =>
      students.filter((s) => !absentIds.includes(s.id))
    );
    this.updateBlocksAfterStudentChange();
  }

  private updateBlocksAfterStudentChange(): void {
    const currentStudents = this.studentsSignal();
    this.blocksSignal.update((blocks) =>
      blocks.map((block) => ({
        ...block,
        students: block.students.filter((s) =>
          currentStudents.some((cs) => cs.id === s.id)
        ),
      }))
    );
  }

  updateCondition(
    conditionId: string,
    updates: Partial<GroupingCondition>
  ): void {
    this.conditionsSignal.update((conditions) =>
      conditions.map((c) => (c.id === conditionId ? { ...c, ...updates } : c))
    );
  }

  validateConditions(): string[] {
    const errors: string[] = [];
    const conditions = this.conditionsSignal().filter((c) => c.enabled);
    const groupCount = this.groupsSignal().length;

    // Validate different-group condition
    const differentGroupCondition = conditions.find(
      (c) => c.type === "different-group"
    );
    if (differentGroupCondition) {
      const groups = differentGroupCondition.config.groups || [];
      for (const group of groups) {
        if (group.length > groupCount) {
          errors.push(
            `不同組條件中有 ${group.length} 個人需要分在不同組，但只有 ${groupCount} 個組別`
          );
        }
      }
    }

    return errors;
  }

  performGrouping(conditionInputs: { [key: string]: string } = {}): void {
    const students = [...this.studentsSignal()];
    const groups = this.groupsSignal().map((g) => ({ ...g, students: [] }));

    // 從 GroupingConditionsService 獲取啟用的條件
    const enabledConditions =
      this.groupingConditionsService.getEnabledConditions();

    // 轉換為舊格式的條件對象
    const conditions: GroupingCondition[] = enabledConditions.map(
      (condition, index) => ({
        id: condition.id,
        type: condition.type as
          | "same-group"
          | "different-group"
          | "gender-ratio"
          | "block-distribution",
        enabled: condition.enabled,
        priority: index + 1,
        config: {
          input: condition.input,
          blockInputs: condition.blockInputs, // 傳遞 blockInputs
        },
      })
    );

    // Reset all students to not be leaders
    students.forEach((s) => (s.isLeader = false));

    // Setup Chain of Responsibility
    const blockDistributionHandler = new BlockDistributionHandler();
    const sameGroupHandler = new SameGroupHandler();
    const differentGroupHandler = new DifferentGroupHandler();
    const genderRatioHandler = new GenderRatioHandler();

    // 設置處理鏈：區塊分配 -> 同組條件 -> 不同組條件 -> 性別比例
    blockDistributionHandler.setNext(sameGroupHandler);
    sameGroupHandler.setNext(differentGroupHandler);
    differentGroupHandler.setNext(genderRatioHandler);

    // Create grouping context
    const context: GroupingContext = {
      students: [...students],
      groups: groups.map((g) => ({ ...g, students: [] })),
      conditions: conditions,
      remainingStudents: [...students],
    };

    // Process through chain of responsibility
    const result = blockDistributionHandler.handle(context);

    // If no handler processed the grouping, fall back to simple random distribution
    if (!result.handled) {
      const shuffled = [...students].sort(() => Math.random() - 0.5);
      shuffled.forEach((student, index) => {
        const groupIndex = index % groups.length;
        groups[groupIndex].students.push(student);
      });

      // 按座號排序每個組別內的學生
      groups.forEach((group) => {
        group.students.sort((a, b) => a.id - b.id);
      });

      this.groupsSignal.set(groups);
    } else {
      // Use the result from the handler chain
      // 按座號排序每個組別內的學生
      result.groups.forEach((group) => {
        group.students.sort((a, b) => a.id - b.id);
      });

      this.groupsSignal.set(result.groups);
    }
  }

  moveStudentToGroup(
    studentId: number,
    fromGroupId: string,
    toGroupId: string
  ): void {
    if (fromGroupId === "available" || toGroupId === "available") {
      // 當涉及到 available 學生列表時，不需要在這裡處理
      // 因為 availableStudents 是 computed，會自動更新
      // 我們只需要更新組別中的學生
      if (fromGroupId !== "available" && toGroupId === "available") {
        // 從組別移除學生
        this.groupsSignal.update((groups) => {
          const fromGroup = groups.find((g) => g.id === fromGroupId);
          if (fromGroup) {
            // 創建新的 students 數組引用以觸發 signal 變化檢測
            fromGroup.students = fromGroup.students.filter(
              (s) => s.id !== studentId
            );
          }
          // 返回新的 groups 數組以確保引用變化
          return [...groups];
        });
      } else if (fromGroupId === "available" && toGroupId !== "available") {
        // 添加學生到組別
        this.groupsSignal.update((groups) => {
          const toGroup = groups.find((g) => g.id === toGroupId);
          const student = this.studentsSignal().find((s) => s.id === studentId);
          if (toGroup && student) {
            // 創建新的 students 數組引用以觸發 signal 變化檢測
            toGroup.students = [...toGroup.students, student];
          }
          // 返回新的 groups 數組以確保引用變化
          return [...groups];
        });
      }
    } else {
      // 組別之間移動
      this.groupsSignal.update((groups) => {
        const fromGroup = groups.find((g) => g.id === fromGroupId);
        const toGroup = groups.find((g) => g.id === toGroupId);

        if (fromGroup && toGroup) {
          const studentIndex = fromGroup.students.findIndex(
            (s) => s.id === studentId
          );
          if (studentIndex !== -1) {
            const student = fromGroup.students[studentIndex];
            // 創建新的數組引用以觸發 signal 變化檢測
            fromGroup.students = fromGroup.students.filter(
              (s) => s.id !== studentId
            );
            toGroup.students = [...toGroup.students, student];
          }
        }

        // 返回新的 groups 數組以確保引用變化
        return [...groups];
      });
    }
  }

  toggleLeader(groupId: string, studentId: number): void {
    this.groupsSignal.update((groups) => {
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        group.students.forEach((s) => {
          if (s.id === studentId) {
            s.isLeader = !s.isLeader;
          } else {
            s.isLeader = false; // Only one leader per group
          }
        });

        // Sort students so leader comes first, then by student ID
        group.students.sort((a, b) => {
          if (a.isLeader && !b.isLeader) return -1;
          if (!a.isLeader && b.isLeader) return 1;
          return a.id - b.id;
        });
      }
      return groups;
    });
  }

  selectRandomLeaders(): void {
    this.groupsSignal.update((groups) => {
      groups.forEach((group) => {
        // Reset all leaders
        group.students.forEach((s) => (s.isLeader = false));

        // Select random leader if group has students
        if (group.students.length > 0) {
          const randomIndex = Math.floor(Math.random() * group.students.length);
          group.students[randomIndex].isLeader = true;

          // Sort students so leader comes first, then by student ID
          group.students.sort((a, b) => {
            if (a.isLeader && !b.isLeader) return -1;
            if (!a.isLeader && b.isLeader) return 1;
            return a.id - b.id;
          });
        }
      });
      return groups;
    });
  }

  copyGroupsToClipboard(): string {
    const groups = this.groupsSignal();
    const result = groups
      .map((group) => {
        const students = [...group.students];

        // Sort so leader comes first
        students.sort((a, b) => {
          if (a.isLeader && !b.isLeader) return -1;
          if (!a.isLeader && b.isLeader) return 1;
          return a.id - b.id;
        });

        const studentIds = students.map((s) => s.id).join(",");
        return `${group.name}: [${studentIds}]`;
      })
      .join(", ");

    navigator.clipboard.writeText(result);
    return result;
  }
}
