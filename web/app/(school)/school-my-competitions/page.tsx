'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSchool } from '@/lib/auth/school-context';

export default function MyCompetitions() {
  const { user, loading } = useSchool();
  const router = useRouter();
  const [competitions, setCompetitions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'teacher') {
      fetch('/api/teachers/my-competitions', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('school_token')}` }
      })
        .then(res => res.json())
        .then(data => {
          setCompetitions(data.competitions || []);
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
        <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 32, fontWeight: 400 }}>My Competitions</h1>
        <p style={{ color: 'var(--text-3)' }}>
          Competitions your students are registered for
        </p>
      </div>

      {competitions.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-3)' }}>No competitions yet.</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
            Your students haven't registered for any competitions yet.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {competitions.map((comp: any) => (
            <div key={comp.id} className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 18, marginBottom: 12 }}>{comp.name}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
                {comp.category} {comp.fee > 0 ? `• Rp ${comp.fee.toLocaleString()}` : '• Free'}
              </p>
              <div>
                <p className="label" style={{ marginBottom: 8 }}>Registered Students ({comp.students?.length || 0})</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {comp.students?.map((student: any) => (
                    <span key={student.id} className="badge badge-indigo">
                      {student.fullName} {student.grade && `(${student.grade})`}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}