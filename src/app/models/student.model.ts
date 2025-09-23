export interface Student {
  id: number;
  gender: "male" | "female";
  isLeader?: boolean;
  blockId?: string;
}

export interface Group {
  id: string;
  name: string;
  students: Student[];
}

export interface GroupingCondition {
  id: string;
  type:
    | "same-group"
    | "different-group"
    | "gender-ratio"
    | "block-distribution";
  enabled: boolean;
  priority: number;
  config: any;
}

export interface SameGroupConfig {
  pairs: number[][];
}

export interface DifferentGroupConfig {
  groups: number[][];
}

export interface GenderRatioConfig {
  type: "auto" | "custom";
  customRatio?: {
    male: number;
    female: number;
  };
}

export interface BlockDistributionConfig {
  enabled: boolean;
}

export interface Block {
  id: string;
  name: string;
  students: Student[];
}
