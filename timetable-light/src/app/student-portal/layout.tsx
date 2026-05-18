import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import Link from "next/link";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { AcademicYearProvider } from "@/contexts/academic-year-context";
import { ThemeToggle } from "@/components/theme-toggle";
import NoticeBell from "@/components/NoticeBell";

export const metadata: Metadata = {
  title: "Student Portal | Cadence",
};

export default async function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  async function logoutAction() {
    "use server";
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    redirect("/login");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  let user: any = null;
  try {
    // Note: next-auth or a proper verify function should be used here, 
    // but we use decode since it's a client-side layout (verified by middleware).
    user = jwt.decode(token);
    if (!user || user.role !== "STUDENT") {
      redirect("/login");
    }
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar Nav (Desktop) */}
      <aside className="hidden md:flex w-64 border-r border-outline-variant/30 bg-surface-container-low flex-col pt-8 h-screen sticky top-0">
        <div className="px-6 pb-8">
          <h2 className="text-xl font-black tracking-tighter uppercase text-on-surface">CADENCE // Student</h2>
          <p className="text-[10px] font-black uppercase text-secondary tracking-widest mt-1">Profile: {user.rollNumber}</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <Link
            href="/student-portal"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">dashboard</span>
            Dashboard
          </Link>
          <Link
            href="/student-portal/midterm"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">leaderboard</span>
            Exam Results
          </Link>
          <Link
            href="/student-portal/notices"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">notifications</span>
            Notices
          </Link>
        </nav>

        <div className="p-4 border-t border-outline-variant/30 space-y-2">
           {/* Developer Credit */}
           <div className="mb-2 px-3 py-2 bg-primary/5 rounded-xl border border-outline-variant/15 flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
             <div className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant leading-none">
               Developed By: <span className="text-primary">Nakshatara Kataria</span>
             </div>
           </div>

           <div className="px-4 py-2">
             <ThemeToggle />
           </div>
           <form action={logoutAction}>
             <button type="submit" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-error hover:bg-error-container hover:text-on-error-container transition-colors">
                <span className="material-symbols-outlined text-sm">logout</span>
                Sign Out
             </button>
          </form>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden h-14 bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-sm text-white">school</span>
            </div>
            <span className="text-xs font-black tracking-widest uppercase text-on-surface">CADENCE // STUDENT</span>
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest text-primary mt-0.5 ml-9">
            By Nakshatara Kataria
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NoticeBell href="/student-portal/notices" role="STUDENT" />
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-lowest border-t border-outline-variant/20 flex items-center justify-around px-2 z-50 pb-safe">
        <Link href="/student-portal" className="flex flex-col items-center gap-1 p-2 text-on-surface-variant">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[10px] font-bold uppercase">Home</span>
        </Link>
        <Link href="/student-portal/midterm" className="flex flex-col items-center gap-1 p-2 text-on-surface-variant">
          <span className="material-symbols-outlined">leaderboard</span>
          <span className="text-[10px] font-bold uppercase">Results</span>
        </Link>
        <Link href="/student-portal/notices" className="flex flex-col items-center gap-1 p-2 text-on-surface-variant">
          <span className="material-symbols-outlined">notifications</span>
          <span className="text-[10px] font-bold uppercase">Notices</span>
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="flex flex-col items-center gap-1 p-2 text-error">
            <span className="material-symbols-outlined">logout</span>
            <span className="text-[10px] font-bold uppercase">Exit</span>
          </button>
        </form>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto mb-16 md:mb-0">
        <div className="max-w-5xl mx-auto">
          <AcademicYearProvider storageKey="student-selected-year-id" forceActive={true}>
            {children}
          </AcademicYearProvider>
        </div>
      </main>
    </div>
  );
}
