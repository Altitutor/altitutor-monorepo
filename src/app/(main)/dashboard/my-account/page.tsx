'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mail, Phone, Calendar, User, UserCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/supabase/auth';
import { AuthState as AuthStore } from '@/lib/supabase/auth';
import { useStaff } from '@/lib/hooks';
import { Staff } from '@/lib/supabase/db/types';

export default function MyAccountPage() {
  const router = useRouter();
  const { user } = useAuthStore() as AuthStore;
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
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">My Account</h1>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <p className="text-muted-foreground">Not logged in</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">My Account</h1>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Account Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>User Account</CardTitle>
                <CardDescription>Your authentication details</CardDescription>
              </div>
              <UserCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">User ID</h3>
              <p className="text-sm">{user.id}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Email</h3>
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                <p className="text-sm">{user.email}</p>
              </div>
            </div>

            {user.user_metadata?.name && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Name</h3>
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                  <p className="text-sm">{user.user_metadata.name}</p>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Role</h3>
              <div className="flex items-center">
                <ShieldCheck className="h-4 w-4 mr-2 text-muted-foreground" />
                <Badge>{user.user_metadata?.user_role || 'No role assigned'}</Badge>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Account Created</h3>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <p className="text-sm">{new Date(user.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Last Sign In</h3>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <p className="text-sm">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Staff Record */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Staff Record</CardTitle>
                  <CardDescription>Your staff information</CardDescription>
                </div>
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">Loading staff record...</p>
                </div>
              ) : error ? (
                <div className="text-center py-6">
                  <p className="text-red-500">{error}</p>
                </div>
              ) : !staffRecord ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No staff record found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Staff ID</h3>
                      <p className="text-sm">{staffRecord.id}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Name</h3>
                      <p className="text-sm font-medium">{staffRecord.firstName} {staffRecord.lastName}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Email</h3>
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                        <p className="text-sm">{staffRecord.email}</p>
                      </div>
                    </div>

                    {staffRecord.phoneNumber && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Phone</h3>
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                          <p className="text-sm">{staffRecord.phoneNumber}</p>
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Role</h3>
                      <Badge variant="outline">{staffRecord.role}</Badge>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Status</h3>
                      <Badge 
                        className={
                          staffRecord.status === 'ACTIVE' 
                            ? 'bg-green-100 text-green-800' 
                            : staffRecord.status === 'TRIAL'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {staffRecord.status}
                      </Badge>
                    </div>

                    {staffRecord.office_key_number !== null && staffRecord.office_key_number !== undefined && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Office Key Number</h3>
                        <p className="text-sm">#{staffRecord.office_key_number}</p>
                      </div>
                    )}

                    {staffRecord.has_parking_remote && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Parking Remote</h3>
                        <Badge 
                          className={
                            staffRecord.has_parking_remote === 'PHYSICAL' 
                              ? 'bg-blue-100 text-blue-800' 
                              : staffRecord.has_parking_remote === 'VIRTUAL'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {staffRecord.has_parking_remote}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {staffRecord.notes && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Notes</h3>
                      <p className="text-sm">{staffRecord.notes}</p>
                    </div>
                  )}

                  <Separator />

                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Record Created</h3>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <p className="text-sm">{new Date(staffRecord.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {staffRecord && (
            <Card>
              <CardHeader>
                <CardTitle>Availability Schedule</CardTitle>
                <CardDescription>Your teaching availability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="py-2 px-3 text-left font-medium">Day</th>
                        <th className="py-2 px-3 text-center font-medium">Available</th>
                        <th className="py-2 px-3 text-left font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr className={staffRecord.availability_monday ? "bg-green-50/50" : ""}>
                        <td className="py-2 px-3">Monday</td>
                        <td className="py-2 px-3 text-center">
                          {staffRecord.availability_monday ? 
                            <Badge variant="outline" className="bg-green-100 text-green-800">Yes</Badge> : 
                            <Badge variant="outline" className="bg-gray-100 text-gray-800">No</Badge>}
                        </td>
                        <td className="py-2 px-3">{staffRecord.availability_monday ? "4:00pm - 7:30pm" : "-"}</td>
                      </tr>
                      <tr className={staffRecord.availability_tuesday ? "bg-green-50/50" : ""}>
                        <td className="py-2 px-3">Tuesday</td>
                        <td className="py-2 px-3 text-center">
                          {staffRecord.availability_tuesday ? 
                            <Badge variant="outline" className="bg-green-100 text-green-800">Yes</Badge> : 
                            <Badge variant="outline" className="bg-gray-100 text-gray-800">No</Badge>}
                        </td>
                        <td className="py-2 px-3">{staffRecord.availability_tuesday ? "4:00pm - 7:30pm" : "-"}</td>
                      </tr>
                      <tr className={staffRecord.availability_wednesday ? "bg-green-50/50" : ""}>
                        <td className="py-2 px-3">Wednesday</td>
                        <td className="py-2 px-3 text-center">
                          {staffRecord.availability_wednesday ? 
                            <Badge variant="outline" className="bg-green-100 text-green-800">Yes</Badge> : 
                            <Badge variant="outline" className="bg-gray-100 text-gray-800">No</Badge>}
                        </td>
                        <td className="py-2 px-3">{staffRecord.availability_wednesday ? "4:00pm - 7:30pm" : "-"}</td>
                      </tr>
                      <tr className={staffRecord.availability_thursday ? "bg-green-50/50" : ""}>
                        <td className="py-2 px-3">Thursday</td>
                        <td className="py-2 px-3 text-center">
                          {staffRecord.availability_thursday ? 
                            <Badge variant="outline" className="bg-green-100 text-green-800">Yes</Badge> : 
                            <Badge variant="outline" className="bg-gray-100 text-gray-800">No</Badge>}
                        </td>
                        <td className="py-2 px-3">{staffRecord.availability_thursday ? "4:00pm - 7:30pm" : "-"}</td>
                      </tr>
                      <tr className={staffRecord.availability_friday ? "bg-green-50/50" : ""}>
                        <td className="py-2 px-3">Friday</td>
                        <td className="py-2 px-3 text-center">
                          {staffRecord.availability_friday ? 
                            <Badge variant="outline" className="bg-green-100 text-green-800">Yes</Badge> : 
                            <Badge variant="outline" className="bg-gray-100 text-gray-800">No</Badge>}
                        </td>
                        <td className="py-2 px-3">{staffRecord.availability_friday ? "4:00pm - 7:30pm" : "-"}</td>
                      </tr>
                      <tr className={staffRecord.availability_saturday_am ? "bg-green-50/50" : ""}>
                        <td className="py-2 px-3">Saturday AM</td>
                        <td className="py-2 px-3 text-center">
                          {staffRecord.availability_saturday_am ? 
                            <Badge variant="outline" className="bg-green-100 text-green-800">Yes</Badge> : 
                            <Badge variant="outline" className="bg-gray-100 text-gray-800">No</Badge>}
                        </td>
                        <td className="py-2 px-3">{staffRecord.availability_saturday_am ? "9:00am - 12:30pm" : "-"}</td>
                      </tr>
                      <tr className={staffRecord.availability_saturday_pm ? "bg-green-50/50" : ""}>
                        <td className="py-2 px-3">Saturday PM</td>
                        <td className="py-2 px-3 text-center">
                          {staffRecord.availability_saturday_pm ? 
                            <Badge variant="outline" className="bg-green-100 text-green-800">Yes</Badge> : 
                            <Badge variant="outline" className="bg-gray-100 text-gray-800">No</Badge>}
                        </td>
                        <td className="py-2 px-3">{staffRecord.availability_saturday_pm ? "1:00pm - 4:30pm" : "-"}</td>
                      </tr>
                      <tr className={staffRecord.availability_sunday_am ? "bg-green-50/50" : ""}>
                        <td className="py-2 px-3">Sunday AM</td>
                        <td className="py-2 px-3 text-center">
                          {staffRecord.availability_sunday_am ? 
                            <Badge variant="outline" className="bg-green-100 text-green-800">Yes</Badge> : 
                            <Badge variant="outline" className="bg-gray-100 text-gray-800">No</Badge>}
                        </td>
                        <td className="py-2 px-3">{staffRecord.availability_sunday_am ? "9:00am - 12:30pm" : "-"}</td>
                      </tr>
                      <tr className={staffRecord.availability_sunday_pm ? "bg-green-50/50" : ""}>
                        <td className="py-2 px-3">Sunday PM</td>
                        <td className="py-2 px-3 text-center">
                          {staffRecord.availability_sunday_pm ? 
                            <Badge variant="outline" className="bg-green-100 text-green-800">Yes</Badge> : 
                            <Badge variant="outline" className="bg-gray-100 text-gray-800">No</Badge>}
                        </td>
                        <td className="py-2 px-3">{staffRecord.availability_sunday_pm ? "1:00pm - 4:30pm" : "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
} 