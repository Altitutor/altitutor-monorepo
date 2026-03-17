import { useQuery } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatStudentsApi } from '@/features/ucat/students/api/students'

export function useUcatStudentProgress() {
  return useQuery({ queryKey: ucatKeys.students(), queryFn: ucatStudentsApi.listProgress })
}

export function useUcatStudentSummary(studentId: string | null) {
  return useQuery({
    queryKey: studentId ? ucatKeys.student(studentId) : [...ucatKeys.students(), 'empty'],
    queryFn: () => ucatStudentsApi.studentSummary(studentId as string),
    enabled: !!studentId,
  })
}

export function useUcatClasses() {
  return useQuery({ queryKey: [...ucatKeys.students(), 'classes'], queryFn: ucatStudentsApi.ucatClasses })
}

export function useUcatClassStudentIds(classId: string | null) {
  return useQuery({
    queryKey: classId ? [...ucatKeys.students(), 'classStudents', classId] : [...ucatKeys.students(), 'classStudents', 'empty'],
    queryFn: () => ucatStudentsApi.classStudentIds(classId as string),
    enabled: !!classId,
  })
}

export function useUcatClassesWithDetails() {
  return useQuery({
    queryKey: [...ucatKeys.students(), 'classesWithDetails'],
    queryFn: ucatStudentsApi.listUcatClassesWithDetails,
  })
}

