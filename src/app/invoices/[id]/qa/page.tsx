import { redirect } from "next/navigation";

type Params = Promise<{ id: string }>;

export default async function QaRedirectPage({ params }: { params: Params }) {
  const { id } = await params;
  redirect(`/invoices/${id}`);
}
