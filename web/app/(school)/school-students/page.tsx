'use client';

import { useState, useEffect } from 'react';
import { useSchool } from '@/lib/auth/school-context';
import { useRouter } from 'next/navigation';

interface Student {
  id: string;
  fullName: string;
  email: string;
  grade: string;
  nisn: string;
  registrationCount: number;
}

export default function SchoolStudents() {
  const { user, loading } = useSchool();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'school_admin';
  const isTeacher = user?.role === 'teacher';

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    // Для учителя - используем /api/teachers/my-students
    // Для админа - используем /api/schools/students
    const endpoint = isTeacher ? '/api/teachers/my-students' : '/api/schools/students?limit=100';
    
    fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('school_token')}` }
    })
      .then(res => {
        if (!res.ok) {
          if (res.status === 403) {
            throw new Error(isTeacher ? 'Access denied. Teacher account required.' : 'Access denied. Admin account required.');
          }
          throw new Error('Failed to fetch students');
        }
        return res.json();
      })
      .then(data => {
        // /api/teachers/my-students возвращает { students: [], stats: {} }
        // /api/schools/students возвращает { students: [], pagination: {} }
        const studentList = data.students || [];
        setStudents(studentList);
        setLoadingData(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoadingData(false);
      });
  }, [user, isTeacher]);

  if (loading || loadingData) {
    return (
      <div style={{ padding: '36px 40px', textAlign: 'center' }}>
        <span className="spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '36px 40px' }}>
        <div className="toast toast-err" style={{ marginBottom: 20 }}>
          ⚠ {error}
        </div>
        <button 
          onClick={() => router.back()} 
          className="btn btn-ghost"
        >
          ← Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '36px 40px', maxWidth: 1060 }}>
      <div className="fu" style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 32, fontWeight: 400 }}>
          {isTeacher ? 'My Students' : 'Student Roster'}
        </h1>
        <p style={{ color: 'var(--text-3)', marginTop: 4 }}>
          {students.length} {students.length === 1 ? 'student' : 'students'} 
          {isTeacher && ' in your classes'}
        </p>
      </div>

      {students.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-3)', marginBottom: 16 }}>
            {isTeacher 
              ? 'No students added to your roster yet.' 
              : 'No students registered at your school yet.'}
          </p>
          {isTeacher && (
            <button className="btn btn-primary" onClick={() => router.push('/school-add-students')}>
              + Add Students
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontWeight: 500, fontSize: 12 }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontWeight: 500, fontSize: 12 }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontWeight: 500, fontSize: 12 }}>Grade</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontWeight: 500, fontSize: 12 }}>NISN</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontWeight: 500, fontSize: 12 }}>Registrations</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{student.fullName}</td>
                    <td style={{ padding: '12px 16px' }}>{student.email}</td>
                    <td style={{ padding: '12px 16px' }}>{student.grade || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{student.nisn || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{student.registrationCount || 0}</td>
                   </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}