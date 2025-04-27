/**
 * API client for interacting with the backend
 */

// Configure the API URL based on environment
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  token?: string;
}

/**
 * Wrapper around fetch to standardize API calls
 */
async function fetchApi(endpoint: string, options: RequestOptions = {}) {
  const { 
    method = 'GET', 
    headers = {}, 
    body, 
    token 
  } = options;

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add authorization token if provided
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    // Handle non-JSON responses
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      return data;
    } else {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      return await response.text();
    }
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

export const api = {
  get: <T>(endpoint: string, token?: string): Promise<T> => 
    fetchApi(endpoint, { method: 'GET', token }),
  
  post: <T>(endpoint: string, data?: unknown, token?: string): Promise<T> => 
    fetchApi(endpoint, { method: 'POST', body: data, token }),
  
  put: <T>(endpoint: string, data?: unknown, token?: string): Promise<T> => 
    fetchApi(endpoint, { method: 'PUT', body: data, token }),
  
  delete: <T>(endpoint: string, token?: string): Promise<T> => 
    fetchApi(endpoint, { method: 'DELETE', token }),
}; 