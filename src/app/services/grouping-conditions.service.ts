import { Injectable, signal } from "@angular/core";

export interface GroupingConditionState {
  id: string;
  type: string;
  enabled: boolean;
  input: string;
  blockInputs?: string[]; // 用於區塊分配的多個輸入
}

@Injectable({
  providedIn: "root",
})
export class GroupingConditionsService {
  // 當前保存的分組條件狀態
  private savedConditions = signal<GroupingConditionState[]>([
    {
      id: "block-distribution",
      type: "block-distribution",
      enabled: false,
      input: "",
      blockInputs: ["", "", ""], // 預設三個區塊
    },
    { id: "same-group", type: "same-group", enabled: false, input: "" },
    {
      id: "different-group",
      type: "different-group",
      enabled: false,
      input: "",
    },
    { id: "gender-ratio", type: "gender-ratio", enabled: false, input: "" },
  ]);

  // 臨時編輯狀態（用於 dialog）
  private editingConditions = signal<GroupingConditionState[]>([]);

  constructor() {}

  // 取得當前保存的條件
  getSavedConditions() {
    return this.savedConditions.asReadonly();
  }

  // 取得正在編輯的條件
  getEditingConditions() {
    return this.editingConditions.asReadonly();
  }

  // 開始編輯（複製當前狀態到編輯狀態）
  startEditing() {
    const current = this.savedConditions();
    this.editingConditions.set(current.map((condition) => ({ ...condition })));
  }

  // 更新編輯中的條件
  updateEditingCondition(
    conditionId: string,
    updates: Partial<GroupingConditionState>
  ) {
    const currentEditing = this.editingConditions();
    const updatedConditions = currentEditing.map((condition) =>
      condition.id === conditionId ? { ...condition, ...updates } : condition
    );
    this.editingConditions.set(updatedConditions);
  }

  // 保存編輯的條件
  saveConditions() {
    const editingConditions = this.editingConditions();
    this.savedConditions.set(
      editingConditions.map((condition) => ({ ...condition }))
    );
  }

  // 取消編輯
  cancelEditing() {
    this.editingConditions.set([]);
  }

  // 取得特定條件的狀態
  getConditionState(conditionId: string): GroupingConditionState | undefined {
    return this.savedConditions().find((c) => c.id === conditionId);
  }

  // 取得所有啟用的條件
  getEnabledConditions(): GroupingConditionState[] {
    return this.savedConditions().filter((c) => c.enabled);
  }

  // 重置所有條件
  resetConditions() {
    this.savedConditions.set([
      {
        id: "block-distribution",
        type: "block-distribution",
        enabled: false,
        input: "",
        blockInputs: ["", "", ""],
      },
      { id: "same-group", type: "same-group", enabled: false, input: "" },
      {
        id: "different-group",
        type: "different-group",
        enabled: false,
        input: "",
      },
      { id: "gender-ratio", type: "gender-ratio", enabled: false, input: "" },
    ]);
  }

  // 區塊分配專用方法
  updateBlockInput(conditionId: string, blockIndex: number, value: string) {
    const currentEditing = this.editingConditions();
    const condition = currentEditing.find((c) => c.id === conditionId);

    // 檢查值是否實際改變
    if (condition?.blockInputs?.[blockIndex] === value) {
      return; // 值沒有改變，不需要更新
    }

    const updatedConditions = currentEditing.map((condition) => {
      if (condition.id === conditionId && condition.blockInputs) {
        const newBlockInputs = [...condition.blockInputs];
        newBlockInputs[blockIndex] = value;
        // 更新合併的 input 用於處理器
        const input = newBlockInputs.filter((block) => block.trim()).join("\n");
        return { ...condition, blockInputs: newBlockInputs, input };
      }
      return condition;
    });
    this.editingConditions.set(updatedConditions);
  }

  addBlock(conditionId: string) {
    const currentEditing = this.editingConditions();
    const updatedConditions = currentEditing.map((condition) => {
      if (condition.id === conditionId && condition.blockInputs) {
        const newBlockInputs = [...condition.blockInputs, ""];
        const input = newBlockInputs.filter((block) => block.trim()).join("\n");
        return { ...condition, blockInputs: newBlockInputs, input };
      }
      return condition;
    });
    this.editingConditions.set(updatedConditions);
  }

  removeBlock(conditionId: string, blockIndex: number) {
    const currentEditing = this.editingConditions();
    const updatedConditions = currentEditing.map((condition) => {
      if (
        condition.id === conditionId &&
        condition.blockInputs &&
        condition.blockInputs.length > 1
      ) {
        const newBlockInputs = condition.blockInputs.filter(
          (_, index) => index !== blockIndex
        );
        const input = newBlockInputs.filter((block) => block.trim()).join("\n");
        return { ...condition, blockInputs: newBlockInputs, input };
      }
      return condition;
    });
    this.editingConditions.set(updatedConditions);
  }
}
