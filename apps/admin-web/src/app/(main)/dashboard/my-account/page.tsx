'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mail, Phone, Calendar, User, UserCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { useStaff } from '@/shared/hooks';
import { Staff } from '@/shared/lib/supabase/database/types';

export default function MyAccountPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { findByField, loading: staffLoading } = useStaff();
  const [staffRecord, setStaffRecord] = useState<Staff | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStaffRecord = async () => {
      if (!user?.id) return;
      
      try {
        const staff = await findByField('user_id', user.id);
        setStaffRecord(staff);
      } catch (err) {
        setError('Failed to load staff record');
        console.error(err);
      }
    };
    
    fetchStaffRecord();
  }, [user, findByField]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Not authenticated</h2>
          <p className="text-gray-600 mb-4">Please log in to view your account details.</p>
          <Link href="/login">
            <Button>Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">My Account</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              Your authentication and account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Email</span>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{user.email}</span>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Account ID</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {user.id}
              </span>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Role</span>
              {/* NOTE: Role now comes from staff table, not JWT claims */}
              <Badge variant={staffRecord?.role === 'ADMINSTAFF' ? 'default' : 'secondary'}>
                {staffRecord?.role || 'Loading...'}
              </Badge>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Account Created</span>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Staff Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Staff Information
            </CardTitle>
            <CardDescription>
              Your staff profile and contact details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {staffLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Loading staff information...</p>
              </div>
            ) : error ? (
              <div className="text-center py-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : staffRecord ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Full Name</span>
                  <span className="font-medium">
                    {staffRecord.firstName} {staffRecord.lastName}
                  </span>
                </div>
                
                <Separator />
                
                {staffRecord.phoneNumber && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Phone</span>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{staffRecord.phoneNumber}</span>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <Badge variant={staffRecord.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {staffRecord.status}
                  </Badge>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Staff Since</span>
                  <span className="text-sm">
                    {new Date(staffRecord.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                {staffRecord.notes && (
                  <>
                    <Separator />
                    <div>
                      <span className="text-sm text-gray-600 block mb-2">Notes</span>
                      <p className="text-sm bg-gray-50 p-3 rounded-md">
                        {staffRecord.notes}
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-600">No staff record found</p>
                <p className="text-xs text-gray-500 mt-1">
                  Contact an administrator to set up your staff profile
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Security Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Security & Access
          </CardTitle>
          <CardDescription>
            Manage your account security and access permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600">
            <p className="mb-4">
              Your account permissions are managed through your staff role. Contact an administrator 
              if you need to change your access level or update your account details.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 font-medium mb-2">Need Help?</p>
              <p className="text-blue-700 text-sm">
                If you have questions about your account or need assistance, please contact 
                your system administrator or IT support team.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 