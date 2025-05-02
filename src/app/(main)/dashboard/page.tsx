'use client';

import { Button } from '@/components/ui/button';
import { Database, Newspaper, GraduationCap, Beaker, Users, CalendarDays, ChevronRight } from 'lucide-react';
import { DbStatusPanel } from '@/components/dashboard/DbStatusPanel';
import { StudentDataTest } from '@/components/dashboard/StudentDataTest';
import { DbTester } from '@/components/dashboard/DbTester';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Refresh Data
          </Button>
          <Button size="sm">
            Add New
          </Button>
        </div>
      </div>
      
      {/* Quick Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-muted-foreground">Total Students</p>
                  <p className="text-3xl font-bold">0</p>
                </div>
                <GraduationCap className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-muted-foreground">Active Classes</p>
                  <p className="text-3xl font-bold">0</p>
                </div>
                <CalendarDays className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-muted-foreground">Staff Members</p>
                  <p className="text-3xl font-bold">0</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Database Status */}
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Database Status</CardTitle>
              <CardDescription>Local database health information</CardDescription>
            </div>
            <Database className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <DbStatusPanel />
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest system activity</CardDescription>
            </div>
            <Newspaper className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="text-center py-6">
                <p className="text-muted-foreground">No recent activity</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student Quick View */}
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Student Management</CardTitle>
              <CardDescription>Student quick view</CardDescription>
            </div>
            <GraduationCap className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <StudentDataTest />
          </CardContent>
        </Card>
      </div>
      
      {/* Additional Widgets */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Database Tester */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Database Tester</CardTitle>
              <CardDescription>Test database operations</CardDescription>
            </div>
            <Beaker className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <DbTester />
          </CardContent>
        </Card>
        
        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Frequently used pages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link 
                href="/dashboard/students"
                className="flex items-center justify-between p-3 text-sm rounded-lg border hover:bg-accent/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-4 w-4" />
                  <span>Student Management</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link 
                href="/dashboard/classes"
                className="flex items-center justify-between p-3 text-sm rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4" />
                  <span>Class Schedule</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link 
                href="/dashboard/topics"
                className="flex items-center justify-between p-3 text-sm rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Newspaper className="h-4 w-4" />
                  <span>Topics & Resources</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link 
                href="/dashboard/subjects"
                className="flex items-center justify-between p-3 text-sm rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Beaker className="h-4 w-4" />
                  <span>Subjects</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link 
                href="/dashboard/communications"
                className="flex items-center justify-between p-3 text-sm rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Newspaper className="h-4 w-4" />
                  <span>Communications</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 