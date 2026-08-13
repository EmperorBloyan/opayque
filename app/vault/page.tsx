import { redirect } from "next/navigation";

export default function VaultRootPage() {
  redirect("/vault/dashboard");
}
