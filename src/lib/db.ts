import Dexie, { type Table } from 'dexie';
import {
  User,
  SchoolSettings,
  AcademicYear,
  Term,
  Class,
  Subject,
  GradingScale,
  Student,
  Guardian,
  EnrollmentHistory,
  Staff,
  Qualification,
  StaffAssignment,
  AttendanceRecord,
  AttendanceSession,
  SyncQueueItem,
  AssessmentType,
  Assessment,
  AssessmentScore,
  ReportCard,
  FeeCategory,
  FeeStructure,
  Invoice,
  Payment,
  FinancialAdjustment,
  InventoryItem,
  InventoryMovement,
  ActivityLog,
} from '@/types';
import {
  PREDEFINED_CLASSES,
  DEFAULT_SUBJECTS,
  DEFAULT_FEE_CATEGORIES,
  DEFAULT_ASSESSMENT_TYPES,
  DEFAULT_GRADING_SCALE,
} from './constants';
import { generateId } from './utils';

export class EPSDatabase extends Dexie {
  users!: Table<User>;
  schoolSettings!: Table<SchoolSettings>;
  academicYears!: Table<AcademicYear>;
  terms!: Table<Term>;
  classes!: Table<Class>;
  subjects!: Table<Subject>;
  gradingScales!: Table<GradingScale>;
  students!: Table<Student>;
  guardians!: Table<Guardian>;
  enrollmentHistory!: Table<EnrollmentHistory>;
  staff!: Table<Staff>;
  qualifications!: Table<Qualification>;
  staffAssignments!: Table<StaffAssignment>;
  attendanceRecords!: Table<AttendanceRecord>;
  attendanceSessions!: Table<AttendanceSession>;
  syncQueue!: Table<SyncQueueItem>;
  assessmentTypes!: Table<AssessmentType>;
  assessments!: Table<Assessment>;
  assessmentScores!: Table<AssessmentScore>;
  reportCards!: Table<ReportCard>;
  feeCategories!: Table<FeeCategory>;
  feeStructures!: Table<FeeStructure>;
  invoices!: Table<Invoice>;
  payments!: Table<Payment>;
  financialAdjustments!: Table<FinancialAdjustment>;
  inventoryItems!: Table<InventoryItem>;
  inventoryMovements!: Table<InventoryMovement>;
  activityLogs!: Table<ActivityLog>;

  constructor() {
    super('EPSDatabase');
    this.version(1).stores({
      users: 'id, email, role',
      schoolSettings: 'id',
      academicYears: 'id, name, isCurrent, status',
      terms: 'id, academicYearId, isCurrent, status',
      classes: 'id, name, academicYearId, classTeacherId, status, order',
      subjects: 'id, name, code, status',
      gradingScales: 'id, name, isDefault',
      students: 'id, studentId, admissionNumber, firstName, lastName, gender, currentClassId, academicYearId, enrollmentStatus',
      guardians: 'id, studentId, isPrimaryContact',
      enrollmentHistory: 'id, studentId, classId, academicYearId, status',
      staff: 'id, staffId, firstName, lastName, gender, staffCategory, employmentStatus',
      qualifications: 'id, staffId',
      staffAssignments: 'id, staffId, classId, subjectId, academicYearId, status',
      attendanceRecords: 'id, studentId, classId, date, status, syncStatus, [studentId+date]',
      attendanceSessions: 'id, classId, date, termId, academicYearId, status',
      syncQueue: 'id, entityType, entityId, status',
      assessmentTypes: 'id, name, status',
      assessments: 'id, name, assessmentTypeId, classId, subjectId, termId, academicYearId, teacherId, status',
      assessmentScores: 'id, assessmentId, studentId, status',
      reportCards: 'id, studentId, classId, termId, academicYearId, status',
      feeCategories: 'id, name, status',
      feeStructures: 'id, academicYearId, termId, classId, feeCategoryId, status',
      invoices: 'id, invoiceNumber, studentId, classId, academicYearId, termId, status',
      payments: 'id, receiptNumber, studentId, invoiceId, paymentDate, status',
      financialAdjustments: 'id, studentId, invoiceId, type, status',
      inventoryItems: 'id, inventoryCode, name, category, assignedClassId, status',
      inventoryMovements: 'id, itemId, movementType',
      activityLogs: 'id, userId, entityType, timestamp',
    });
  }
}

export const db = new EPSDatabase();

// ============================================
// DATABASE SEEDING
// ============================================

const DEMO_STUDENT_NAMES = [
  { firstName: 'Kwame', lastName: 'Mensah', gender: 'male' as const },
  { firstName: 'Ama', lastName: 'Osei', gender: 'female' as const },
  { firstName: 'Kofi', lastName: 'Asante', gender: 'male' as const },
  { firstName: 'Akosua', lastName: 'Boateng', gender: 'female' as const },
  { firstName: 'Yaw', lastName: 'Darko', gender: 'male' as const },
  { firstName: 'Abena', lastName: 'Adjei', gender: 'female' as const },
  { firstName: 'Kojo', lastName: 'Antwi', gender: 'male' as const },
  { firstName: 'Adwoa', lastName: 'Frimpong', gender: 'female' as const },
  { firstName: 'Kwabena', lastName: 'Owusu', gender: 'male' as const },
  { firstName: 'Afua', lastName: 'Amoah', gender: 'female' as const },
  { firstName: 'Kwaku', lastName: 'Appiah', gender: 'male' as const },
  { firstName: 'Yaa', lastName: 'Bonsu', gender: 'female' as const },
  { firstName: 'Kwasi', lastName: 'Nuamah', gender: 'male' as const },
  { firstName: 'Esi', lastName: 'Quaye', gender: 'female' as const },
  { firstName: 'Fiifi', lastName: 'Essien', gender: 'male' as const },
  { firstName: 'Efua', lastName: 'Sutherland', gender: 'female' as const },
  { firstName: 'Ato', lastName: 'Baiden', gender: 'male' as const },
  { firstName: 'Araba', lastName: 'Mills', gender: 'female' as const },
  { firstName: 'Ekow', lastName: 'Hanson', gender: 'male' as const },
  { firstName: 'Maame', lastName: 'Serwaa', gender: 'female' as const },
];

const DEMO_TEACHER_NAMES = [
  { firstName: 'Emmanuel', lastName: 'Addo', gender: 'male' as const },
  { firstName: 'Grace', lastName: 'Amoako', gender: 'female' as const },
  { firstName: 'Samuel', lastName: 'Tetteh', gender: 'male' as const },
  { firstName: 'Comfort', lastName: 'Nyarko', gender: 'female' as const },
  { firstName: 'Daniel', lastName: 'Ofori', gender: 'male' as const },
  { firstName: 'Patience', lastName: 'Agyeman', gender: 'female' as const },
  { firstName: 'Joseph', lastName: 'Kwarteng', gender: 'male' as const },
  { firstName: 'Victoria', lastName: 'Ansah', gender: 'female' as const },
];

const DEMO_NON_TEACHING_STAFF = [
  { firstName: 'Martha', lastName: 'Dede', gender: 'female' as const, category: 'cook' as const },
  { firstName: 'Peter', lastName: 'Anane', gender: 'male' as const, category: 'driver' as const },
  { firstName: 'Regina', lastName: 'Kusi', gender: 'female' as const, category: 'cook' as const },
  { firstName: 'Isaac', lastName: 'Bempah', gender: 'male' as const, category: 'other' as const },
];

export async function seedDatabase(): Promise<void> {
  const existingSettings = await db.schoolSettings.count();
  if (existingSettings > 0) return;

  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear();

  // School Settings
  await db.schoolSettings.add({
    id: 'school-1',
    name: 'Emmanuel Preparatory School',
    abbreviation: 'E.P.S.',
    address: '[School Address - Edit in Settings]',
    digitalAddress: '[Digital Address - Edit in Settings]',
    phoneNumbers: ['[Phone Number - Edit in Settings]'],
    email: '[Email - Edit in Settings]',
    establishmentDate: '',
    proprietorName: '[Proprietor Name - Edit in Settings]',
    headteacherName: '[Headteacher Name - Edit in Settings]',
    motto: '[School Motto - Edit in Settings]',
    currency: 'GHS',
    timezone: 'Africa/Accra',
    language: 'English',
    createdAt: now,
    updatedAt: now,
  });

  // Academic Year
  const academicYearId = generateId();
  await db.academicYears.add({
    id: academicYearId,
    name: `${currentYear}/${currentYear + 1}`,
    startDate: `${currentYear}-09-01`,
    endDate: `${currentYear + 1}-07-31`,
    isCurrent: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Terms
  const term1Id = generateId();
  const term2Id = generateId();
  const term3Id = generateId();

  await db.terms.bulkAdd([
    {
      id: term1Id,
      academicYearId,
      name: 'First Term',
      startDate: `${currentYear}-09-01`,
      endDate: `${currentYear}-12-20`,
      isCurrent: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: term2Id,
      academicYearId,
      name: 'Second Term',
      startDate: `${currentYear + 1}-01-10`,
      endDate: `${currentYear + 1}-04-05`,
      isCurrent: false,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: term3Id,
      academicYearId,
      name: 'Third Term',
      startDate: `${currentYear + 1}-04-22`,
      endDate: `${currentYear + 1}-07-31`,
      isCurrent: false,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // Classes
  const classIds: string[] = [];
  for (const cls of PREDEFINED_CLASSES) {
    const id = generateId();
    classIds.push(id);
    await db.classes.add({
      id,
      name: cls.name,
      academicYearId,
      capacity: 40,
      status: 'active',
      order: cls.order,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Subjects
  for (const subject of DEFAULT_SUBJECTS) {
    await db.subjects.add({
      id: generateId(),
      name: subject.name,
      code: subject.code,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Grading Scale
  await db.gradingScales.add({
    id: generateId(),
    name: DEFAULT_GRADING_SCALE.name,
    grades: DEFAULT_GRADING_SCALE.grades,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  });

  // Fee Categories
  for (const cat of DEFAULT_FEE_CATEGORIES) {
    await db.feeCategories.add({
      id: generateId(),
      name: cat.name,
      description: cat.description,
      isRequired: cat.isRequired,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Assessment Types
  for (const at of DEFAULT_ASSESSMENT_TYPES) {
    await db.assessmentTypes.add({
      id: generateId(),
      name: at.name,
      defaultWeight: at.defaultWeight,
      defaultMaxScore: at.defaultMaxScore,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Staff (Teachers)
  const staffIds: string[] = [];
  for (let i = 0; i < DEMO_TEACHER_NAMES.length; i++) {
    const teacher = DEMO_TEACHER_NAMES[i];
    const staffId = generateId();
    staffIds.push(staffId);
    const isTrained = i < 6;
    await db.staff.add({
      id: staffId,
      staffId: `STF${currentYear.toString().slice(-2)}${(i + 1).toString().padStart(3, '0')}`,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      gender: teacher.gender,
      dateOfBirth: `19${80 + i}-0${(i % 9) + 1}-15`,
      phoneNumber: `024${(1000000 + i * 111111).toString().slice(-7)}`,
      email: `${teacher.firstName.toLowerCase()}.${teacher.lastName.toLowerCase()}@eps.edu.gh`,
      languagesSpoken: ['English', 'Twi'],
      staffCategory: 'teacher',
      isTrained: isTrained,
      registrationNumber: isTrained ? `TR${100000 + i}` : undefined,
      appointmentDate: `20${15 + (i % 5)}-09-01`,
      datePostedToStation: `20${18 + (i % 4)}-01-15`,
      currentStation: 'Emmanuel Preparatory School',
      subjectsTaught: [],
      employmentStatus: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Non-teaching staff
  for (let i = 0; i < DEMO_NON_TEACHING_STAFF.length; i++) {
    const staff = DEMO_NON_TEACHING_STAFF[i];
    const staffId = generateId();
    staffIds.push(staffId);
    await db.staff.add({
      id: staffId,
      staffId: `STF${currentYear.toString().slice(-2)}${(i + 20).toString().padStart(3, '0')}`,
      firstName: staff.firstName,
      lastName: staff.lastName,
      gender: staff.gender,
      dateOfBirth: `19${75 + i}-0${(i % 9) + 1}-10`,
      phoneNumber: `020${(2000000 + i * 222222).toString().slice(-7)}`,
      languagesSpoken: ['English', 'Twi'],
      staffCategory: staff.category,
      isTrained: false,
      appointmentDate: `20${16 + i}-09-01`,
      currentStation: 'Emmanuel Preparatory School',
      subjectsTaught: [],
      employmentStatus: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Assign class teachers
  for (let i = 0; i < Math.min(8, classIds.length); i++) {
    await db.classes.update(classIds[i], { classTeacherId: staffIds[i] });
  }

  // Students
  let studentCounter = 1;
  for (const classId of classIds) {
    const numStudents = Math.floor(Math.random() * 5) + 5; // 5-10 per class
    for (let j = 0; j < numStudents; j++) {
      const nameIdx = (studentCounter - 1) % DEMO_STUDENT_NAMES.length;
      const name = DEMO_STUDENT_NAMES[nameIdx];
      const studentId = generateId();
      
      await db.students.add({
        id: studentId,
        studentId: `EPS${currentYear.toString().slice(-2)}${studentCounter.toString().padStart(4, '0')}`,
        admissionNumber: `ADM/${currentYear}/${studentCounter.toString().padStart(4, '0')}`,
        firstName: name.firstName,
        lastName: name.lastName,
        gender: name.gender,
        dateOfBirth: `20${10 + (studentCounter % 8)}-0${(studentCounter % 9) + 1}-${((studentCounter % 27) + 1).toString().padStart(2, '0')}`,
        languagesSpoken: ['English', 'Twi'],
        placeOfBirth: 'Accra',
        district: 'Accra Metropolitan',
        districtCapital: 'Accra',
        region: 'greater_accra',
        residentialAddress: `House No. ${studentCounter}, Demo Street, Accra`,
        admissionDate: `${currentYear}-09-01`,
        currentClassId: classId,
        academicYearId,
        enrollmentStatus: 'active',
        transportArrangement: (studentCounter % 3 === 0 ? 'school_bus' : studentCounter % 3 === 1 ? 'walking' : 'private') as 'school_bus' | 'walking' | 'private',
        createdAt: now,
        updatedAt: now,
      });

      // Add guardian
      await db.guardians.add({
        id: generateId(),
        studentId,
        fullName: `Mr./Mrs. ${name.lastName}`,
        relationship: name.gender === 'male' ? 'Father' : 'Mother',
        phoneNumber: `024${(3000000 + studentCounter * 111111).toString().slice(-7)}`,
        isPrimaryContact: true,
        isEmergencyContact: true,
        isAuthorizedPickup: true,
        createdAt: now,
        updatedAt: now,
      });

      studentCounter++;
    }
  }

  // Inventory Items
  const inventoryItems = [
    { name: 'Student Desks', category: 'Furniture', quantity: 150, unit: 'pieces' },
    { name: 'Teacher Desks', category: 'Furniture', quantity: 15, unit: 'pieces' },
    { name: 'Whiteboards', category: 'Equipment', quantity: 12, unit: 'pieces' },
    { name: 'Textbooks - English', category: 'Books', quantity: 200, unit: 'pieces' },
    { name: 'Textbooks - Mathematics', category: 'Books', quantity: 200, unit: 'pieces' },
    { name: 'Computers', category: 'ICT Equipment', quantity: 20, unit: 'pieces' },
    { name: 'Footballs', category: 'Sports', quantity: 10, unit: 'pieces' },
    { name: 'First Aid Kits', category: 'Medical', quantity: 5, unit: 'kits' },
  ];

  for (let i = 0; i < inventoryItems.length; i++) {
    const item = inventoryItems[i];
    await db.inventoryItems.add({
      id: generateId(),
      inventoryCode: `INV-${(i + 1).toString().padStart(4, '0')}`,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      condition: 'good',
      status: 'available',
      acquisitionDate: `${currentYear - 1}-01-15`,
      acquisitionCost: Math.floor(Math.random() * 5000) + 500,
      supplier: 'Demo Supplier',
      location: 'Main Store',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Demo Users
  await db.users.bulkAdd([
    {
      id: 'demo-owner',
      email: 'owner@eps.edu.gh',
      name: 'School Owner',
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo-headmaster',
      email: 'headmaster@eps.edu.gh',
      name: 'Headmaster',
      role: 'headmaster',
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // Activity Logs
  await db.activityLogs.bulkAdd([
    {
      id: generateId(),
      userId: 'demo-owner',
      userName: 'School Owner',
      action: 'System initialized',
      entityType: 'system',
      details: 'Database seeded with demo data',
      timestamp: now,
    },
    {
      id: generateId(),
      userId: 'demo-owner',
      userName: 'Admin User',
      action: 'Students enrolled',
      entityType: 'student',
      details: `${studentCounter - 1} students enrolled in demo data`,
      timestamp: now,
    },
  ]);
}

// ============================================
// DATA ACCESS LAYER
// ============================================

export const dataService = {
  // School Settings
  async getSchoolSettings(): Promise<SchoolSettings | undefined> {
    return db.schoolSettings.toCollection().first();
  },

  async getUsers(): Promise<User[]> {
    return db.users.toArray();
  },

  async updateSchoolSettings(settings: Partial<SchoolSettings>): Promise<void> {
    const existing = await db.schoolSettings.toCollection().first();
    if (existing) {
      await db.schoolSettings.update(existing.id, { ...settings, updatedAt: new Date().toISOString() });
    }
  },

  // Academic Years
  async getAcademicYears(): Promise<AcademicYear[]> {
    return db.academicYears.orderBy('name').reverse().toArray();
  },

  async getCurrentAcademicYear(): Promise<AcademicYear | undefined> {
    return db.academicYears.where('isCurrent').equals(1 as unknown as string).first()
      .then(async (result) => {
        if (result) return result;
        return db.academicYears.toCollection().first();
      });
  },

  async addAcademicYear(year: Omit<AcademicYear, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();
    await db.academicYears.add({ ...year, id, createdAt: now, updatedAt: now });
    return id;
  },

  // Terms
  async getTerms(academicYearId?: string): Promise<Term[]> {
    if (academicYearId) {
      return db.terms.where('academicYearId').equals(academicYearId).toArray();
    }
    return db.terms.toArray();
  },

  async getCurrentTerm(): Promise<Term | undefined> {
    const terms = await db.terms.toArray();
    return terms.find((t) => t.isCurrent) || terms[0];
  },

  // Classes
  async getClasses(academicYearId?: string): Promise<Class[]> {
    let classes: Class[];
    if (academicYearId) {
      classes = await db.classes.where('academicYearId').equals(academicYearId).toArray();
    } else {
      classes = await db.classes.toArray();
    }
    return classes.sort((a, b) => a.order - b.order);
  },

  async getClass(id: string): Promise<Class | undefined> {
    return db.classes.get(id);
  },

  async addClass(cls: Omit<Class, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();
    await db.classes.add({ ...cls, id, createdAt: now, updatedAt: now });
    return id;
  },

  async updateClass(id: string, data: Partial<Class>): Promise<void> {
    await db.classes.update(id, { ...data, updatedAt: new Date().toISOString() });
  },

  // Subjects
  async getSubjects(): Promise<Subject[]> {
    return db.subjects.toArray();
  },

  async getFeeCategories(): Promise<FeeCategory[]> {
    return db.feeCategories.toArray();
  },

  // Students
  async getStudents(filters?: {
    classId?: string;
    gender?: string;
    enrollmentStatus?: string;
    academicYearId?: string;
    search?: string;
  }): Promise<Student[]> {
    let students = await db.students.toArray();

    if (filters?.classId) {
      students = students.filter((s) => s.currentClassId === filters.classId);
    }
    if (filters?.gender) {
      students = students.filter((s) => s.gender === filters.gender);
    }
    if (filters?.enrollmentStatus) {
      students = students.filter((s) => s.enrollmentStatus === filters.enrollmentStatus);
    }
    if (filters?.academicYearId) {
      students = students.filter((s) => s.academicYearId === filters.academicYearId);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      students = students.filter(
        (s) =>
          s.firstName.toLowerCase().includes(search) ||
          s.lastName.toLowerCase().includes(search) ||
          s.admissionNumber.toLowerCase().includes(search) ||
          s.studentId.toLowerCase().includes(search)
      );
    }

    return students.sort((a, b) => a.lastName.localeCompare(b.lastName));
  },

  async getStudent(id: string): Promise<Student | undefined> {
    return db.students.get(id);
  },

  async addStudent(student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();
    await db.students.add({ ...student, id, createdAt: now, updatedAt: now });
    return id;
  },

  async updateStudent(id: string, data: Partial<Student>): Promise<void> {
    await db.students.update(id, { ...data, updatedAt: new Date().toISOString() });
  },

  async getStudentCount(): Promise<number> {
    return db.students.count();
  },

  async getStudentCountByGender(): Promise<{ boys: number; girls: number }> {
    const students = await db.students.where('enrollmentStatus').equals('active').toArray();
    return {
      boys: students.filter((s) => s.gender === 'male').length,
      girls: students.filter((s) => s.gender === 'female').length,
    };
  },

  // Guardians
  async getGuardians(studentId: string): Promise<Guardian[]> {
    return db.guardians.where('studentId').equals(studentId).toArray();
  },

  async addGuardian(guardian: Omit<Guardian, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();
    await db.guardians.add({ ...guardian, id, createdAt: now, updatedAt: now });
    return id;
  },

  async updateGuardian(id: string, data: Partial<Guardian>): Promise<void> {
    await db.guardians.update(id, { ...data, updatedAt: new Date().toISOString() });
  },

  async deleteGuardian(id: string): Promise<void> {
    await db.guardians.delete(id);
  },

  // Staff
  async getStaff(filters?: {
    category?: string;
    gender?: string;
    employmentStatus?: string;
    isTrained?: boolean;
    search?: string;
  }): Promise<Staff[]> {
    let staff = await db.staff.toArray();

    if (filters?.category) {
      staff = staff.filter((s) => s.staffCategory === filters.category);
    }
    if (filters?.gender) {
      staff = staff.filter((s) => s.gender === filters.gender);
    }
    if (filters?.employmentStatus) {
      staff = staff.filter((s) => s.employmentStatus === filters.employmentStatus);
    }
    if (filters?.isTrained !== undefined) {
      staff = staff.filter((s) => s.isTrained === filters.isTrained);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      staff = staff.filter(
        (s) =>
          s.firstName.toLowerCase().includes(search) ||
          s.lastName.toLowerCase().includes(search) ||
          s.staffId.toLowerCase().includes(search)
      );
    }

    return staff.sort((a, b) => a.lastName.localeCompare(b.lastName));
  },

  async getStaffMember(id: string): Promise<Staff | undefined> {
    return db.staff.get(id);
  },

  async getQualifications(staffId: string): Promise<Qualification[]> {
    return db.qualifications.where('staffId').equals(staffId).toArray();
  },

  async addStaff(staff: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();
    await db.staff.add({ ...staff, id, createdAt: now, updatedAt: now });
    return id;
  },

  async updateStaff(id: string, data: Partial<Staff>): Promise<void> {
    await db.staff.update(id, { ...data, updatedAt: new Date().toISOString() });
  },

  async getStaffCount(): Promise<{ teaching: number; nonTeaching: number }> {
    const staff = await db.staff.toArray();
    const teaching = staff.filter(
      (s) => s.staffCategory === 'teacher' || s.staffCategory === 'headteacher'
    ).length;
    const nonTeaching = staff.filter(
      (s) => s.staffCategory !== 'teacher' && s.staffCategory !== 'headteacher'
    ).length;
    return { teaching, nonTeaching };
  },

  async getTeachingStaffStats(): Promise<{
    trainedMale: number;
    trainedFemale: number;
    untrainedMale: number;
    untrainedFemale: number;
    totalMale: number;
    totalFemale: number;
    total: number;
    maleUsingBus: number;
    femaleUsingBus: number;
    maleWalking: number;
    femaleWalking: number;
  }> {
    const staff = await db.staff.toArray();
    const teachers = staff.filter(
      (s) => s.staffCategory === 'teacher' || s.staffCategory === 'headteacher'
    );

    const trainedMale = teachers.filter((t) => t.isTrained && t.gender === 'male').length;
    const trainedFemale = teachers.filter((t) => t.isTrained && t.gender === 'female').length;
    const untrainedMale = teachers.filter((t) => !t.isTrained && t.gender === 'male').length;
    const untrainedFemale = teachers.filter((t) => !t.isTrained && t.gender === 'female').length;

    return {
      trainedMale,
      trainedFemale,
      untrainedMale,
      untrainedFemale,
      totalMale: trainedMale + untrainedMale,
      totalFemale: trainedFemale + untrainedFemale,
      total: teachers.length,
      maleUsingBus: 0,
      femaleUsingBus: 0,
      maleWalking: 0,
      femaleWalking: 0,
    };
  },

  async getNonTeachingStaffStats(): Promise<{
    maleCooks: number;
    femaleCooks: number;
    maleDrivers: number;
    femaleDrivers: number;
    otherMale: number;
    otherFemale: number;
    totalMale: number;
    totalFemale: number;
    total: number;
  }> {
    const staff = await db.staff.toArray();
    const nonTeaching = staff.filter(
      (s) => s.staffCategory !== 'teacher' && s.staffCategory !== 'headteacher'
    );

    const maleCooks = nonTeaching.filter((s) => s.staffCategory === 'cook' && s.gender === 'male').length;
    const femaleCooks = nonTeaching.filter((s) => s.staffCategory === 'cook' && s.gender === 'female').length;
    const maleDrivers = nonTeaching.filter((s) => s.staffCategory === 'driver' && s.gender === 'male').length;
    const femaleDrivers = nonTeaching.filter((s) => s.staffCategory === 'driver' && s.gender === 'female').length;
    const otherMale = nonTeaching.filter(
      (s) => s.staffCategory === 'other' && s.gender === 'male'
    ).length;
    const otherFemale = nonTeaching.filter(
      (s) => s.staffCategory === 'other' && s.gender === 'female'
    ).length;

    return {
      maleCooks,
      femaleCooks,
      maleDrivers,
      femaleDrivers,
      otherMale,
      otherFemale,
      totalMale: maleCooks + maleDrivers + otherMale,
      totalFemale: femaleCooks + femaleDrivers + otherFemale,
      total: nonTeaching.length,
    };
  },

  // Attendance
  async getAttendanceRecords(filters?: {
    studentId?: string;
    classId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<AttendanceRecord[]> {
    let records = await db.attendanceRecords.toArray();

    if (filters?.studentId) {
      records = records.filter((r) => r.studentId === filters.studentId);
    }
    if (filters?.classId) {
      records = records.filter((r) => r.classId === filters.classId);
    }
    if (filters?.date) {
      records = records.filter((r) => r.date === filters.date);
    }
    if (filters?.startDate) {
      records = records.filter((r) => r.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      records = records.filter((r) => r.date <= filters.endDate!);
    }
    if (filters?.status) {
      records = records.filter((r) => r.status === filters.status);
    }

    return records;
  },

  async saveAttendanceRecords(records: AttendanceRecord[]): Promise<void> {
    await db.attendanceRecords.bulkPut(records);
  },

  async getTodayAttendanceStats(): Promise<{ present: number; absent: number; total: number }> {
    const today = new Date().toISOString().split('T')[0];
    const records = await db.attendanceRecords.where('date').equals(today).toArray();
    const present = records.filter((r) => r.status === 'present' || r.status === 'late').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    return { present, absent, total: records.length };
  },

  // Sync Queue
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt'>): Promise<string> {
    const id = generateId();
    await db.syncQueue.add({ ...item, id, createdAt: new Date().toISOString() });
    return id;
  },

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return db.syncQueue.toArray();
  },

  async updateSyncQueueItem(id: string, data: Partial<SyncQueueItem>): Promise<void> {
    await db.syncQueue.update(id, data);
  },

  // Assessments
  async getAssessmentTypes(): Promise<AssessmentType[]> {
    return db.assessmentTypes.toArray();
  },

  async getAssessments(): Promise<Assessment[]> {
    return db.assessments.toArray();
  },

  async addAssessment(assessment: Omit<Assessment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();
    await db.assessments.add({ ...assessment, id, createdAt: now, updatedAt: now });
    return id;
  },

  // Assessment scores
  async getAssessment(id: string): Promise<Assessment | undefined> {
    return db.assessments.get(id);
  },

  async getAssessmentScores(assessmentId: string): Promise<AssessmentScore[]> {
    return db.assessmentScores.where('assessmentId').equals(assessmentId).toArray();
  },

  async saveAssessmentScores(
    assessmentId: string,
    scores: Array<{ studentId: string; score: number | null }>
  ): Promise<void> {
    await db.transaction('rw', db.assessments, db.assessmentScores, async () => {
      const assessment = await db.assessments.get(assessmentId);
      if (!assessment) throw new Error('Assessment not found.');

      const existingScores = await db.assessmentScores
        .where('assessmentId')
        .equals(assessmentId)
        .toArray();
      const existingByStudent = new Map(existingScores.map((score) => [score.studentId, score]));
      const now = new Date().toISOString();
      const scoresToSave: AssessmentScore[] = [];
      const scoreIdsToDelete: string[] = [];

      for (const entry of scores) {
        const existing = existingByStudent.get(entry.studentId);
        if (entry.score === null) {
          if (existing) scoreIdsToDelete.push(existing.id);
          continue;
        }

        scoresToSave.push({
          id: existing?.id ?? generateId(),
          assessmentId,
          studentId: entry.studentId,
          score: entry.score,
          status: 'submitted',
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
      }

      if (scoresToSave.length) await db.assessmentScores.bulkPut(scoresToSave);
      if (scoreIdsToDelete.length) await db.assessmentScores.bulkDelete(scoreIdsToDelete);

      const isComplete = scores.length > 0 && scores.every((entry) => entry.score !== null);
      await db.assessments.update(assessmentId, {
        status: isComplete ? 'graded' : 'open',
        updatedAt: now,
      });
    });
  },

  // Invoices
  async getInvoices(filters?: {
    studentId?: string;
    classId?: string;
    academicYearId?: string;
    termId?: string;
    status?: string;
  }): Promise<Invoice[]> {
    let invoices = await db.invoices.toArray();

    if (filters?.studentId) {
      invoices = invoices.filter((i) => i.studentId === filters.studentId);
    }
    if (filters?.classId) {
      invoices = invoices.filter((i) => i.classId === filters.classId);
    }
    if (filters?.academicYearId) {
      invoices = invoices.filter((i) => i.academicYearId === filters.academicYearId);
    }
    if (filters?.termId) {
      invoices = invoices.filter((i) => i.termId === filters.termId);
    }
    if (filters?.status) {
      invoices = invoices.filter((i) => i.status === filters.status);
    }

    return invoices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async addInvoice(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();
    await db.invoices.add({ ...invoice, id, createdAt: now, updatedAt: now });
    return id;
  },

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<void> {
    await db.invoices.update(id, { ...data, updatedAt: new Date().toISOString() });
  },

  // Payments
  async getPayments(filters?: {
    studentId?: string;
    invoiceId?: string;
    startDate?: string;
    endDate?: string;
    method?: string;
  }): Promise<Payment[]> {
    let payments = await db.payments.toArray();

    if (filters?.studentId) {
      payments = payments.filter((p) => p.studentId === filters.studentId);
    }
    if (filters?.invoiceId) {
      payments = payments.filter((p) => p.invoiceId === filters.invoiceId);
    }
    if (filters?.startDate) {
      payments = payments.filter((p) => p.paymentDate >= filters.startDate!);
    }
    if (filters?.endDate) {
      payments = payments.filter((p) => p.paymentDate <= filters.endDate!);
    }
    if (filters?.method) {
      payments = payments.filter((p) => p.paymentMethod === filters.method);
    }

    return payments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  },

  async addPayment(payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();
    await db.payments.add({ ...payment, id, createdAt: now, updatedAt: now });
    return id;
  },

  async getFeesCollected(startDate?: string, endDate?: string): Promise<number> {
    let payments = await db.payments.where('status').equals('completed').toArray();
    if (startDate) {
      payments = payments.filter((p) => p.paymentDate >= startDate);
    }
    if (endDate) {
      payments = payments.filter((p) => p.paymentDate <= endDate);
    }
    return payments.reduce((sum, p) => sum + p.amount, 0);
  },

  async getOutstandingBalances(): Promise<number> {
    const invoices = await db.invoices.toArray();
    return invoices
      .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => sum + i.outstandingBalance, 0);
  },

  // Inventory
  async getInventoryItems(filters?: {
    category?: string;
    status?: string;
    assignedClassId?: string;
    search?: string;
  }): Promise<InventoryItem[]> {
    let items = await db.inventoryItems.toArray();

    if (filters?.category) {
      items = items.filter((i) => i.category === filters.category);
    }
    if (filters?.status) {
      items = items.filter((i) => i.status === filters.status);
    }
    if (filters?.assignedClassId) {
      items = items.filter((i) => i.assignedClassId === filters.assignedClassId);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(search) ||
          i.inventoryCode.toLowerCase().includes(search)
      );
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    return db.inventoryItems.get(id);
  },

  async addInventoryItem(item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();
    await db.inventoryItems.add({ ...item, id, createdAt: now, updatedAt: now });
    return id;
  },

  async updateInventoryItem(id: string, data: Partial<InventoryItem>): Promise<void> {
    await db.inventoryItems.update(id, { ...data, updatedAt: new Date().toISOString() });
  },

  async getInventoryMovements(itemId: string): Promise<InventoryMovement[]> {
    return db.inventoryMovements.where('itemId').equals(itemId).reverse().sortBy('createdAt');
  },

  async addInventoryMovement(movement: Omit<InventoryMovement, 'id' | 'createdAt'>): Promise<string> {
    const id = generateId();
    await db.inventoryMovements.add({ ...movement, id, createdAt: new Date().toISOString() });
    return id;
  },

  async getInventoryCount(): Promise<number> {
    const items = await db.inventoryItems.toArray();
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },

  // Activity Logs
  async getActivityLogs(limit?: number): Promise<ActivityLog[]> {
    const logs = await db.activityLogs.orderBy('timestamp').reverse().toArray();
    return limit ? logs.slice(0, limit) : logs;
  },

  async addActivityLog(log: Omit<ActivityLog, 'id'>): Promise<string> {
    const id = generateId();
    await db.activityLogs.add({ ...log, id });
    return id;
  },

  // Dashboard Stats
  async getDashboardStats(): Promise<{
    totalStudents: number;
    totalBoys: number;
    totalGirls: number;
    totalTeachingStaff: number;
    totalNonTeachingStaff: number;
    totalClasses: number;
    todayPresent: number;
    todayAbsent: number;
    feesCollected: number;
    outstandingBalances: number;
    inventoryItems: number;
  }> {
    const [students, staffCounts, classes, attendanceStats, feesCollected, outstanding, inventoryCount] =
      await Promise.all([
        db.students.where('enrollmentStatus').equals('active').toArray(),
        this.getStaffCount(),
        db.classes.where('status').equals('active').count(),
        this.getTodayAttendanceStats(),
        this.getFeesCollected(),
        this.getOutstandingBalances(),
        this.getInventoryCount(),
      ]);

    return {
      totalStudents: students.length,
      totalBoys: students.filter((s) => s.gender === 'male').length,
      totalGirls: students.filter((s) => s.gender === 'female').length,
      totalTeachingStaff: staffCounts.teaching,
      totalNonTeachingStaff: staffCounts.nonTeaching,
      totalClasses: classes,
      todayPresent: attendanceStats.present,
      todayAbsent: attendanceStats.absent,
      feesCollected,
      outstandingBalances: outstanding,
      inventoryItems: inventoryCount,
    };
  },

  // Enrollment by class
  async getEnrollmentByClass(academicYearId?: string): Promise<{ name: string; boys: number; girls: number; total: number }[]> {
    const classes = await this.getClasses(academicYearId);
    const students = await db.students.where('enrollmentStatus').equals('active').toArray();

    return classes.map((cls) => {
      const classStudents = students.filter((s) => s.currentClassId === cls.id);
      const boys = classStudents.filter((s) => s.gender === 'male').length;
      const girls = classStudents.filter((s) => s.gender === 'female').length;
      return {
        name: cls.name + (cls.stream ? ` ${cls.stream}` : ''),
        boys,
        girls,
        total: classStudents.length,
      };
    });
  },
};