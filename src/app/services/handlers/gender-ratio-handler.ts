import {
  GroupingContext,
  GroupingHandler,
  GroupingResult,
} from "../../models/grouping-handler.model";

export class GenderRatioHandler extends GroupingHandler {
  protected process(context: GroupingContext): GroupingResult {
    const genderRatioCondition = context.conditions.find(
      (c) => c.type === "gender-ratio" && c.enabled
    );

    if (!genderRatioCondition) {
      return {
        success: false,
        groups: context.groups,
        handled: false,
        remainingStudents: context.remainingStudents,
        message: "Gender ratio condition not found or not enabled",
      };
    }

    const studentsToProcess = [...context.remainingStudents];
    const groups = context.groups.map((g) => ({
      ...g,
      students: [...g.students],
    }));

    // 只處理剩餘的學生，不影響已經分組的學生
    const maleStudents = studentsToProcess.filter((s) => s.gender === "male");
    const femaleStudents = studentsToProcess.filter(
      (s) => s.gender === "female"
    );

    const totalGroups = groups.length;
    const maleCount = maleStudents.length;
    const femaleCount = femaleStudents.length;

    // 如果沒有剩餘學生需要處理，直接返回
    if (maleCount === 0 && femaleCount === 0) {
      return {
        success: true,
        groups,
        handled: false,
        remainingStudents: [],
        message: "沒有剩餘學生需要性別比例分配",
      };
    }

    // 使用智能的性別平衡分配策略
    const shuffledMales = this.shuffleArray([...maleStudents]);
    const shuffledFemales = this.shuffleArray([...femaleStudents]);

    // 為每個組別計算當前的性別分佈
    const groupGenderStats = groups.map((group, index) => {
      const males = group.students.filter((s) => s.gender === "male").length;
      const females = group.students.filter(
        (s) => s.gender === "female"
      ).length;
      return {
        index,
        group,
        males,
        females,
        total: males + females,
        genderDiff: Math.abs(males - females), // 性別差異
      };
    });

    // 計算理想的每組人數
    const totalStudents =
      maleCount +
      femaleCount +
      groups.reduce((sum, g) => sum + g.students.length, 0);
    const idealGroupSize = Math.ceil(totalStudents / totalGroups);

    // 分配男生
    for (const maleStudent of shuffledMales) {
      // 找到最適合的組別（綜合考慮人數平衡和性別平衡）
      const targetGroupStat = groupGenderStats.sort((a, b) => {
        // 第一優先：避免組別人數超過理想人數
        const overCapacityA = Math.max(0, a.total + 1 - idealGroupSize);
        const overCapacityB = Math.max(0, b.total + 1 - idealGroupSize);

        if (overCapacityA !== overCapacityB) {
          return overCapacityA - overCapacityB; // 優先選擇不會超容量的組別
        }

        // 第二優先：選擇女生多的組別（改善性別平衡）
        const genderDiffA = a.females - a.males;
        const genderDiffB = b.females - b.males;

        if (genderDiffA !== genderDiffB) {
          return genderDiffB - genderDiffA; // 女生越多排越前
        }

        // 第三優先：選擇人數較少的組別
        return a.total - b.total;
      })[0];

      targetGroupStat.group.students.push(maleStudent);
      targetGroupStat.males++;
      targetGroupStat.total++;
      targetGroupStat.genderDiff = Math.abs(
        targetGroupStat.males - targetGroupStat.females
      );
    }

    // 分配女生
    for (const femaleStudent of shuffledFemales) {
      // 找到最適合的組別（綜合考慮人數平衡和性別平衡）
      const targetGroupStat = groupGenderStats.sort((a, b) => {
        // 第一優先：避免組別人數超過理想人數
        const overCapacityA = Math.max(0, a.total + 1 - idealGroupSize);
        const overCapacityB = Math.max(0, b.total + 1 - idealGroupSize);

        if (overCapacityA !== overCapacityB) {
          return overCapacityA - overCapacityB; // 優先選擇不會超容量的組別
        }

        // 第二優先：選擇男生多的組別（改善性別平衡）
        const genderDiffA = a.males - a.females;
        const genderDiffB = b.males - b.females;

        if (genderDiffA !== genderDiffB) {
          return genderDiffB - genderDiffA; // 男生越多排越前
        }

        // 第三優先：選擇人數較少的組別
        return a.total - b.total;
      })[0];

      targetGroupStat.group.students.push(femaleStudent);
      targetGroupStat.females++;
      targetGroupStat.total++;
      targetGroupStat.genderDiff = Math.abs(
        targetGroupStat.males - targetGroupStat.females
      );
    }

    // 生成分組結果說明
    const groupSummary = groups
      .map((group, index) => {
        const males = group.students.filter((s) => s.gender === "male").length;
        const females = group.students.filter(
          (s) => s.gender === "female"
        ).length;
        const total = males + females;
        return `${group.name}: ${total}人(${males}男${females}女)`;
      })
      .join(", ");

    return {
      success: true,
      groups,
      handled: true,
      remainingStudents: [],
      message: `已分配${
        maleCount + femaleCount
      }位剩餘學生並平衡人數與性別比例: ${groupSummary}`,
    };
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
