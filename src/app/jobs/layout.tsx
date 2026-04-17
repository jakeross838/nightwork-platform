import NavBar from "@/components/nav-bar";
import JobSidebar from "@/components/job-sidebar";

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <div className="flex flex-1">
        <JobSidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
