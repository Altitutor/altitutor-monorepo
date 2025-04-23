import { api } from './client';

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  status: 'CURRENT' | 'INACTIVE' | 'TRIAL' | 'DISCONTINUED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateStudentRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  status?: 'CURRENT' | 'INACTIVE' | 'TRIAL' | 'DISCONTINUED';
  notes?: string;
}

type UpdateStudentRequest = Partial<CreateStudentRequest>;

export const studentsApi = {
  /**
   * Get all students
   */
  getAll: (token: string) => 
    api.get<Student[]>('/students', token),
  
  /**
   * Get a student by ID
   */
  getById: (id: string, token: string) => 
    api.get<Student>(`/students/${id}`, token),
  
  /**
   * Create a new student
   */
  create: (data: CreateStudentRequest, token: string) => 
    api.post<Student>('/students', data, token),
  
  /**
   * Update a student
   */
  update: (id: string, data: UpdateStudentRequest, token: string) => 
    api.put<Student>(`/students/${id}`, data, token),
  
  /**
   * Delete a student
   */
  delete: (id: string, token: string) => 
    api.delete<{ message: string }>(`/students/${id}`, token),
}; 