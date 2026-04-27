import { redirect } from "next/navigation";

// Root page — redirect tới /library (auth guard ở library page)
export default function RootPage() {
  redirect("/library");
}
