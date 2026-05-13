'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSchool } from '@/lib/auth/school-context';

export default function Deadlines() {
  const { user, loading } = useSchool();
  const router = useRouter();
  const [deadlines, setDeadlines] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'teacher') {
      fetch('/api/teachers/upcoming-deadlines', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('school_token')}` }
      })
        .then(res => res.json())
        .then(data => {
          setDeadlines(data);
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
        <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 32, fontWeight: 400 }}>Upcoming Deadlines</h1>
        <p style={{ color: 'var(--text-3)' }}>
          Competitions with registration deadlines in the next 30 days
        </p>
      </div>

      {deadlines.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-3)' }}>No upcoming deadlines.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Competition</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Deadline</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Days Left</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Your Students</th>
                 </tr>
              </thead>
              <tbody>
                {deadlines.map((dl: any) => (
                  <tr key={dl.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{dl.competition}</td>
                    <td style={{ padding: '10px 16px' }}>{dl.deadline}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span className={`badge ${dl.status === 'urgent' ? 'badge-red' : 'badge-yellow'}`}>
                        {dl.daysLeft} days
                      </span>
                     </td>
                    <td style={{ padding: '10px 16px' }}>{dl.registeredCount} registered</td>
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