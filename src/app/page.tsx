import { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Altitutor Admin Dashboard',
  description: 'Administrative dashboard for managing Altitutor\'s operations',
}

export default async function HomePage() {
  // Check authentication status
  const isAuthenticated = false // Replace with actual auth check
  
  if (!isAuthenticated) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold">Welcome to Altitutor Admin</h1>
        <p className="text-muted-foreground">
          Manage your tutoring operations efficiently
        </p>
      </div>
    </main>
  )
} 