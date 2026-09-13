import { DealPassport } from "@/components/DealPassport";

export default function PassportPage({ params }: { params: { id: string } }) {
  return <DealPassport dealId={BigInt(params.id)} />;
}
