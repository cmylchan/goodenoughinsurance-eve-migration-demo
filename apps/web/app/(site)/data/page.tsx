import { CarIcon, DatabaseIcon, HomeIcon, LockIcon, PlaneIcon, ShieldAlertIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { AskAssistantButton } from "@/app/_components/ask-assistant-button";
import { policiesFor } from "@/lib/policies";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Data · GoodEnough Insurance" };

const PRODUCTS: Readonly<Record<string, { label: string; icon: LucideIcon }>> = {
  home: { label: "Home", icon: HomeIcon },
  motor: { label: "Motor", icon: CarIcon },
  travel: { label: "Travel", icon: PlaneIcon },
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default async function DataPage() {
  const viewer = await requireViewer();
  const list = await policiesFor(viewer.id);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">Policies</h1>
        <p className="max-w-2xl text-muted-foreground text-sm">
          The policies assigned to you, {viewer.displayName}. Claim details aren&apos;t shown here: ask the Claims
          Assistant, which reads them with the same access rules.
        </p>
      </div>

      {list.ok ? (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 font-medium" scope="col">
                    Policy
                  </th>
                  <th className="px-4 py-3 font-medium" scope="col">
                    Product
                  </th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell" scope="col">
                    Region
                  </th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell" scope="col">
                    Holder
                  </th>
                  <th className="px-4 py-3" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.policies.map((policy) => {
                  const product = PRODUCTS[policy.product] ?? { label: titleCase(policy.product), icon: ShieldAlertIcon };
                  return (
                    <tr key={policy.policyId}>
                      <td className="px-4 py-3 font-medium font-mono">#{policy.policyId}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <product.icon className="size-4 text-brand" />
                          {product.label}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">{titleCase(policy.region)}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        <span className="inline-flex items-center gap-1.5">
                          <LockIcon className="size-3.5" /> Withheld
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AskAssistantButton prompt={`Summarize open claims for policy #${policy.policyId}.`} />
                      </td>
                    </tr>
                  );
                })}
                {list.policies.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                      No policies are assigned to you.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-4 flex items-start gap-2 text-muted-foreground text-xs">
            <DatabaseIcon className="mt-px size-3.5 shrink-0" />
            <span>
              {list.policies.length} {list.policies.length === 1 ? "policy" : "policies"} from{" "}
              <code>{list.database}</code>, read with a database user Vault issued for this page load and revoked
              before it rendered. Which policies you see comes from <code>policy_access</code> on the server. Policies
              outside your scope aren&apos;t listed or counted.
            </span>
          </p>
        </>
      ) : (
        <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center" role="status">
          <p className="font-medium">Policy records can&apos;t be reached right now.</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Nothing is shown rather than anything stale. The database may be waking up: try again in a few seconds.
          </p>
        </div>
      )}
    </main>
  );
}
