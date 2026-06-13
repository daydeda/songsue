import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ShopClient from "./ShopClient";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return <ShopClient />;
}
