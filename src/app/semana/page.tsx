import { redirect } from "next/navigation";

// The weekly planner became a full calendar at /planificacion; keep old links working.
export default function SemanaPage() {
  redirect("/planificacion");
}
