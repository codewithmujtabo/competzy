'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSchool } from '@/lib/auth/school-context';

interface Student {
  id: string;
  fullName: string;
  email: string;
  grade: string;
  nisn: string;
  registrationCount: number;
}

export default function MyStudents() {
  const { user, loading } = useSchool();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState({ totalStudents: 0, totalRegistrations: 0 });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'teacher') {
      fetch('/api/teachers/my-students', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('school_token')}` }
      })
        .then(res => res.json())
        .then(data => {
          setStudents(data.students || []);
          setStats(data.stats || { totalStudents: 0, totalRegistrations: 0 });
          setLoadingData(false);
        })
        .catch(err => {
          console.error(err);
          setLoadingData(false);
        });
    }
  }, [user]);

  if (loading || loadingData) {
    return (
      <div style={{ padding: '36px 40px', textAlign: 'center' }}>
        <span className="spin" />
      </div>
    );
  }

  return (
    <div style={{ padding: '36px 40px', maxWidth: 1060 }}>
      <div className="fu" style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 32, fontWeight: 400 }}>My Students</h1>
        <p style={{ color: 'var(--text-3)' }}>
          {stats.totalStudents} students • {stats.totalRegistrations} total registrations
        </p>
      </div>

      {students.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-3)' }}>No students added to your roster yet.</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
            Ask your school administrator to add students to your classes.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Grade</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>NISN</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Registrations</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{student.fullName}</td>
                    <td style={{ padding: '10px 16px' }}>{student.email}</td>
                    <td style={{ padding: '10px 16px' }}>{student.grade || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{student.nisn || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{student.registrationCount}</td>
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