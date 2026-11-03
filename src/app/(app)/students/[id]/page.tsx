'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Pencil, User, Phone, Mail, MapPin, Printer, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Avatar } from '@/components/ui/Avatar';
import { dataService } from '@/lib/db';
import { Student, Guardian, Class, Invoice, Payment, EnrollmentHistory, ReportCard, Assessment, AssessmentScore, AcademicYear, Term, SchoolSettings, AttendanceRecord } from '@/types';
import { formatDate, formatCurrency, calculateAge, getEnrollmentStatusLabel, getErrorMessage } from '@/lib/utils';

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [studentClass, setStudentClass] = useState<Class | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [enrollmentHistory, setEnrollmentHistory] = useState<EnrollmentHistory[]>([]);
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [assessmentResults, setAssessmentResults] = useState<Array<{ assessment: Assessment; score: AssessmentScore }>>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [selectedReportCardId, setSelectedReportCardId] = useState('');

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setLoadError('');
      try {
        const s = await dataService.getStudent(studentId);
        if (!s) {
          router.push('/students');
          return;
        }
        setStudent(s);
        const [g, c, inv, paymentRows, history, cards, studentScores, allAssessments, allClasses, years, loadedTerms, settings, attendanceRows] = await Promise.all([
          dataService.getGuardians(studentId),
          dataService.getClass(s.currentClassId),
          dataService.getInvoices({ studentId }),
          dataService.getPayments({ studentId }),
          dataService.getEnrollmentHistory(studentId),
          dataService.getReportCards(studentId),
          dataService.getAssessmentScoresForStudent(studentId),
          dataService.getAssessments(),
          dataService.getClasses(),
          dataService.getAcademicYears(),
          dataService.getTerms(),
          dataService.getSchoolSettings(),
          dataService.getAttendanceRecords({ studentId }),
        ]);
        const assessmentsById = new Map(allAssessments.map((assessment) => [assessment.id, assessment]));
        setGuardians(g);
        setStudentClass(c || null);
        setInvoices(inv);
        setPayments(paymentRows);
        setAttendance(attendanceRows);
        setEnrollmentHistory(history);
        setReportCards(cards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        setAssessmentResults(studentScores.flatMap((score) => {
          const assessment = assessmentsById.get(score.assessmentId);
          return assessment ? [{ assessment, score }] : [];
        }).sort((a, b) => b.assessment.date.localeCompare(a.assessment.date)));
        setClasses(allClasses);
        setAcademicYears(years);
        setTerms(loadedTerms);
        setSchoolSettings(settings ?? null);
      } catch (error) {
        setLoadError(getErrorMessage(error, 'Could not load this student record.'));
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [studentId, router]);

  useEffect(() => {
    if (!selectedReceiptId && !selectedReportCardId) return;
    const timer = window.setTimeout(() => window.print(), 100);
    return () => window.clearTimeout(timer);
  }, [selectedReceiptId, selectedReportCardId]);

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
  if (!student) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p role="alert" className="text-sm text-red-700">{loadError || 'Student record not found.'}</p>
          <Button className="mt-4" variant="outline" onClick={() => router.push('/students')}>Back to students</Button>
        </CardContent>
      </Card>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'guardians', label: 'Guardians', count: guardians.length },
    { id: 'attendance', label: 'Attendance' },
    { id: 'history', label: 'Academic History', count: enrollmentHistory.length },
    { id: 'results', label: 'Results & Report Cards', count: reportCards.length },
    { id: 'fees', label: 'Fee Statement', count: invoices.length },
    { id: 'payments', label: 'Payments & Receipts', count: payments.length },
  ];

  const outstanding = invoices.reduce((sum, i) => sum + i.outstandingBalance, 0);
  const selectedReceipt = payments.find((payment) => payment.id === selectedReceiptId);
  const receiptInvoice = selectedReceipt?.invoiceId
    ? invoices.find((invoice) => invoice.id === selectedReceipt.invoiceId)
    : undefined;
  const paidThroughReceipt = selectedReceipt && receiptInvoice
    ? payments
      .filter((payment) => payment.invoiceId === receiptInvoice.id && payment.status === 'completed' && payment.createdAt <= selectedReceipt.createdAt)
      .reduce((sum, payment) => sum + payment.amount, 0)
    : 0;
  const receiptBalance = receiptInvoice
    ? Math.max(0, receiptInvoice.totalAmount - paidThroughReceipt)
    : null;
  const selectedReportCard = reportCards.find((card) => card.id === selectedReportCardId);
  const visiblePayments = payments.filter((payment) => {
    const query = paymentSearch.trim().toLowerCase();
    return !query || payment.receiptNumber.toLowerCase().includes(query) ||
      payment.paymentReference.toLowerCase().includes(query) ||
      (payment.transactionReference ?? '').toLowerCase().includes(query);
  });
  const classNameById = new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass.name]));
  const yearNameById = new Map(academicYears.map((year) => [year.id, year.name]));
  const termNameById = new Map(terms.map((term) => [term.id, term.name]));
  const presentDays = attendance.filter((record) => record.status === 'present').length;
  const absentDays = attendance.filter((record) => record.status === 'absent').length;
  const lateDays = attendance.filter((record) => record.status === 'late').length;

  return (
    <div>
      <div className="print:hidden">
      {loadError && <p role="alert" className="mb-4 text-sm text-red-700">{loadError}</p>}
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        description={`${student.admissionNumber} · ${studentClass?.name || 'No class'}`}
        breadcrumbs={[
          { label: 'Students', href: '/students' },
          { label: `${student.firstName} ${student.lastName}` },
        ]}
        actions={
          <Button variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => router.push(`/students/${student.id}/edit`)}>
            Edit
          </Button>
        }
      />

      {/* Profile header */}
      <Card className="mb-6 p-6">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar firstName={student.firstName} lastName={student.lastName} src={student.photograph} size="xl" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">
                {student.lastName} {student.firstName} {student.otherNames}
              </h2>
              <Badge variant="status" status={student.enrollmentStatus}>
                {getEnrollmentStatusLabel(student.enrollmentStatus)}
              </Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-4">
              <p><span className="font-medium text-gray-500">Student ID:</span> {student.studentId}</p>
              <p><span className="font-medium text-gray-500">Gender:</span> <span className="capitalize">{student.gender}</span></p>
              <p><span className="font-medium text-gray-500">Age:</span> {calculateAge(student.dateOfBirth)} years</p>
              <p><span className="font-medium text-gray-500">DOB:</span> {formatDate(student.dateOfBirth)}</p>
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Admission Number', student.admissionNumber],
                ['Place of Birth', student.placeOfBirth],
                ['District', student.district],
                ['District Capital', student.districtCapital],
                ['Region', student.region],
                ['Religion', student.religion || '—'],
                ['Residential Address', student.residentialAddress],
                ['Digital Address', student.digitalAddress || '—'],
                ['NHIS Number', student.nhisNumber || '—'],
                ['Languages', student.languagesSpoken.join(', ')],
                ['Mother Tongue', student.motherTongue || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Enrollment & Transport</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                <span className="text-gray-500">Admission Date</span>
                <span className="font-medium text-gray-900">{formatDate(student.admissionDate)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                <span className="text-gray-500">Current Class</span>
                <span className="font-medium text-gray-900">{studentClass?.name || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                <span className="text-gray-500">Transport</span>
                <span className="font-medium capitalize text-gray-900">
                  {student.transportArrangement.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                <span className="text-gray-500">Outstanding Balance</span>
                <span className={`font-medium ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(outstanding)}
                </span>
              </div>
              {student.emergencyNotes && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  <p className="font-medium">Emergency Notes</p>
                  <p className="mt-1">{student.emergencyNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'guardians' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {guardians.map((g) => (
            <Card key={g.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{g.fullName}</p>
                    <p className="text-sm text-gray-500">{g.relationship}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {g.isPrimaryContact && <Badge>Primary</Badge>}
                  {g.isEmergencyContact && <Badge>Emergency</Badge>}
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4 text-gray-400" />
                  {g.phoneNumber}
                  {g.alternativePhone && ` / ${g.alternativePhone}`}
                </div>
                {g.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {g.email}
                  </div>
                )}
                {g.address && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {g.address}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'attendance' && (
        <Card>
          <CardHeader><CardTitle>Attendance Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ['Present', presentDays],
                ['Absent', absentDays],
                ['Late', lateDays],
                ['Total Days', attendance.length],
              ].map(([label, count]) => (
                <div key={label} className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-gray-500">{attendance.length ? `Attendance records on file: ${attendance.length}.` : 'No attendance records are available yet.'}</p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'results' && (
        <div className="space-y-4">
          {reportCards.length ? reportCards.map((card) => (
            <Card key={card.id}>
              <CardHeader>
                <div>
                  <CardTitle>{yearNameById.get(card.academicYearId) ?? 'Academic year'} · {termNameById.get(card.termId) ?? 'Term'}</CardTitle>
                  <p className="mt-1 text-sm text-gray-500">{classNameById.get(card.classId) ?? 'Class'} · {card.status}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">{card.averageScore.toFixed(2)} average</p>
                  <p className="text-gray-500">{card.position ? `Position ${card.position}` : 'Position not recorded'}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Subject</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Assessment /30</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Exam /70</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Final /100</th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Grade / remark</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {card.subjects.map((subject) => (
                        <tr key={subject.subjectId}>
                          <td className="px-3 py-2 text-sm">{subject.subjectName}</td>
                          <td className="px-3 py-2 text-right text-sm">{subject.classScore.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-sm">{subject.examScore.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-sm font-medium">{subject.totalScore.toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm">{subject.grade} · {subject.remark}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-3 py-2 text-sm">Total</td>
                        <td colSpan={2} className="px-3 py-2 text-right text-sm">{card.subjects.length} subject(s)</td>
                        <td className="px-3 py-2 text-right text-sm">{card.totalScore.toFixed(2)}</td>
                        <td className="px-3 py-2" />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Printer className="h-4 w-4" />}
                    onClick={() => setSelectedReportCardId(card.id)}
                  >
                    Print / save PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          )) : assessmentResults.length ? (
            <Card>
              <CardHeader><CardTitle>Assessment entries</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Assessment</th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Class / term</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Score</th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {assessmentResults.map(({ assessment, score }) => (
                        <tr key={score.id}>
                          <td className="px-3 py-2 text-sm font-medium">{assessment.name}</td>
                          <td className="px-3 py-2 text-sm text-gray-600">
                            {classNameById.get(assessment.classId) ?? 'Class'} · {yearNameById.get(assessment.academicYearId) ?? 'Year'} · {termNameById.get(assessment.termId) ?? 'Term'}
                          </td>
                          <td className="px-3 py-2 text-right text-sm">{score.score} / {assessment.maxScore}</td>
                          <td className="px-3 py-2 text-sm capitalize">{score.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent><p className="py-8 text-center text-sm text-gray-500">No academic results or report cards are recorded for this student.</p></CardContent></Card>
          )}
        </div>
      )}

      {activeTab === 'fees' && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Fee Statement</CardTitle>
              <p className="mt-1 text-sm text-gray-500">Expected {formatCurrency(invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0))} · Paid {formatCurrency(invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0))} · Balance {formatCurrency(outstanding)}</p>
            </div>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No invoices on record.</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div key={inv.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row">
                      <div>
                        <p className="font-medium text-gray-900">{inv.invoiceNumber}</p>
                        <p className="text-sm text-gray-500">
                          {yearNameById.get(inv.academicYearId) ?? 'Year'} · {termNameById.get(inv.termId) ?? 'Term'} · {classNameById.get(inv.classId) ?? 'Class'}
                        </p>
                        <p className="text-sm text-gray-500">Due {formatDate(inv.dueDate)} · {inv.status}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-medium text-gray-900">Target {formatCurrency(inv.totalAmount)}</p>
                        <p className="text-sm text-green-700">Paid {formatCurrency(inv.amountPaid)}</p>
                        <p className="text-sm text-red-600">Balance {formatCurrency(inv.outstandingBalance)}</p>
                      </div>
                    </div>
                    {inv.items.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm text-gray-600">
                        {inv.items.map((item) => (
                          <li key={item.id} className="flex justify-between gap-4">
                            <span>{item.description}</span><span>{formatCurrency(item.amount)}</span>
                          </li>
                        ))}
                        {inv.discount > 0 && (
                          <li className="flex justify-between gap-4 text-green-700">
                            <span>Discount</span><span>-{formatCurrency(inv.discount)}</span>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card>
          <CardHeader><CardTitle>Academic History</CardTitle></CardHeader>
          <CardContent>
            {enrollmentHistory.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No enrollment history is recorded for this student.</p>
            ) : (
              <ol className="space-y-4">
                {enrollmentHistory.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row">
                      <div>
                        <p className="font-semibold text-gray-900">{classNameById.get(entry.classId) ?? 'Class'} · {yearNameById.get(entry.academicYearId) ?? 'Academic year'}</p>
                        <p className="text-sm text-gray-500">{entry.termId ? termNameById.get(entry.termId) ?? 'Term' : 'Full-year enrollment'}</p>
                        {entry.notes && <p className="mt-1 text-sm text-gray-600">{entry.notes}</p>}
                      </div>
                      <div className="text-sm sm:text-right">
                        <p>{formatDate(entry.enrollmentDate)}{entry.exitDate ? ` – ${formatDate(entry.exitDate)}` : ''}</p>
                        <Badge variant="status" status={entry.status}>{getEnrollmentStatusLabel(entry.status)}</Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}
      {activeTab === 'payments' && (
        <Card>
          <CardHeader><CardTitle>Payment History & Receipts</CardTitle></CardHeader>
          <CardContent>
            <label className="relative mb-4 block max-w-lg">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                aria-label="Search payments by receipt or reference"
                value={paymentSearch}
                onChange={(event) => setPaymentSearch(event.target.value)}
                placeholder="Search receipt or transaction reference"
                className="min-h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm"
              />
            </label>
            {visiblePayments.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No payments match this search.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Receipt / Reference</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Academic period</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Method / status</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Amount</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Receipt</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {visiblePayments.map((payment) => {
                      const invoice = payment.invoiceId ? invoices.find((item) => item.id === payment.invoiceId) : undefined;
                      return (
                        <tr key={payment.id}>
                          <td className="px-3 py-3 text-sm">
                            <p className="font-medium">{payment.receiptNumber}</p>
                            <p className="text-xs text-gray-500">{payment.paymentReference}</p>
                          </td>
                          <td className="px-3 py-3 text-sm">{formatDate(payment.paymentDate)}</td>
                          <td className="px-3 py-3 text-sm text-gray-600">
                            {invoice ? `${yearNameById.get(invoice.academicYearId) ?? 'Year'} · ${termNameById.get(invoice.termId) ?? 'Term'}` : 'Unallocated'}
                          </td>
                          <td className="px-3 py-3 text-sm capitalize">{payment.paymentMethod.replace('_', ' ')} · {payment.status}</td>
                          <td className="px-3 py-3 text-right text-sm font-medium">{formatCurrency(payment.amount)}</td>
                          <td className="px-3 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Printer className="h-4 w-4" />}
                              onClick={() => setSelectedReceiptId(payment.id)}
                              disabled={payment.status !== 'completed'}
                            >
                              Print
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>
      {selectedReportCard && (
        <section className="hidden print:block">
          <div className="mx-auto max-w-4xl text-gray-900">
            <div className="mb-6 flex items-center gap-4 border-b pb-4">
              {schoolSettings?.logo && <div aria-hidden="true" className="h-16 w-16 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${schoolSettings.logo}")` }} />}
              <div>
                <h1 className="text-2xl font-bold">{schoolSettings?.name ?? 'Emmanuel Preparatory School'}</h1>
                <p>{schoolSettings?.address}</p>
                <p>{schoolSettings?.phoneNumbers.join(' · ')}</p>
              </div>
            </div>
            <h2 className="mb-2 text-center text-xl font-bold">STUDENT REPORT CARD</h2>
            <p className="mb-5 text-center">{yearNameById.get(selectedReportCard.academicYearId)} · {termNameById.get(selectedReportCard.termId)}</p>
            <div className="mb-5 grid grid-cols-2 gap-2 text-sm">
              <p><strong>Student:</strong> {student.lastName} {student.firstName} {student.otherNames}</p>
              <p><strong>Admission number:</strong> {student.admissionNumber}</p>
              <p><strong>Class:</strong> {classNameById.get(selectedReportCard.classId) ?? '—'}</p>
              <p><strong>Position:</strong> {selectedReportCard.position ?? '—'}</p>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-y">
                <th className="p-2 text-left">Subject</th><th className="p-2 text-right">Assessment /30</th>
                <th className="p-2 text-right">Exam /70</th><th className="p-2 text-right">Total /100</th>
                <th className="p-2 text-left">Grade</th><th className="p-2 text-left">Remark</th>
              </tr></thead>
              <tbody>{selectedReportCard.subjects.map((subject) => (
                <tr key={subject.subjectId} className="border-b">
                  <td className="p-2">{subject.subjectName}</td><td className="p-2 text-right">{subject.classScore.toFixed(2)}</td>
                  <td className="p-2 text-right">{subject.examScore.toFixed(2)}</td><td className="p-2 text-right">{subject.totalScore.toFixed(2)}</td>
                  <td className="p-2">{subject.grade}</td><td className="p-2">{subject.remark}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="mt-4 flex justify-between border-t pt-3 text-sm font-semibold">
              <span>Total: {selectedReportCard.totalScore.toFixed(2)}</span>
              <span>Average: {selectedReportCard.averageScore.toFixed(2)}</span>
              <span>Attendance: {selectedReportCard.attendancePresent}/{selectedReportCard.attendanceTotal}</span>
            </div>
            {selectedReportCard.headteacherComment && <p className="mt-4"><strong>School remark:</strong> {selectedReportCard.headteacherComment}</p>}
          </div>
        </section>
      )}
      {selectedReceipt && (
        <section className="hidden print:block">
          <div className="mx-auto max-w-xl border border-gray-300 p-8 text-gray-900">
            <div className="mb-5 flex items-center gap-4 border-b pb-4">
              {schoolSettings?.logo && <div aria-hidden="true" className="h-14 w-14 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${schoolSettings.logo}")` }} />}
              <div>
                <h1 className="text-xl font-bold">{schoolSettings?.name ?? 'Emmanuel Preparatory School'}</h1>
                <p className="text-sm">{schoolSettings?.address}</p>
                <p className="text-sm">{schoolSettings?.phoneNumbers.join(' · ')}</p>
              </div>
            </div>
            <h2 className="mb-4 text-center text-lg font-bold">OFFICIAL PAYMENT RECEIPT</h2>
            <div className="space-y-2 text-sm">
              <p><strong>Receipt number:</strong> {selectedReceipt.receiptNumber}</p>
              <p><strong>Payment reference:</strong> {selectedReceipt.paymentReference}</p>
              <p><strong>Student:</strong> {student.lastName} {student.firstName} {student.otherNames}</p>
              <p><strong>Admission number:</strong> {student.admissionNumber}</p>
              <p><strong>Class:</strong> {receiptInvoice ? classNameById.get(receiptInvoice.classId) : studentClass?.name ?? '—'}</p>
              <p><strong>Academic year / term:</strong> {receiptInvoice ? `${yearNameById.get(receiptInvoice.academicYearId) ?? '—'} / ${termNameById.get(receiptInvoice.termId) ?? '—'}` : 'Not allocated'}</p>
              <p><strong>Amount received:</strong> {formatCurrency(selectedReceipt.amount)}</p>
              <p><strong>Payment method:</strong> {selectedReceipt.paymentMethod.replace('_', ' ')}</p>
              <p><strong>Transaction reference:</strong> {selectedReceipt.transactionReference || '—'}</p>
              <p><strong>Date:</strong> {formatDate(selectedReceipt.paymentDate)}</p>
              <p><strong>Balance after payment:</strong> {receiptBalance === null ? 'Not available' : formatCurrency(receiptBalance)}</p>
            </div>
            <p className="mt-8 border-t pt-3 text-center text-xs">Thank you. Keep this receipt for your records.</p>
          </div>
        </section>
      )}
    </div>
  );
}