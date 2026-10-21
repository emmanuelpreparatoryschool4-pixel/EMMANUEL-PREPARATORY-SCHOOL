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
import { supabase } from './supabase';

export interface EPSDatabase {
  users: SupabaseTable<User>;
  schoolSettings: SupabaseTable<SchoolSettings>;
  academicYears: SupabaseTable<AcademicYear>;
  terms: SupabaseTable<Term>;
  classes: SupabaseTable<Class>;
  subjects: SupabaseTable<Subject>;
  gradingScales: SupabaseTable<GradingScale>;
  students: SupabaseTable<Student>;
  guardians: SupabaseTable<Guardian>;
  enrollmentHistory: SupabaseTable<EnrollmentHistory>;
  staff: SupabaseTable<Staff>;
  qualifications: SupabaseTable<Qualification>;
  staffAssignments: SupabaseTable<StaffAssignment>;
  attendanceRecords: SupabaseTable<AttendanceRecord>;
  attendanceSessions: SupabaseTable<AttendanceSession>;
  syncQueue: SupabaseTable<SyncQueueItem>;
  assessmentTypes: SupabaseTable<AssessmentType>;
  assessments: SupabaseTable<Assessment>;
  assessmentScores: SupabaseTable<AssessmentScore>;
  reportCards: SupabaseTable<ReportCard>;
  feeCategories: SupabaseTable<FeeCategory>;
  feeStructures: SupabaseTable<FeeStructure>;
  invoices: SupabaseTable<Invoice>;
  payments: SupabaseTable<Payment>;
  financialAdjustments: SupabaseTable<FinancialAdjustment>;
  inventoryItems: SupabaseTable<InventoryItem>;
  inventoryMovements: SupabaseTable<InventoryMovement>;
  activityLogs: SupabaseTable<ActivityLog>;
}

type QueryFilter = { column: string; value: unknown };

const tableNames: Record<string, string> = {
  users: 'profiles',
  schoolSettings: 'school_settings',
  academicYears: 'academic_years',
  terms: 'terms',
  classes: 'classes',
  subjects: 'subjects',
  gradingScales: 'grading_scales',
  students: 'students',
  guardians: 'guardians',
  enrollmentHistory: 'enrollment_history',
  staff: 'staff',
  qualifications: 'qualifications',
  staffAssignments: 'staff_assignments',
  attendanceRecords: 'attendance_records',
  attendanceSessions: 'attendance_sessions',
  syncQueue: 'sync_queue',
  assessmentTypes: 'assessment_types',
  assessments: 'assessments',
  assessmentScores: 'assessment_scores',
  reportCards: 'report_cards',
  feeCategories: 'fee_categories',
  feeStructures: 'fee_structures',
  invoices: 'invoices',
  payments: 'payments',
  financialAdjustments: 'financial_adjustments',
  inventoryItems: 'inventory_items',
  inventoryMovements: 'inventory_movements',
  activityLogs: 'activity_logs',
};

const conflictColumns: Record<string, string> = {
  attendance_records: 'student_id,date',
  assessment_scores: 'assessment_id,student_id',
};

function getSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Add the project URL and anon key.');
  return supabase;
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function toDatabase(value: unknown, tableName: string, nested = false): unknown {
  if (Array.isArray(value)) return value.map((item) => toDatabase(item, tableName, true));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      let column = toSnakeCase(key);
      if (!nested && tableName === 'classes' && key === 'order') column = 'display_order';
      if (!nested && tableName === 'profiles' && key === 'name') column = 'full_name';
      if (!nested && tableName === 'profiles' && key === 'avatar') column = 'avatar_url';
      const normalized = column.endsWith('_date') && item === '' ? null : item;
      return [column, toDatabase(normalized, tableName, true)];
    })
  );
}

function fromDatabase<T>(value: unknown, tableName: string, nested = false): T {
  if (Array.isArray(value)) return value.map((item) => fromDatabase(item, tableName, true)) as T;
  if (!value || typeof value !== 'object') return value as T;

  return Object.fromEntries(
    Object.entries(value).map(([column, item]) => {
      let key = toCamelCase(column);
      if (!nested && tableName === 'classes' && column === 'display_order') key = 'order';
      if (!nested && tableName === 'profiles' && column === 'full_name') key = 'name';
      if (!nested && tableName === 'profiles' && column === 'avatar_url') key = 'avatar';
      return [key, fromDatabase(item, tableName, true)];
    })
  ) as T;
}

class SupabaseCollection<T> {
  constructor(
    protected readonly tableName: string,
    private readonly filters: QueryFilter[] = [],
    private readonly pendingColumn?: string,
    private readonly orderColumn?: string,
    private readonly ascending = true
  ) {}

  where(field: string): SupabaseCollection<T> {
    return new SupabaseCollection(this.tableName, this.filters, toSnakeCase(field), this.orderColumn, this.ascending);
  }

  equals(value: unknown): SupabaseCollection<T> {
    if (!this.pendingColumn) throw new Error('Call where(field) before equals(value).');
    return new SupabaseCollection(
      this.tableName,
      [...this.filters, { column: this.pendingColumn, value }],
      undefined,
      this.orderColumn,
      this.ascending
    );
  }

  orderBy(field: string): SupabaseCollection<T> {
    const column = this.tableName === 'classes' && field === 'order' ? 'display_order' : toSnakeCase(field);
    return new SupabaseCollection(this.tableName, this.filters, undefined, column, true);
  }

  reverse(): SupabaseCollection<T> {
    return new SupabaseCollection(
      this.tableName,
      this.filters,
      this.pendingColumn,
      this.orderColumn,
      !this.ascending
    );
  }

  toCollection(): SupabaseCollection<T> {
    return this;
  }

  private applyFilters(query: ReturnType<ReturnType<typeof getSupabase>['from']>['select'] extends (...args: never[]) => infer R ? R : never) {
    for (const filter of this.filters) query.eq(filter.column, filter.value);
    if (this.orderColumn) query.order(this.orderColumn, { ascending: this.ascending });
    return query;
  }

  async toArray(): Promise<T[]> {
    const query = getSupabase().from(this.tableName).select('*');
    const { data, error } = await this.applyFilters(query);
    if (error) throw error;
    return fromDatabase<T[]>(data ?? [], this.tableName);
  }

  async first(): Promise<T | undefined> {
    const query = getSupabase().from(this.tableName).select('*');
    const { data, error } = await this.applyFilters(query).limit(1).maybeSingle();
    if (error) throw error;
    return data ? fromDatabase<T>(data, this.tableName) : undefined;
  }

  async count(): Promise<number> {
    const query = getSupabase().from(this.tableName).select('*', { count: 'exact', head: true });
    const { count, error } = await this.applyFilters(query);
    if (error) throw error;
    return count ?? 0;
  }

  async sortBy(field: string): Promise<T[]> {
    const rows = await this.toArray();
    const key = toCamelCase(field);
    return rows.sort((left, right) => {
      const comparison = String((left as Record<string, unknown>)[key] ?? '').localeCompare(
        String((right as Record<string, unknown>)[key] ?? '')
      );
      return this.ascending ? comparison : -comparison;
    });
  }
}

class SupabaseTable<T> extends SupabaseCollection<T> {
  async get(id: string): Promise<T | undefined> {
    const { data, error } = await getSupabase().from(this.tableName).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? fromDatabase<T>(data, this.tableName) : undefined;
  }

  async add(value: T): Promise<string> {
    const { data, error } = await getSupabase()
      .from(this.tableName)
      .insert(toDatabase(value, this.tableName) as Record<string, unknown>)
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  }

  async bulkAdd(values: T[]): Promise<string[]> {
    if (!values.length) return [];
    const { data, error } = await getSupabase()
      .from(this.tableName)
      .insert(values.map((value) => toDatabase(value, this.tableName) as Record<string, unknown>))
      .select('id');
    if (error) throw error;
    return (data ?? []).map((row) => row.id as string);
  }

  async bulkPut(values: T[]): Promise<void> {
    if (!values.length) return;
    const onConflict = conflictColumns[this.tableName] ?? 'id';
    const { error } = await getSupabase()
      .from(this.tableName)
      .upsert(values.map((value) => toDatabase(value, this.tableName) as Record<string, unknown>), { onConflict });
    if (error) throw error;
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const { error } = await getSupabase().from(this.tableName).delete().in('id', ids);
    if (error) throw error;
  }

  async update(id: string, value: Partial<T>): Promise<void> {
    const { error } = await getSupabase()
      .from(this.tableName)
      .update(toDatabase(value, this.tableName) as Record<string, unknown>)
      .eq('id', id);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabase().from(this.tableName).delete().eq('id', id);
    if (error) throw error;
  }
}

function createSupabaseDatabase() {
  return Object.fromEntries(
    Object.entries(tableNames).map(([property, relation]) => [property, new SupabaseTable(relation)])
  );
}

export const db = createSupabaseDatabase() as unknown as EPSDatabase;

export async function seedSchoolSetup(): Promise<void> {
  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear();
  const academicYearId = `academic-year-${currentYear}`;

  if ((await db.schoolSettings.count()) === 0) {
    await db.schoolSettings.add({
      id: 'school-1',
      name: 'Emmanuel Preparatory School',
      abbreviation: 'E.P.S.',
      address: '',
      digitalAddress: '',
      phoneNumbers: [],
      email: '',
      establishmentDate: '',
      proprietorName: '',
      headteacherName: '',
      motto: '',
      currency: 'GHS',
      timezone: 'Africa/Accra',
      language: 'English',
      createdAt: now,
      updatedAt: now,
    } as SchoolSettings);
  }

  let academicYear = await db.academicYears.get(academicYearId);
  if (!academicYear) {
    academicYear = {
      id: academicYearId,
      name: `${currentYear}/${currentYear + 1}`,
      startDate: `${currentYear}-09-01`,
      endDate: `${currentYear + 1}-07-31`,
      isCurrent: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await db.academicYears.add(academicYear);
  }

  if ((await db.terms.count()) === 0) {
    await db.terms.bulkAdd([
      { id: `term-${currentYear}-1`, academicYearId, name: 'First Term', startDate: `${currentYear}-09-01`, endDate: `${currentYear}-12-20`, isCurrent: true, status: 'active', createdAt: now, updatedAt: now },
      { id: `term-${currentYear}-2`, academicYearId, name: 'Second Term', startDate: `${currentYear + 1}-01-10`, endDate: `${currentYear + 1}-04-05`, isCurrent: false, status: 'active', createdAt: now, updatedAt: now },
      { id: `term-${currentYear}-3`, academicYearId, name: 'Third Term', startDate: `${currentYear + 1}-04-20`, endDate: `${currentYear + 1}-07-31`, isCurrent: false, status: 'active', createdAt: now, updatedAt: now },
    ]);
  }

  if ((await db.classes.count()) === 0) {
    await db.classes.bulkAdd(
      PREDEFINED_CLASSES.map((schoolClass) => ({
        id: `${academicYearId}-${schoolClass.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        ...schoolClass,
        academicYearId,
        capacity: 40,
        status: 'active' as const,
        order: schoolClass.order,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  if ((await db.subjects.count()) === 0) {
    await db.subjects.bulkAdd(
      DEFAULT_SUBJECTS.map((subject) => ({
        id: `default-subject-${subject.code.toLowerCase()}`,
        ...subject,
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  if ((await db.gradingScales.count()) === 0) {
    await db.gradingScales.add({
      id: 'default-grading-scale',
      name: DEFAULT_GRADING_SCALE.name,
      grades: DEFAULT_GRADING_SCALE.grades,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  if ((await db.feeCategories.count()) === 0) {
    await db.feeCategories.bulkAdd(
      DEFAULT_FEE_CATEGORIES.map((category, index) => ({
        id: `default-fee-category-${index + 1}`,
        ...category,
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  if ((await db.assessmentTypes.count()) === 0) {
    await db.assessmentTypes.bulkAdd(
      DEFAULT_ASSESSMENT_TYPES.map((type, index) => ({
        id: `default-assessment-type-${index + 1}`,
        ...type,
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }
}

const privateStaffFields = [
  'ssnitNumber',
  'tin',
  'ghanaCardNumber',
  'nhisNumber',
  'bankName',
  'bankAccountName',
  'bankAccountNumber',
  'bankBranch',
] as const;

function splitStaffData(value: Partial<Staff>): {
  publicData: Record<string, unknown>;
  privateData: Record<string, unknown>;
} {
  const publicData = { ...value } as Record<string, unknown>;
  const privateData: Record<string, unknown> = {};
  for (const field of privateStaffFields) {
    if (field in publicData) {
      privateData[field] = publicData[field];
      delete publicData[field];
    }
  }
  return { publicData, privateData };
}

async function saveStaffPrivateDetails(staffId: string, details: Record<string, unknown>): Promise<void> {
  if (!Object.values(details).some((value) => value !== undefined)) return;
  const { error } = await getSupabase()
    .from('staff_private_details')
    .upsert(
      { staff_id: staffId, ...toDatabase(details, 'staff_private_details') as Record<string, unknown> },
      { onConflict: 'staff_id' }
    );
  if (error) throw error;
}

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
    } else {
      const now = new Date().toISOString();
      await db.schoolSettings.add({
        id: 'school-1',
        name: settings.name ?? 'Emmanuel Preparatory School',
        abbreviation: settings.abbreviation ?? 'E.P.S.',
        address: settings.address ?? '',
        digitalAddress: settings.digitalAddress ?? '',
        phoneNumbers: settings.phoneNumbers ?? [],
        email: settings.email ?? '',
        establishmentDate: settings.establishmentDate ?? '',
        proprietorName: settings.proprietorName ?? '',
        headteacherName: settings.headteacherName ?? '',
        motto: settings.motto ?? '',
        currency: 'GHS',
        timezone: 'Africa/Accra',
        language: 'English',
        ...settings,
        createdAt: now,
        updatedAt: now,
      } as SchoolSettings);
    }
  },

  // Academic Years
  async getAcademicYears(): Promise<AcademicYear[]> {
    return db.academicYears.orderBy('name').reverse().toArray();
  },

  async getCurrentAcademicYear(): Promise<AcademicYear | undefined> {
    const years = await db.academicYears.toArray();
    return years.find((year) => year.isCurrent) ?? years[0];
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
    const staff = await db.staff.get(id);
    if (!staff) return undefined;

    const { data, error } = await getSupabase()
      .from('staff_private_details')
      .select('*')
      .eq('staff_id', id)
      .maybeSingle();
    if (error) throw error;

    return data ? { ...staff, ...fromDatabase<Partial<Staff>>(data, 'staff_private_details') } : staff;
  },

  async getQualifications(staffId: string): Promise<Qualification[]> {
    return db.qualifications.where('staffId').equals(staffId).toArray();
  },

  async addStaff(staff: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();
    const { publicData, privateData } = splitStaffData(staff);
    await db.staff.add({ ...publicData, id, createdAt: now, updatedAt: now } as unknown as Staff);
    await saveStaffPrivateDetails(id, privateData);
    return id;
  },

  async updateStaff(id: string, data: Partial<Staff>): Promise<void> {
    const { publicData, privateData } = splitStaffData(data);
    await db.staff.update(id, { ...publicData, updatedAt: new Date().toISOString() } as Partial<Staff>);
    await saveStaffPrivateDetails(id, privateData);
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
    const assessment = await db.assessments.get(assessmentId);
    if (!assessment) throw new Error('Assessment not found.');

    const existingScores = await db.assessmentScores.where('assessmentId').equals(assessmentId).toArray();
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