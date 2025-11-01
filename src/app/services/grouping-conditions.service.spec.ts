import { TestBed } from "@angular/core/testing";
import {
  GroupingConditionsService,
  GroupingConditionState,
} from "./grouping-conditions.service";

describe("GroupingConditionsService", () => {
  let service: GroupingConditionsService;

  const seedConditions: GroupingConditionState[] = [
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
    { id: "gender-ratio", type: "gender-ratio", enabled: true, input: "" },
  ];

  const getSaved = () => service.getSavedConditions()();
  const getEditing = () => service.getEditingConditions()();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GroupingConditionsService],
    });
    service = TestBed.inject(GroupingConditionsService);
  });

  it("should expose the default saved and editing signals", () => {
    expect(getSaved()).toEqual(seedConditions);
    expect(getEditing()).toEqual([]);
  });

  it("should copy saved conditions into editing state when editing starts", () => {
    service.startEditing();
    const editing = getEditing();

    expect(editing).toEqual(seedConditions);
    expect(editing).not.toBe(getSaved());
  });

  it("should update, save, and cancel editing state independently", () => {
    service.startEditing();
    service.updateEditingCondition("same-group", { enabled: true, input: "A" });

    expect(getEditing().find((c) => c.id === "same-group")).toEqual(
      expect.objectContaining({ enabled: true, input: "A" })
    );
    expect(getSaved().find((c) => c.id === "same-group")).toEqual(
      expect.objectContaining({ enabled: false, input: "" })
    );

    service.saveConditions();
    const savedAfterSave = getSaved();
    expect(savedAfterSave.find((c) => c.id === "same-group")).toEqual(
      expect.objectContaining({ enabled: true, input: "A" })
    );
    expect(savedAfterSave).not.toBe(getEditing());

    service.cancelEditing();
    expect(getEditing()).toEqual([]);
  });

  it("should provide enabled conditions and individual condition lookups", () => {
    const enabled = service.getEnabledConditions();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].id).toBe("gender-ratio");

    const sameGroup = service.getConditionState("same-group");
    expect(sameGroup).toEqual(seedConditions[1]);
  });

  describe("block helpers", () => {
    beforeEach(() => {
      service.startEditing();
    });

    it("should ignore block updates that do not change the value", () => {
      const before = getEditing();
      service.updateBlockInput("block-distribution", 0, "");
      expect(getEditing()).toBe(before);
    });

    it("should merge block input strings into the combined input", () => {
      service.updateBlockInput("block-distribution", 0, "Alpha");
      service.updateBlockInput("block-distribution", 2, "Beta");

      const condition = getEditing().find(
        (c) => c.id === "block-distribution"
      );
      expect(condition?.blockInputs).toEqual(["Alpha", "", "Beta"]);
      expect(condition?.input).toBe("Alpha\nBeta");
    });

    it("should add new blocks while keeping merged input up to date", () => {
      service.updateBlockInput("block-distribution", 1, "One");
      service.addBlock("block-distribution");

      const condition = getEditing().find(
        (c) => c.id === "block-distribution"
      );
      expect(condition?.blockInputs).toEqual(["", "One", "", ""]);
      expect(condition?.input).toBe("One");
    });

    it("should remove blocks when more than one remains", () => {
      service.updateBlockInput("block-distribution", 0, "First");
      service.updateBlockInput("block-distribution", 1, "Second");
      service.removeBlock("block-distribution", 0);

      const condition = getEditing().find(
        (c) => c.id === "block-distribution"
      );
      expect(condition?.blockInputs).toEqual(["Second", ""]);
      expect(condition?.input).toBe("Second");
    });

    it("should prevent removing the last remaining block", () => {
      service.updateEditingCondition("block-distribution", {
        blockInputs: ["Only"],
        input: "Only",
      });

      const before = getEditing().find((c) => c.id === "block-distribution");
      service.removeBlock("block-distribution", 0);
      const after = getEditing().find((c) => c.id === "block-distribution");

      expect(after).toEqual(before);
    });
  });
});
