import { HeaderActions } from "@/components/header-actions";
import { useQuery } from "@tanstack/react-query";
import { Copy, Failure, Group, Loading, Screen } from "@/components/ui";
import { dataApi } from "@/features/dashboard/api";
export default function Plan() {
  const q = useQuery({ queryKey: ["quota"], queryFn: dataApi.quota });
  return (
    <Screen>
      <HeaderActions />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <Group title="Your plan">
            <Copy large>UCAT {q.data.onlineTier}</Copy>
          </Group>
          <Group title="Your allowance">
            {q.data.areas.map((area) => (
              <Copy key={area.area}>
                {area.label}:{" "}
                {q.data.isQuotaExempt
                  ? "Unlimited"
                  : `${area.used} / ${area.limit} this ${area.period}`}
              </Copy>
            ))}
          </Group>
        </>
      )}
    </Screen>
  );
}
