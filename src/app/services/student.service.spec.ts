import { TestBed } from "@angular/core/testing";
import { StudentService } from "./student.service";
import { GroupingConditionsService } from "./grouping-conditions.service";
import { Group, Student } from "../models/student.model";
import { BlockDistributionHandler } from "./handlers/block-distribution-handler";

describe("StudentService", () => {
  let service: StudentService;
  let groupingConditionsService: jest.Mocked<GroupingConditionsService>;

  beforeEach(() => {
    groupingConditionsService = {
      getEnabledConditions: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<GroupingConditionsService>;

    TestBed.configureTestingModule({
      providers: [
        StudentService,
        { provide: GroupingConditionsService, useValue: groupingConditionsService },
      ],
    });

    service = TestBed.inject(StudentService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createStudent = (
    id: number,
    gender: "male" | "female",
    overrides: Partial<Student> = {}
  ): Student => ({ id, gender, isLeader: false, ...overrides });

  it("parses numeric input with ranges, duplicates and ordering", () => {
    const result = service.parseNumberInput("3-1, 2, 5, 3, 4-5");
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it("initializes students and default block with sorted ids", () => {
    service.initializeStudents("3,1", "4-5");

    expect(service.students()).toEqual([
      createStudent(1, "male"),
      createStudent(3, "male"),
      createStudent(4, "female"),
      createStudent(5, "female"),
    ]);

    expect(service.blocks()[0].students.map((s) => s.id)).toEqual([1, 3, 4, 5]);
  });

  it("initializes groups with requested size", () => {
    service.initializeGroups(2);

    expect(service.groups()).toEqual([
      { id: "group-1", name: "組別1", students: [] },
      { id: "group-2", name: "組別2", students: [] },
    ]);
  });

  it("adds and removes students while keeping signals sorted", () => {
    service.initializeStudents("1", "");
    service.addStudents("3,2", "male");

    expect(service.students().map((s) => s.id)).toEqual([1, 2, 3]);

    service.removeStudent(2);
    expect(service.students().map((s) => s.id)).toEqual([1, 3]);
  });

  it("throws when adding duplicate student ids", () => {
    service.initializeStudents("1", "");

    expect(() => service.addStudents("1", "male")).toThrow(
      "座號 1 已存在"
    );
  });

  it("sets absent students and removes them from active list", () => {
    service.initializeStudents("1-4", "");

    service.setAbsentStudents("2,4");

    expect(service.absentStudents()).toEqual([2, 4]);
    expect(service.students().map((s) => s.id)).toEqual([1, 3]);
  });

  it("updates conditions and validates available group counts", () => {
    service.initializeGroups(2);

    service.updateCondition("different-group", {
      enabled: true,
      config: { groups: [[1, 2, 3]] },
    });

    const errors = service.validateConditions();
    expect(errors).toEqual([
      "不同組條件中有 3 個人需要分在不同組，但只有 2 個組別",
    ]);

    service.initializeGroups(4);
    const noErrors = service.validateConditions();
    expect(noErrors).toEqual([]);
  });

  describe("performGrouping", () => {
    const seedStudents = () => {
      service.initializeStudents("1,3", "2,4");
      service.initializeGroups(2);
    };

    it("applies handler output when handled and balances afterwards", () => {
      seedStudents();

      const students = service.students();
      const stubGroups: Group[] = [
        { id: "group-1", name: "組別1", students: [students[0]] },
        { id: "group-2", name: "組別2", students: [] },
      ];

      const handleSpy = jest
        .spyOn(BlockDistributionHandler.prototype, "handle")
        .mockReturnValue({
          success: true,
          handled: true,
          groups: stubGroups,
          remainingStudents: students.slice(1),
        });

      const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.5);

      service.performGrouping();

      expect(handleSpy).toHaveBeenCalled();
      expect(randomSpy).toHaveBeenCalled();
      expect(service.groups().map((g) => g.students.map((s) => s.id))).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it("still balances students when handler reports unhandled", () => {
      seedStudents();

      jest
        .spyOn(BlockDistributionHandler.prototype, "handle")
        .mockReturnValue({
          success: false,
          handled: false,
          groups: service.groups(),
          remainingStudents: service.students(),
        });

      jest.spyOn(Math, "random").mockReturnValue(0.5);

      service.performGrouping();

      expect(service.groups().map((g) => g.students.map((s) => s.id))).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
  });

  describe("group utilities", () => {
    beforeEach(() => {
      const students = [
        createStudent(1, "male"),
        createStudent(2, "female"),
        createStudent(3, "male"),
      ];
      (service as any).studentsSignal.set(students);
      (service as any).groupsSignal.set([
        { id: "group-1", name: "組別1", students: [students[0], students[1]] },
        { id: "group-2", name: "組別2", students: [students[2]] },
      ]);
    });

    it("moves students across groups", () => {
      service.moveStudentToGroup(2, "group-1", "group-2");

      expect(service.groups().map((g) => g.students.map((s) => s.id))).toEqual([
        [1],
        [3, 2],
      ]);
    });

    it("toggles leaders and keeps only one per group", () => {
      service.toggleLeader("group-1", 2);
      expect(service.groups()[0].students[0]).toMatchObject({ id: 2, isLeader: true });
      expect(service.groups()[0].students[1]).toMatchObject({ id: 1, isLeader: false });

      service.toggleLeader("group-1", 1);
      expect(service.groups()[0].students[0]).toMatchObject({ id: 1, isLeader: true });
      expect(service.groups()[0].students[1]).toMatchObject({ id: 2, isLeader: false });
    });

    it("selects random leaders per group deterministically", () => {
      jest.spyOn(Math, "random").mockReturnValueOnce(0.6).mockReturnValueOnce(0.1);

      service.selectRandomLeaders();

      expect(service.groups()[0].students[0]).toMatchObject({ id: 2, isLeader: true });
      expect(service.groups()[1].students[0]).toMatchObject({ id: 3, isLeader: true });
    });
  });

  it("copies formatted groups to clipboard", () => {
    const clipboardWrite = jest.fn();
    const originalNavigator = (globalThis as any).navigator;
    (globalThis as any).navigator = {
      clipboard: { writeText: clipboardWrite },
    };

    (service as any).groupsSignal.set([
      {
        id: "group-1",
        name: "組別1",
        students: [createStudent(1, "male", { isLeader: true }), createStudent(2, "female")],
      },
      {
        id: "group-2",
        name: "組別2",
        students: [createStudent(3, "male")],
      },
    ]);

    const result = service.copyGroupsToClipboard();

    expect(result).toBe("組別1: [1,2], 組別2: [3]");
    expect(clipboardWrite).toHaveBeenCalledWith("組別1: [1,2], 組別2: [3]");

    if (originalNavigator) {
      (globalThis as any).navigator = originalNavigator;
    } else {
      delete (globalThis as any).navigator;
    }
  });
});
