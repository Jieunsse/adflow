import { redirect } from "next/navigation";

export default function DashboardInstagramRedirect() {
  redirect("/dashboard/business-portfolio?tab=instagram");
}
