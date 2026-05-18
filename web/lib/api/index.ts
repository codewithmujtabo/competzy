import { adminHttp, organizerHttp } from './client';
import type { AuthUser, Competition, Pagination, PendingRegistration, School, User } from '@/types';

// ============= ADMIN APIS (используют adminHttp) =============

export const authApi = {
  login: (email: string, password: string) =>
    adminHttp.post<{ token: string; user: AuthUser }>('/auth/login', { email, password }),
};

export const schoolsApi = {
  list: (p: { page?: number; limit?: number; search?: string; province?: string } = {}) => {
    const q = new URLSearchParams();
    if (p.page)     q.set('page',     String(p.page));
    if (p.limit)    q.set('limit',    String(p.limit));
    if (p.search)   q.set('search',   p.search);
    if (p.province) q.set('province', p.province);
    return adminHttp.get<{ schools: School[]; pagination: Pagination }>(`/admin/schools?${q}`);
  },
  provinces: () => adminHttp.get<string[]>('/admin/schools/provinces'),
  create: (data: Partial<School>) => adminHttp.post<School>('/admin/schools', data),
};

export const competitionsApi = {
  list: (p: { page?: number; limit?: number; category?: string; search?: string } = {}) => {
    const q = new URLSearchParams();
    if (p.page)     q.set('page',     String(p.page));
    if (p.limit)    q.set('limit',    String(p.limit));
    if (p.category) q.set('category', p.category);
    if (p.search)   q.set('search',   p.search);
    return adminHttp.get<Competition[]>(`/admin/competitions?${q}`).then(data => ({
      competitions: data,
      pagination: {
        total: data.length,
        page: p.page || 1,
        limit: p.limit || 15,
        totalPages: Math.ceil(data.length / (p.limit || 15)),
      },
    }));
  },
  get: (id: string) => adminHttp.get<any>(`/competitions/${id}`),
  create: (data: Partial<Competition>) =>
    adminHttp.post<Competition>('/admin/competitions', data),
  update: (id: string, data: Partial<Competition>) =>
    adminHttp.put<Competition>(`/admin/competitions/${id}`, data),
  delete: (id: string) =>
    adminHttp.delete<{ message: string }>(`/admin/competitions/${id}`),
};

export const usersApi = {
  list: (p: { page?: number; limit?: number; role?: string; search?: string } = {}) => {
    const q = new URLSearchParams();
    if (p.page)   q.set('page',   String(p.page));
    if (p.limit)  q.set('limit',  String(p.limit));
    if (p.role)   q.set('role',   p.role);
    if (p.search) q.set('search', p.search);
    return adminHttp.get<{ users: User[]; pagination: Pagination }>(`/admin/users?${q}`);
  },
};

export const registrationsApi = {
  listPending: (status = 'pending_approval') =>
    adminHttp.get<{ pendingRegistrations: PendingRegistration[] }>(`/admin/registrations/pending?status=${status}`),
  approve: (id: string) =>
    adminHttp.post<{ message: string; status: string }>(`/admin/registrations/${id}/approve`, {}),
  reject: (id: string, reason: string) =>
    adminHttp.post<{ message: string; status: string }>(`/admin/registrations/${id}/reject`, { reason }),
};

export const notificationsApi = {
  broadcast: (data: {
    title: string;
    body: string;
    type: string;
    school_ids: string[];
    competition_id?: string;
    scheduled_for?: string;
  }) => adminHttp.post<{ sent: number; schools: number; message: string }>('/admin/notifications/broadcast', data),
};

// ============= ORGANIZER APIS (используют organizerHttp) =============

export const organizerAuthApi = {
  login: (email: string, password: string) =>
    organizerHttp.post<{ token: string; user: AuthUser }>('/auth/login', { email, password }),
};

export const organizerProfileApi = {
  getMe: () => organizerHttp.get<any>('/organizers/me'),
  updateMe: (data: { orgName?: string; bio?: string; website?: string; logoUrl?: string }) =>
    organizerHttp.put<any>('/organizers/me', data),
};

export const organizerCompetitionsApi = {
  list: (p: { page?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (p.page) q.set('page', String(p.page));
    if (p.limit) q.set('limit', String(p.limit));
    return organizerHttp.get<any[]>(`/organizers/competitions?${q}`).then(data => ({
      competitions: data,
      pagination: {
        total: data.length,
        page: p.page || 1,
        limit: p.limit || 10,
        totalPages: Math.ceil(data.length / (p.limit || 10)),
      },
    }));
  },
  getOne: (id: string) => organizerHttp.get<any>(`/organizers/competitions/${id}`),
  create: (data: any) => organizerHttp.post<any>('/organizers/competitions', data),
  update: (id: string, data: any) => organizerHttp.put<any>(`/organizers/competitions/${id}`, data),
  publish: (id: string) => organizerHttp.post<{ message: string }>(`/organizers/competitions/${id}/publish`, {}),
  close: (id: string) => organizerHttp.post<{ message: string }>(`/organizers/competitions/${id}/close`, {}),
  delete: (id: string) => organizerHttp.delete<{ message: string }>(`/organizers/competitions/${id}`),
};

export const organizerRegistrationsApi = {
  list: (competitionId: string) =>
    organizerHttp.get<any[]>(`/organizers/competitions/${competitionId}/registrations`),
  approve: (registrationId: string) =>
    organizerHttp.post<{ message: string; status: string }>(`/organizers/registrations/${registrationId}/approve`, {}),
  reject: (registrationId: string, reason: string) =>
    organizerHttp.post<{ message: string; status: string }>(`/organizers/registrations/${registrationId}/reject`, { reason }),
  export: (competitionId: string) =>
    organizerHttp.get<string>(`/organizers/competitions/${competitionId}/export`),
  
};

export const organizerRevenueApi = {
  getStats: () => organizerHttp.get<any>('/organizers/revenue'),
};