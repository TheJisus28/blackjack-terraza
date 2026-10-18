import { TableView } from "@/components/table/TableView";

export default async function TablePage({ params }: PageProps<"/mesa/[id]">) {
  const { id } = await params;
  return <TableView tableId={id} />;
}
