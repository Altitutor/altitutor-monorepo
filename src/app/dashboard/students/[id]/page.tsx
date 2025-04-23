'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Edit, Mail, Phone, FileText, Calendar, CreditCard, MessageSquare } from 'lucide-react';
import { useStudents, useClassEnrollments, useSessions, useSessionAttendances, useAbsences, useFiles } from '@/lib/db/hooks';
import { StudentStatus } from '@/lib/db/types';

type StudentPageProps = {
  params: {
    id: string;
  };
};

export default function StudentPage({ params }: StudentPageProps) {
  const router = useRouter();
  const { fetchById } = useStudents();
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const loadStudent = async () => {
      try {
        const studentData = await fetchById(params.id);
        if (!studentData) {
          setError("Student not found");
          return;
        }
        setStudent(studentData);
      } catch (err) {
        setError("Error loading student data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadStudent();
  }, [fetchById, params.id]);

  if (loading) {
    return <div className="p-6">Loading student data...</div>;
  }

  if (error || !student) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  const getStatusBadgeColor = (status: StudentStatus) => {
    switch (status) {
      case StudentStatus.CURRENT:
        return 'bg-green-100 text-green-800';
      case StudentStatus.INACTIVE:
        return 'bg-gray-100 text-gray-800';
      case StudentStatus.TRIAL:
        return 'bg-blue-100 text-blue-800';
      case StudentStatus.DISCONTINUED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {student.firstName} {student.lastName}
          </h1>
          <Badge className={getStatusBadgeColor(student.status)}>
            {student.status}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/students/${student.id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Email</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
              {student.email || 'Not provided'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Phone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
              {student.phoneNumber || 'Not provided'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Parent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div>{student.parentName || 'Not provided'}</div>
              {student.parentEmail && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="h-3 w-3 mr-1" />
                  {student.parentEmail}
                </div>
              )}
              {student.parentPhone && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Phone className="h-3 w-3 mr-1" />
                  {student.parentPhone}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Account Created</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              {new Date(student.createdAt).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="absences">Absences</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Student Overview</CardTitle>
                <CardDescription>Key information about this student</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-1">Notes</h3>
                    <p className="text-sm text-muted-foreground">
                      {student.notes || 'No notes available'}
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium mb-1">Student ID</h3>
                    <p className="text-sm font-mono">{student.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest events for this student</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground py-8">
                  No recent activity
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="classes" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Classes</CardTitle>
                <CardDescription>Classes this student is enrolled in</CardDescription>
              </div>
              <Button size="sm">Add to Class</Button>
            </CardHeader>
            <CardContent>
              <StudentClassesTable studentId={student.id} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sessions" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Session History</CardTitle>
                <CardDescription>All sessions this student has attended</CardDescription>
              </div>
              <Button size="sm">Record Session</Button>
            </CardHeader>
            <CardContent>
              <StudentSessionsTable studentId={student.id} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="absences" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Absences</CardTitle>
                <CardDescription>Record of student absences</CardDescription>
              </div>
              <Button size="sm">Record Absence</Button>
            </CardHeader>
            <CardContent>
              <StudentAbsencesTable studentId={student.id} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Documents</CardTitle>
                <CardDescription>Files associated with this student</CardDescription>
              </div>
              <Button size="sm">Upload Document</Button>
            </CardHeader>
            <CardContent>
              <StudentDocumentsTable studentId={student.id} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="communication" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Communication</CardTitle>
                <CardDescription>Messages and communication history</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                Communication history will be shown here
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Placeholder components for the tabs - these will be implemented fully later
function StudentClassesTable({ studentId }: { studentId: string }) {
  return (
    <div className="text-center text-muted-foreground py-8">
      Class enrollment data will be shown here
    </div>
  );
}

function StudentSessionsTable({ studentId }: { studentId: string }) {
  return (
    <div className="text-center text-muted-foreground py-8">
      Session history will be shown here
    </div>
  );
}

function StudentAbsencesTable({ studentId }: { studentId: string }) {
  return (
    <div className="text-center text-muted-foreground py-8">
      Absence records will be shown here
    </div>
  );
}

function StudentDocumentsTable({ studentId }: { studentId: string }) {
  return (
    <div className="text-center text-muted-foreground py-8">
      Student documents will be shown here
    </div>
  );
} 