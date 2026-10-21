// ============================================
// USER & AUTH TYPES
// ============================================

export type UserRole = 'owner' | 'headmaster';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  staffId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ============================================
// SCHOOL TYPES
// ============================================

export interface SchoolSettings {
  id: string;
  name: string;
  abbreviation: string;
  logo?: string;
  address: string;
  digitalAddress: string;
  phoneNumbers: string[];
  email: string;
  establishmentDate: string;
  proprietorName: string;
  headteacherName: string;
  motto: string;
  currency: string;
  timezone: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Term {
  id: string;
  academicYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  name: string;
  stream?: string;
  academicYearId: string;
  classTeacherId?: string;
  capacity: number;
  location?: string;
  status: 'active' | 'archived';
  notes?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface GradingScale {
  id: string;
  name: string;
  grades: Grade[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Grade {
  grade: string;
  minScore: number;
  maxScore: number;
  remark: string;
  points?: number;
}

// ============================================
// STUDENT TYPES
// ============================================

export type Gender = 'male' | 'female';
export type EnrollmentStatus = 'active' | 'transferred' | 'withdrawn' | 'graduated' | 'archived';
export type TransportArrangement = 'school_bus' | 'walking' | 'private' | 'other';

export interface Student {
  id: string;
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  preferredName?: string;
  gender: Gender;
  dateOfBirth: string;
  nhisNumber?: string;
  languagesSpoken: string[];
  motherTongue?: string;
  placeOfBirth: string;
  district: string;
  districtCapital: string;
  region: string;
  religion?: string;
  residentialAddress: string;
  digitalAddress?: string;
  photograph?: string;
  admissionDate: string;
  currentClassId: string;
  stream?: string;
  academicYearId: string;
  enrollmentStatus: EnrollmentStatus;
  transportArrangement: TransportArrangement;
  emergencyNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Guardian {
  id: string;
  studentId: string;
  fullName: string;
  relationship: string;
  phoneNumber: string;
  alternativePhone?: string;
  email?: string;
  address?: string;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  isAuthorizedPickup: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentHistory {
  id: string;
  studentId: string;
  classId: string;
  academicYearId: string;
  termId?: string;
  enrollmentDate: string;
  exitDate?: string;
  status: EnrollmentStatus;
  notes?: string;
  createdAt: string;
}

// ============================================
// STAFF TYPES
// ============================================

export type StaffCategory = 'teacher' | 'headteacher' | 'administrator' | 'cook' | 'driver' | 'other';
export type EmploymentStatus = 'active' | 'on_leave' | 'suspended' | 'terminated' | 'retired';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

export interface Staff {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  gender: Gender;
  dateOfBirth: string;
  hometown?: string;
  placeOfBirth?: string;
  district?: string;
  districtCapital?: string;
  region?: string;
  residentialAddress?: string;
  digitalAddress?: string;
  phoneNumber: string;
  email?: string;
  maritalStatus?: MaritalStatus;
  numberOfChildren?: number;
  languagesSpoken: string[];
  motherTongue?: string;
  tribe?: string;
  religion?: string;
  photograph?: string;
  
  // Employment details
  staffCategory: StaffCategory;
  isTrained: boolean;
  registrationNumber?: string;
  fileNumber?: string;
  appointmentDate: string;
  currentRank?: string;
  datePromoted?: string;
  payLevel?: string;
  currentStation?: string;
  datePostedToStation?: string;
  formerSchool?: string;
  classInChargeId?: string;
  subjectsTaught: string[];
  employmentStatus: EmploymentStatus;
  schoolPortfolio?: string;
  tvetSkills?: string;
  
  // Sensitive information (admin only)
  ssnitNumber?: string;
  tin?: string;
  ghanaCardNumber?: string;
  nhisNumber?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  
  // Next of kin
  nextOfKinName?: string;
  nextOfKinRelationship?: string;
  nextOfKinContact?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface Qualification {
  id: string;
  staffId: string;
  qualification: string;
  institution: string;
  schoolAttended?: string;
  course?: string;
  yearStarted: number;
  yearCompleted: number;
  professionalQualification?: string;
  certificateUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffAssignment {
  id: string;
  staffId: string;
  classId?: string;
  subjectId?: string;
  academicYearId: string;
  termId?: string;
  assignmentType: 'class_teacher' | 'subject_teacher' | 'assistant';
  startDate: string;
  endDate?: string;
  status: 'active' | 'ended';
  createdAt: string;
}

// ============================================
// ATTENDANCE TYPES
// ============================================

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'sick';
export type SyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: AttendanceStatus;
  remarks?: string;
  recordedBy: string;
  syncStatus: SyncStatus;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceSession {
  id: string;
  classId: string;
  date: string;
  termId: string;
  academicYearId: string;
  recordedBy: string;
  status: 'draft' | 'completed';
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string;
  entityType: 'attendance' | 'assessment' | 'other';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  data: unknown;
  status: SyncStatus;
  retryCount: number;
  lastAttempt?: string;
  error?: string;
  createdAt: string;
}

// ============================================
// ACADEMICS TYPES
// ============================================

export interface AssessmentType {
  id: string;
  name: string;
  description?: string;
  defaultWeight: number;
  defaultMaxScore: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Assessment {
  id: string;
  name: string;
  assessmentTypeId: string;
  classId: string;
  subjectId: string;
  termId: string;
  academicYearId: string;
  teacherId: string;
  maxScore: number;
  weight: number;
  date: string;
  status: 'draft' | 'open' | 'closed' | 'graded';
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentScore {
  id: string;
  assessmentId: string;
  studentId: string;
  score: number;
  grade?: string;
  remarks?: string;
  status: 'draft' | 'submitted';
  createdAt: string;
  updatedAt: string;
}

export interface ReportCard {
  id: string;
  studentId: string;
  classId: string;
  termId: string;
  academicYearId: string;
  subjects: ReportCardSubject[];
  totalScore: number;
  averageScore: number;
  position?: number;
  attendancePresent: number;
  attendanceTotal: number;
  conduct?: string;
  teacherComment?: string;
  headteacherComment?: string;
  promotionDecision?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface ReportCardSubject {
  subjectId: string;
  subjectName: string;
  classScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  remark: string;
  position?: number;
}

// ============================================
// FEES TYPES
// ============================================

export interface FeeCategory {
  id: string;
  name: string;
  description?: string;
  isRequired: boolean;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructure {
  id: string;
  academicYearId: string;
  termId: string;
  classId: string;
  feeCategoryId: string;
  amount: number; // in pesewas (minor units)
  dueDate: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  classId: string;
  academicYearId: string;
  termId: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  dueDate: string;
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  feeCategoryId: string;
  description: string;
  amount: number;
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque' | 'other';

export interface Payment {
  id: string;
  receiptNumber: string;
  paymentReference: string;
  studentId: string;
  invoiceId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  recordedBy: string;
  notes?: string;
  status: 'completed' | 'reversed';
  createdAt: string;
  updatedAt: string;
}

export interface FinancialAdjustment {
  id: string;
  studentId: string;
  invoiceId?: string;
  type: 'discount' | 'waiver' | 'scholarship' | 'correction';
  amount: number;
  reason: string;
  approvedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

// ============================================
// INVENTORY TYPES
// ============================================

export type ItemCondition = 'new' | 'good' | 'fair' | 'poor' | 'damaged';
export type ItemStatus = 'available' | 'in_use' | 'maintenance' | 'disposed' | 'missing';

export interface InventoryItem {
  id: string;
  inventoryCode: string;
  name: string;
  category: string;
  description?: string;
  assignedClassId?: string;
  location?: string;
  quantity: number;
  unit: string;
  condition: ItemCondition;
  acquisitionDate?: string;
  acquisitionCost?: number;
  supplier?: string;
  custodianId?: string;
  notes?: string;
  lastInspectionDate?: string;
  status: ItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  movementType: 'received' | 'issued' | 'returned' | 'damaged' | 'missing' | 'repaired' | 'disposed' | 'transferred';
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  fromClassId?: string;
  toClassId?: string;
  performedBy: string;
  notes?: string;
  createdAt: string;
}

// ============================================
// ACTIVITY TYPES
// ============================================

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
  timestamp: string;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardStats {
  totalStudents: number;
  totalBoys: number;
  totalGirls: number;
  totalTeachingStaff: number;
  totalNonTeachingStaff: number;
  totalClasses: number;
  todayAttendance: number;
  todayAbsent: number;
  feesCollected: number;
  outstandingBalances: number;
  inventoryItems: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

// ============================================
// UI TYPES
// ============================================

export interface SelectOption {
  value: string;
  label: string;
}

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface FilterState {
  search: string;
  [key: string]: string | number | boolean | undefined;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// ============================================
// FORM TYPES
// ============================================

export interface StudentFormData {
  firstName: string;
  lastName: string;
  otherNames?: string;
  preferredName?: string;
  gender: Gender;
  dateOfBirth: string;
  nhisNumber?: string;
  languagesSpoken: string[];
  motherTongue?: string;
  placeOfBirth: string;
  district: string;
  districtCapital: string;
  region: string;
  religion?: string;
  residentialAddress: string;
  digitalAddress?: string;
  admissionDate: string;
  currentClassId: string;
  stream?: string;
  academicYearId: string;
  enrollmentStatus: EnrollmentStatus;
  transportArrangement: TransportArrangement;
  emergencyNotes?: string;
  guardians: GuardianFormData[];
}

export interface GuardianFormData {
  fullName: string;
  relationship: string;
  phoneNumber: string;
  alternativePhone?: string;
  email?: string;
  address?: string;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  isAuthorizedPickup: boolean;
}

export interface StaffFormData {
  firstName: string;
  lastName: string;
  otherNames?: string;
  gender: Gender;
  dateOfBirth: string;
  hometown?: string;
  placeOfBirth?: string;
  district?: string;
  districtCapital?: string;
  region?: string;
  residentialAddress?: string;
  digitalAddress?: string;
  phoneNumber: string;
  email?: string;
  maritalStatus?: MaritalStatus;
  numberOfChildren?: number;
  languagesSpoken: string[];
  motherTongue?: string;
  tribe?: string;
  religion?: string;
  staffCategory: StaffCategory;
  isTrained: boolean;
  registrationNumber?: string;
  fileNumber?: string;
  appointmentDate: string;
  currentRank?: string;
  datePromoted?: string;
  payLevel?: string;
  currentStation?: string;
  datePostedToStation?: string;
  formerSchool?: string;
  subjectsTaught: string[];
  employmentStatus: EmploymentStatus;
  schoolPortfolio?: string;
}