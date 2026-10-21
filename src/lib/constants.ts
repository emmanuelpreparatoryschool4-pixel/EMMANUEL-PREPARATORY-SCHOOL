import { SelectOption } from '@/types';

export const GENDERS: SelectOption[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export const ENROLLMENT_STATUSES: SelectOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'archived', label: 'Archived' },
];

export const TRANSPORT_ARRANGEMENTS: SelectOption[] = [
  { value: 'school_bus', label: 'School Bus' },
  { value: 'walking', label: 'Walking' },
  { value: 'private', label: 'Private Vehicle' },
  { value: 'other', label: 'Other' },
];

export const STAFF_CATEGORIES: SelectOption[] = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'headteacher', label: 'Headteacher' },
  { value: 'administrator', label: 'Administrator' },
  { value: 'cook', label: 'Cook' },
  { value: 'driver', label: 'Driver' },
  { value: 'other', label: 'Other' },
];

export const EMPLOYMENT_STATUSES: SelectOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'retired', label: 'Retired' },
];

export const MARITAL_STATUSES: SelectOption[] = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
];

export const ATTENDANCE_STATUSES: SelectOption[] = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' },
  { value: 'sick', label: 'Sick' },
];

export const PAYMENT_METHODS: SelectOption[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export const ITEM_CONDITIONS: SelectOption[] = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'damaged', label: 'Damaged' },
];

export const ITEM_STATUSES: SelectOption[] = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In Use' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'disposed', label: 'Disposed' },
  { value: 'missing', label: 'Missing' },
];

export const GHANA_REGIONS: SelectOption[] = [
  { value: 'ahafo', label: 'Ahafo' },
  { value: 'ashanti', label: 'Ashanti' },
  { value: 'bono', label: 'Bono' },
  { value: 'bono_east', label: 'Bono East' },
  { value: 'central', label: 'Central' },
  { value: 'eastern', label: 'Eastern' },
  { value: 'greater_accra', label: 'Greater Accra' },
  { value: 'north_east', label: 'North East' },
  { value: 'northern', label: 'Northern' },
  { value: 'oti', label: 'Oti' },
  { value: 'savannah', label: 'Savannah' },
  { value: 'upper_east', label: 'Upper East' },
  { value: 'upper_west', label: 'Upper West' },
  { value: 'volta', label: 'Volta' },
  { value: 'western', label: 'Western' },
  { value: 'western_north', label: 'Western North' },
];

export const LANGUAGES: SelectOption[] = [
  { value: 'akan', label: 'Akan' },
  { value: 'ewe', label: 'Ewe' },
  { value: 'ga', label: 'Ga' },
  { value: 'dagbani', label: 'Dagbani' },
  { value: 'dagaare', label: 'Dagaare' },
  { value: 'gonja', label: 'Gonja' },
  { value: 'hausa', label: 'Hausa' },
  { value: 'kasem', label: 'Kasem' },
  { value: 'mampruli', label: 'Mampruli' },
  { value: 'nanumba', label: 'Nanumba' },
  { value: 'twi', label: 'Twi' },
  { value: 'fante', label: 'Fante' },
  { value: 'english', label: 'English' },
  { value: 'french', label: 'French' },
  { value: 'other', label: 'Other' },
];

export const PREDEFINED_CLASSES = [
  { name: 'Creche', order: 1 },
  { name: 'Nursery 1', order: 2 },
  { name: 'Nursery 2', order: 3 },
  { name: 'KG 1', order: 4 },
  { name: 'KG 2', order: 5 },
  { name: 'Primary 1', order: 6 },
  { name: 'Primary 2', order: 7 },
  { name: 'Primary 3', order: 8 },
  { name: 'Primary 4', order: 9 },
  { name: 'Primary 5', order: 10 },
  { name: 'Primary 6', order: 11 },
];

export const DEFAULT_SUBJECTS = [
  { name: 'English Language', code: 'ENG' },
  { name: 'Mathematics', code: 'MATH' },
  { name: 'Integrated Science', code: 'SCI' },
  { name: 'Social Studies', code: 'SOC' },
  { name: 'Religious and Moral Education', code: 'RME' },
  { name: 'Ghanaian Language', code: 'GHL' },
  { name: 'Creative Arts', code: 'ART' },
  { name: 'Physical Education', code: 'PE' },
  { name: 'Computing', code: 'ICT' },
  { name: 'French', code: 'FRE' },
  { name: 'Career Technology', code: 'CT' },
];

export const DEFAULT_FEE_CATEGORIES = [
  { name: 'Tuition', description: 'Tuition fees', isRequired: true },
  { name: 'Feeding', description: 'Feeding fees', isRequired: false },
  { name: 'Transport', description: 'Transport fees', isRequired: false },
  { name: 'Books and Stationery', description: 'Books and stationery fees', isRequired: false },
  { name: 'Examination', description: 'Examination fees', isRequired: true },
  { name: 'Uniform', description: 'Uniform fees', isRequired: false },
  { name: 'Other', description: 'Other charges', isRequired: false },
];

export const DEFAULT_ASSESSMENT_TYPES = [
  { name: 'Class Test', defaultWeight: 30, defaultMaxScore: 100 },
  { name: 'Examination', defaultWeight: 70, defaultMaxScore: 100 },
  { name: 'Assignment', defaultWeight: 10, defaultMaxScore: 100 },
  { name: 'Project', defaultWeight: 20, defaultMaxScore: 100 },
];

export const DEFAULT_GRADING_SCALE = {
  name: 'Default Grading Scale',
  grades: [
    { grade: 'A', minScore: 80, maxScore: 100, remark: 'Excellent' },
    { grade: 'B', minScore: 70, maxScore: 79, remark: 'Very Good' },
    { grade: 'C', minScore: 60, maxScore: 69, remark: 'Good' },
    { grade: 'D', minScore: 50, maxScore: 59, remark: 'Credit' },
    { grade: 'E', minScore: 40, maxScore: 49, remark: 'Pass' },
    { grade: 'F', minScore: 0, maxScore: 39, remark: 'Fail' },
  ],
};

export const PAGE_SIZE_OPTIONS: SelectOption[] = [
  { value: '10', label: '10 per page' },
  { value: '25', label: '25 per page' },
  { value: '50', label: '50 per page' },
  { value: '100', label: '100 per page' },
];

export const DEMO_ACCOUNTS = [
  {
    role: 'owner' as const,
    email: 'owner@eps.edu.gh',
    password: 'owner123',
    name: 'School Owner',
  },
  {
    role: 'headmaster' as const,
    email: 'headmaster@eps.edu.gh',
    password: 'headmaster123',
    name: 'Headmaster',
  },
];