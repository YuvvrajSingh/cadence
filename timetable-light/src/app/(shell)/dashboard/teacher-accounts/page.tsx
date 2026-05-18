"use client";

import { useEffect, useState } from "react";
import { userApi, teacherApi, type UserAccount } from "@/lib/api";
import type { Teacher } from "@/lib/types";

type FormState = {
  teacherId: string;
  email: string;
  password: string;
  role: "TEACHER" | "ADMIN";
  isTimetableIncharge: boolean;
};

export default function TeacherAccountsPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState<FormState>({ 
    teacherId: "", 
    email: "", 
    password: "", 
    role: "TEACHER",
    isTimetableIncharge: false 
  });

  async function loadData() {
    setLoading(true);
    try {
      const [u, t] = await Promise.all([userApi.list(), teacherApi.list()]);
      setUsers(u);
      setTeachers(t);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // Teachers that already have a login account (active or not)
  const linkedTeacherIds = new Set(
    users.filter((u) => u.role === "TEACHER" && u.teacherId != null).map((u) => u.teacherId!),
  );
  // Only show teachers who don't have an account yet
  const displayedTeachers = teachers.filter((t) => !linkedTeacherIds.has(t.id));

  // Pre-fill email from selected teacher
  function handleTeacherChange(teacherId: string) {
    const teacher = teachers.find((t) => t.id === teacherId);
    setForm((f) => ({
      ...f,
      teacherId,
      email: teacher?.email ?? f.email,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (form.role === "TEACHER" && !form.teacherId) { setError("Select a teacher."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSubmitting(true);
    try {
      await userApi.create({
        email: form.email,
        password: form.password,
        role: form.role,
        isTimetableIncharge: form.isTimetableIncharge,
        teacherId: form.teacherId || undefined,
      });
      setSuccess("Account created successfully.");
      setForm({ teacherId: "", email: "", password: "", role: "TEACHER", isTimetableIncharge: false });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Permanently remove this account? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await userApi.delete(id);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove account.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleIncharge(user: UserAccount) {
    const newVal = !user.isTimetableIncharge;
    if (!confirm(`${newVal ? "Grant" : "Revoke"} Timetable Incharge permissions for ${user.email}?`))
      return;

    try {
      setLoading(true);
      await userApi.update(user.id, { isTimetableIncharge: newVal });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to update permissions");
    } finally {
      setLoading(false);
    }
  }

  const managedUsers = users.filter((u) => u.role === "TEACHER" || u.isTimetableIncharge);

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-3xl font-black tracking-tighter text-on-surface italic">
          Teacher Accounts
        </h2>
        <p className="text-on-surface-variant text-sm font-medium">
          Create and manage login credentials for teaching and departmental staff.
        </p>
      </div>

      {/* Create Account Form */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm">
        <div className="px-8 py-6 border-b border-outline-variant/10">
          <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">
            Create New Account
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="px-4 py-3 rounded-lg bg-secondary/10 border border-secondary/20 text-secondary text-sm font-medium">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Role selector */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Account Role
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as any, teacherId: e.target.value === "ADMIN" ? "" : f.teacherId }))}
                className="w-full appearance-none bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-bold text-on-surface outline-none focus:border-secondary transition-colors"
                required
                disabled={submitting}
              >
                <option value="TEACHER">Teacher</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>

            {/* Incharge Checkbox */}
            <div className="space-y-2 flex flex-col justify-center">
              <label className="flex items-center gap-3 cursor-pointer group mt-4">
                <input
                  type="checkbox"
                  checked={form.isTimetableIncharge}
                  onChange={(e) => setForm((f) => ({ ...f, isTimetableIncharge: e.target.checked }))}
                  className="w-5 h-5 rounded border-outline-variant/20 bg-surface-container-low text-secondary focus:ring-secondary transition-all"
                />
                <span className="text-sm font-bold text-on-surface group-hover:text-secondary transition-colors">
                  Grant Timetable Incharge Role
                </span>
              </label>
              <p className="text-[10px] text-on-surface-variant italic ml-8">
                Allows this user to access scheduling and assignments.
              </p>
            </div>

            {/* Teacher selector (only if TEACHER or TI role) */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Linked Teacher {form.role === "ADMIN" ? "(Optional)" : ""}
              </label>
              <select
                value={form.teacherId}
                onChange={(e) => handleTeacherChange(e.target.value)}
                className="w-full appearance-none bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-bold text-on-surface outline-none focus:border-secondary transition-colors"
                required={form.role === "TEACHER"}
                disabled={submitting}
              >
                <option value="">Select teacher...</option>
                {displayedTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.abbreviation} — {t.name}
                  </option>
                ))}
              </select>
              {displayedTeachers.length === 0 && !loading && (
                <p className="text-[10px] text-outline italic">All teachers already have accounts.</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="teacher@university.edu"
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm text-on-surface outline-none focus:border-secondary transition-colors"
                required
                disabled={submitting}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Password
              </label>
              <div className="relative group/pass">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 pr-12 text-sm text-on-surface outline-none focus:border-secondary transition-colors"
                  required
                  minLength={8}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-on-surface-variant hover:text-secondary transition-colors rounded-full hover:bg-surface-variant/30"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || displayedTeachers.length === 0}
              className="px-8 py-3 bg-primary-container text-white font-bold text-sm rounded-lg hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              {submitting ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>

      {/* Existing Teacher Accounts */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm">
        <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">
            Existing Accounts
          </h3>
          <span className="text-xs font-bold text-outline bg-surface-container px-3 py-1 rounded-full">
            {managedUsers.length} account{managedUsers.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="px-8 py-12 text-center text-sm text-on-surface-variant">Loading...</div>
        ) : managedUsers.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-outline-variant/30 mb-3 block">manage_accounts</span>
            <p className="text-sm font-bold text-on-surface-variant">No teacher accounts yet</p>
            <p className="text-xs text-on-surface-variant/60 mt-1">Create the first one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/5">
            {managedUsers.map((u) => (
              <div key={u.id} className="px-8 py-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-xl text-on-surface-variant">
                      {u.isTimetableIncharge ? "calendar_today" : "person"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-on-surface truncate">
                        {u.teacher?.name ?? (u.role === "ADMIN" ? "Administrator" : "Unknown User")}
                      </p>
                      <span className="text-[10px] font-bold text-outline bg-surface-container px-2 py-0.5 rounded uppercase tracking-wider">
                        {u.isTimetableIncharge ? "Staff" : u.teacher?.abbreviation}
                      </span>
                      {u.isTimetableIncharge && (
                        <span className="text-[9px] font-black text-secondary bg-secondary/10 px-2 py-0.5 rounded uppercase tracking-tighter">
                          Timetable Incharge
                        </span>
                      )}
                      {!u.isActive && (
                        <span className="text-[10px] font-bold text-error bg-error/10 px-2 py-0.5 rounded uppercase tracking-wider">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">{u.email}</p>
                  </div>
                </div>
                {u.isActive && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleIncharge(u)}
                      className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold ${u.isTimetableIncharge ? 'text-secondary bg-secondary/5' : 'text-primary hover:bg-primary/10'}`}
                      title={u.isTimetableIncharge ? "Revoke TI Permission" : "Grant TI Permission"}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {u.isTimetableIncharge ? "verified_user" : "manage_accounts"}
                      </span>
                      {u.isTimetableIncharge ? "Is TI" : "Make TI"}
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      disabled={deletingId === u.id}
                      className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      {deletingId === u.id ? "..." : "Remove"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
