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
      enabled: true,
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

  performGrouping(): void {
    const students = [...this.studentsSignal()];
    const groups = this.groupsSignal().map((g) => ({ ...g, students: [] }));

    console.log('🎯 開始分組流程');
    console.log('原始學生列表:', students);
    console.log('初始組別:', groups);

    // 從 GroupingConditionsService 獲取啟用的條件
    const enabledConditions =
      this.groupingConditionsService.getEnabledConditions();

    console.log('啟用的條件:', enabledConditions);

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

    console.log('轉換後的條件:', conditions);

    // Reset all students to not be leaders
    students.forEach((s) => (s.isLeader = false));

    // Setup Chain of Responsibility
    const blockDistributionHandler = new BlockDistributionHandler();
    const sameGroupHandler = new SameGroupHandler();
    const differentGroupHandler = new DifferentGroupHandler();
    const genderRatioHandler = new GenderRatioHandler();

    console.log('🔗 設置責任鏈');

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

    console.log('初始Context:', context);

    // Process through chain of responsibility
    console.log('🚀 開始責任鏈處理');
    const result = blockDistributionHandler.handle(context);

    console.log('責任鏈最終結果:', result);

    // 無論責任鏈是否處理，都要強制執行人數均分（最高優先級）
    let finalGroups: Group[];
    
    if (result.handled) {
      console.log('✅ 使用責任鏈結果作為基礎，但強制均分人數');
      finalGroups = result.groups;
    } else {
      console.log('⚠️ 沒有handler處理，使用空組別作為基礎');
      finalGroups = groups.map((g) => ({ ...g, students: [] }));
    }

    // 強制均分所有學生
    this.forceEqualDistribution(finalGroups, students);

    console.log('🎯 強制均分完成，最終分組結果:');
    finalGroups.forEach((group, index) => {
      const males = group.students.filter(s => s.gender === 'male').length;
      const females = group.students.filter(s => s.gender === 'female').length;
      console.log(`組別${index + 1}: ${group.students.length}人 (${males}男${females}女)`);
    });

    this.groupsSignal.set(finalGroups);
  }

  /**
   * 強制均分所有學生到各組，並盡量保持性別平衡
   */
  private forceEqualDistribution(groups: Group[], allStudents: Student[]): void {
    console.log('🎯 開始強制均分學生');
    
    // 收集所有已分組的學生（從責任鏈結果中）
    const assignedStudents: Student[] = [];
    groups.forEach(group => {
      assignedStudents.push(...group.students);
    });
    
    // 找出未分組的學生
    const unassignedStudents = allStudents.filter(student => 
      !assignedStudents.some(assigned => assigned.id === student.id)
    );
    
    // 合併所有學生重新分配
    const studentsToDistribute = [...assignedStudents, ...unassignedStudents];
    console.log(`總共需要分配 ${studentsToDistribute.length} 人到 ${groups.length} 組`);
    
    // 按性別分類並打亂
    const maleStudents = studentsToDistribute.filter(s => s.gender === 'male').sort(() => Math.random() - 0.5);
    const femaleStudents = studentsToDistribute.filter(s => s.gender === 'female').sort(() => Math.random() - 0.5);
    
    console.log(`男生: ${maleStudents.length}人, 女生: ${femaleStudents.length}人`);
    
    // 計算每組人數
    const totalStudents = studentsToDistribute.length;
    const groupCount = groups.length;
    const baseSize = Math.floor(totalStudents / groupCount);
    const extra = totalStudents % groupCount;
    
    console.log(`每組基本人數: ${baseSize}, 前${extra}組多1人`);
    
    // 清空所有組別
    groups.forEach(group => group.students = []);
    
    // 策略：先確保每組都有男生，再分配女生，最後補齊人數
    
    // 第一步：先給每組分配至少1個男生（如果有足夠男生）
    let maleIndex = 0;
    if (maleStudents.length >= groupCount) {
      console.log('🚹 第一輪：每組先分配1個男生');
      groups.forEach((group, groupIndex) => {
        if (maleIndex < maleStudents.length) {
          group.students.push(maleStudents[maleIndex]);
          console.log(`組別${groupIndex + 1}: 分配男生${maleStudents[maleIndex].id}`);
          maleIndex++;
        }
      });
    }
    
    // 第二步：輪流分配剩餘的男生
    console.log('🚹 第二輪：輪流分配剩餘男生');
    let currentGroupIndex = 0;
    while (maleIndex < maleStudents.length) {
      const group = groups[currentGroupIndex];
      group.students.push(maleStudents[maleIndex]);
      console.log(`組別${currentGroupIndex + 1}: 額外分配男生${maleStudents[maleIndex].id}`);
      maleIndex++;
      currentGroupIndex = (currentGroupIndex + 1) % groupCount;
    }
    
    // 第三步：輪流分配女生，確保每組達到目標人數
    console.log('🚺 第三輪：輪流分配女生直到各組達到目標人數');
    let femaleIndex = 0;
    currentGroupIndex = 0;
    
    // 計算每組還需要多少人
    const targetSizes = groups.map((_, index) => baseSize + (index < extra ? 1 : 0));
    
    while (femaleIndex < femaleStudents.length) {
      const group = groups[currentGroupIndex];
      const targetSize = targetSizes[currentGroupIndex];
      
      // 如果這組還沒達到目標人數，就分配女生
      if (group.students.length < targetSize) {
        group.students.push(femaleStudents[femaleIndex]);
        console.log(`組別${currentGroupIndex + 1}: 分配女生${femaleStudents[femaleIndex].id} (${group.students.length}/${targetSize})`);
        femaleIndex++;
      }
      
      currentGroupIndex = (currentGroupIndex + 1) % groupCount;
      
      // 檢查是否所有組都已經達到目標人數
      const allGroupsFull = groups.every((group, index) => group.students.length >= targetSizes[index]);
      if (allGroupsFull) {
        break;
      }
    }
    
    // 檢查分配結果
    console.log('📊 分配結果檢查:');
    groups.forEach((group, index) => {
      const males = group.students.filter(s => s.gender === 'male').length;
      const females = group.students.filter(s => s.gender === 'female').length;
      const targetSize = targetSizes[index];
      console.log(`組別${index + 1}: ${group.students.length}/${targetSize}人 (${males}男${females}女)`);
      
      // 按座號排序每個組別內的學生
      group.students.sort((a, b) => a.id - b.id);
    });
    
    // 最終檢查：如果還有學生沒分配完，補到人數不足的組
    const remainingMales = maleStudents.length - maleIndex;
    const remainingFemales = femaleStudents.length - femaleIndex;
    
    if (remainingMales > 0 || remainingFemales > 0) {
      console.log(`⚠️ 還有學生未分配: ${remainingMales}男${remainingFemales}女`);
      
      // 找出人數不足的組別
      groups.forEach((group, index) => {
        const targetSize = targetSizes[index];
        while (group.students.length < targetSize && (maleIndex < maleStudents.length || femaleIndex < femaleStudents.length)) {
          if (maleIndex < maleStudents.length) {
            group.students.push(maleStudents[maleIndex]);
            console.log(`補充：組別${index + 1}加入男生${maleStudents[maleIndex].id}`);
            maleIndex++;
          } else if (femaleIndex < femaleStudents.length) {
            group.students.push(femaleStudents[femaleIndex]);
            console.log(`補充：組別${index + 1}加入女生${femaleStudents[femaleIndex].id}`);
            femaleIndex++;
          }
        }
        // 重新排序
        group.students.sort((a, b) => a.id - b.id);
      });
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
    const tableRows = groups.map((group) => {
      const students = [...group.students];

      // Sort so leader comes first
      students.sort((a, b) => {
        if (a.isLeader && !b.isLeader) return -1;
        if (!a.isLeader && b.isLeader) return 1;
        return a.id - b.id;
      });

      const formattedStudents =
        students.length > 0
          ? students.map((s) => {
              const label = `${s.gender === "male" ? "男" : "女"}${s.id}${
                s.isLeader ? "（組長）" : ""
              }`;
              const bgColor = s.gender === "male" ? "#dbeafe" : "#ffe4e6";
              const textColor = s.gender === "male" ? "#1d4ed8" : "#be185d";

              return {
                text: label,
                html: `<div style="display:inline-block;margin:4px 6px 4px 0;padding:8px 16px;border-radius:9999px;font-size:22px;font-weight:700;background:${bgColor};color:${textColor};">${label}</div>`,
              };
            })
          : [
              {
                text: "尚未分配學生",
                html: `<div style="padding:8px 12px;color:#4b5563;">尚未分配學生</div>`,
              },
            ];

      return {
        groupName: group.name,
        studentsText: formattedStudents.map((student) => student.text).join("、"),
        studentsHtml: formattedStudents
          .map((student) => student.html)
          .join(""),
      };
    });

    const tableHtml = `
      <div style="width:100%;padding:16px;box-sizing:border-box;">
        <h2 style="text-align:center;font-size:32px;margin-bottom:16px;font-family:'Microsoft JhengHei',Arial,sans-serif;">分組結果</h2>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-family:'Microsoft JhengHei',Arial,sans-serif;font-size:24px;">
          <thead>
            <tr>
              <th style="width:25%;border:2px solid #4b5563;padding:12px;background:#e5e7eb;">組別</th>
              <th style="border:2px solid #4b5563;padding:12px;background:#e5e7eb;">學生</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row, index) => `
                  <tr>
                    <td style="border:2px solid #9ca3af;padding:14px;font-weight:600;text-align:center;background:${
                      index % 2 === 0 ? "#ffffff" : "#f9fafb"
                    };">${row.groupName}</td>
                    <td style="border:2px solid #9ca3af;padding:14px;vertical-align:top;background:${
                      index % 2 === 0 ? "#ffffff" : "#f9fafb"
                    };">${row.studentsHtml}</td>
                  </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `.trim();

    const plainText = tableRows
      .map((row) => `${row.groupName}\t${row.studentsText}`)
      .join("\n");

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      if ("write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
        const htmlBlob = new Blob([tableHtml], { type: "text/html" });
        const textBlob = new Blob([plainText], { type: "text/plain" });

        navigator.clipboard.write([
          new ClipboardItem({
            "text/html": htmlBlob,
            "text/plain": textBlob,
          }),
        ]);
      } else if (navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plainText);
      }
    }

    return plainText;
  }
}
