import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const guardianSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  relationship: z.string().min(1, 'Relationship is required'),
  phoneNumber: z.string().min(10, 'Valid phone number is required'),
  alternativePhone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  isPrimaryContact: z.boolean(),
  isEmergencyContact: z.boolean(),
  isAuthorizedPickup: z.boolean(),
});

export const studentSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  otherNames: z.string().optional(),
  preferredName: z.string().optional(),
  gender: z.enum(['male', 'female'], { required_error: 'Gender is required' }),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  nhisNumber: z.string().optional(),
  languagesSpoken: z.array(z.string()).min(1, 'At least one language is required'),
  motherTongue: z.string().optional(),
  placeOfBirth: z.string().min(1, 'Place of birth is required'),
  district: z.string().min(1, 'District is required'),
  districtCapital: z.string().min(1, 'District capital is required'),
  region: z.string().min(1, 'Region is required'),
  religion: z.string().optional(),
  residentialAddress: z.string().min(1, 'Residential address is required'),
  digitalAddress: z.string().optional(),
  admissionDate: z.string().min(1, 'Admission date is required'),
  currentClassId: z.string().min(1, 'Class is required'),
  stream: z.string().optional(),
  academicYearId: z.string().min(1, 'Academic year is required'),
  enrollmentStatus: z.enum(['active', 'transferred', 'withdrawn', 'graduated', 'archived']),
  transportArrangement: z.enum(['school_bus', 'walking', 'private', 'other']),
  emergencyNotes: z.string().optional(),
  guardians: z.array(guardianSchema).min(1, 'At least one guardian is required'),
});

export type StudentFormValues = z.infer<typeof studentSchema>;

export const staffSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  otherNames: z.string().optional(),
  gender: z.enum(['male', 'female'], { required_error: 'Gender is required' }),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  hometown: z.string().optional(),
  placeOfBirth: z.string().optional(),
  district: z.string().optional(),
  districtCapital: z.string().optional(),
  region: z.string().optional(),
  residentialAddress: z.string().optional(),
  digitalAddress: z.string().optional(),
  phoneNumber: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  numberOfChildren: z.number().min(0).optional(),
  languagesSpoken: z.array(z.string()).min(1, 'At least one language is required'),
  motherTongue: z.string().optional(),
  tribe: z.string().optional(),
  religion: z.string().optional(),
  staffCategory: z.enum(['teacher', 'headteacher', 'administrator', 'cook', 'driver', 'other']),
  isTrained: z.boolean(),
  registrationNumber: z.string().optional(),
  fileNumber: z.string().optional(),
  appointmentDate: z.string().min(1, 'Appointment date is required'),
  currentRank: z.string().optional(),
  datePromoted: z.string().optional(),
  payLevel: z.string().optional(),
  currentStation: z.string().optional(),
  datePostedToStation: z.string().optional(),
  formerSchool: z.string().optional(),
  subjectsTaught: z.array(z.string()),
  employmentStatus: z.enum(['active', 'on_leave', 'suspended', 'terminated', 'retired']),
  schoolPortfolio: z.string().optional(),
  ssnitNumber: z.string().optional(),
  tin: z.string().optional(),
  ghanaCardNumber: z.string().optional(),
  nhisNumber: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankBranch: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinRelationship: z.string().optional(),
  nextOfKinContact: z.string().optional(),
});

export type StaffFormValues = z.infer<typeof staffSchema>;

export const classSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  stream: z.string().optional(),
  academicYearId: z.string().min(1, 'Academic year is required'),
  classTeacherId: z.string().optional(),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export type ClassFormValues = z.infer<typeof classSchema>;

export const assessmentSchema = z.object({
  name: z.string().min(1, 'Assessment name is required'),
  assessmentTypeId: z.string().min(1, 'Assessment type is required'),
  classId: z.string().min(1, 'Class is required'),
  subjectId: z.string().min(1, 'Subject is required'),
  termId: z.string().min(1, 'Term is required'),
  academicYearId: z.string().min(1, 'Academic year is required'),
  teacherId: z.string().min(1, 'Teacher is required'),
  maxScore: z.number().min(1, 'Maximum score must be at least 1'),
  weight: z.number().min(1).max(100, 'Weight must be between 1 and 100'),
  date: z.string().min(1, 'Date is required'),
});

export type AssessmentFormValues = z.infer<typeof assessmentSchema>;

export const invoiceSchema = z.object({
  studentId: z.string().min(1, 'Student is required'),
  academicYearId: z.string().min(1, 'Academic year is required'),
  termId: z.string().min(1, 'Term is required'),
  items: z.array(z.object({
    feeCategoryId: z.string().min(1, 'Fee category is required'),
    description: z.string().min(1, 'Description is required'),
    amount: z.number().min(0, 'Amount must be positive'),
  })).min(1, 'At least one fee item is required'),
  discount: z.number().min(0).optional(),
  dueDate: z.string().min(1, 'Due date is required'),
});

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export const paymentSchema = z.object({
  studentId: z.string().min(1, 'Student is required'),
  invoiceId: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'mobile_money', 'cheque', 'other']),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

export const inventoryItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  assignedClassId: z.string().optional(),
  location: z.string().optional(),
  quantity: z.number().min(0, 'Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  condition: z.enum(['new', 'good', 'fair', 'poor', 'damaged']),
  acquisitionDate: z.string().optional(),
  acquisitionCost: z.number().min(0).optional(),
  supplier: z.string().optional(),
  custodianId: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['available', 'in_use', 'maintenance', 'disposed', 'missing']),
});

export type InventoryItemFormValues = z.infer<typeof inventoryItemSchema>;

export const schoolSettingsSchema = z.object({
  name: z.string().min(1, 'School name is required'),
  abbreviation: z.string().min(1, 'Abbreviation is required'),
  address: z.string().min(1, 'Address is required'),
  digitalAddress: z.string().optional(),
  phoneNumbers: z.array(z.string()).min(1, 'At least one phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  establishmentDate: z.string().optional(),
  proprietorName: z.string().optional(),
  headteacherName: z.string().optional(),
  motto: z.string().optional(),
});

export type SchoolSettingsFormValues = z.infer<typeof schoolSettingsSchema>;

export const academicYearSchema = z.object({
  name: z.string().min(1, 'Academic year name is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  isCurrent: z.boolean(),
});

export type AcademicYearFormValues = z.infer<typeof academicYearSchema>;

export const termSchema = z.object({
  academicYearId: z.string().min(1, 'Academic year is required'),
  name: z.string().min(1, 'Term name is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  isCurrent: z.boolean(),
});

export type TermFormValues = z.infer<typeof termSchema>;