import { CarIcon, DatabaseIcon, FlagIcon, HomeIcon, LockIcon, PlaneIcon, ShieldAlertIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AskAssistantButton } from "@/app/_components/ask-assistant-button";
import { findUser, SESSION_COOKIE, verifySession } from "@lib/identity";
import { policiesFor, type FlagSummary, type PolicyList } from "@/lib/policies";

export const metadata: Metadata = { title: "Data · GoodEnough Insurance" };

const PRODUCTS: Readonly<Record<string, { label: string; icon: LucideIcon }>> = {
  home: { label: "Home", icon: HomeIcon },
  motor: { label: "Motor", icon: CarIcon },
  travel: { label: "Travel", icon: PlaneIcon },
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// The heading and explainer prerender. The table is read with a short-lived database user and kept
// in this browser's memory only (see myPolicies), so the nav link's prefetch brings it along and
// opening Data shows it at once; a direct visit streams it in behind a skeleton of the same shape.
export default function DataPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 md:py-16">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="font-display text-3xl md:text-[40px] md:leading-tight">Policies</h1>
        <p className="max-w-2xl text-muted-foreground">
          The policies assigned to you
          <Suspense fallback=".">
            <ViewerName />
          </Suspense>{" "}
          Claim details aren&apos;t shown here: ask the Claims Assistant, which reads them with the same access rules.
        </p>
      </div>
      <Suspense fallback={<PolicyTableSkeleton />}>
        <PolicyTable />
      </Suspense>
    </main>
  );
}

async function ViewerName() {
  const name = await myName();
  return <>{name ? `, ${name}.` : "."}</>;
}

/** The signed-in user's name, cached privately like the table so the heading is ready with it. */
async function myName(): Promise<string | undefined> {
  "use cache: private";
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value)?.displayName;
}

/** Who a flag names: a person from the directory, or whatever else wrote the row. */
function Person({ id }: { readonly id: string }) {
  const user = findUser(id);
  if (user) return <>{user.displayName}</>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <code>{id}</code>
      <span className="rounded-full bg-amber-100 px-1.5 py-px font-bold text-[10px] text-amber-900 uppercase tracking-wide">Not a person</span>
    </span>
  );
}

/**
 * The flags written on the viewer's policies: where an approved write can be seen to have landed.
 * A flag is a row in claim_flags and does not change the claim's status, so without this list
 * the only evidence is the tool result in the chat.
 */
function Flags({ flags }: { readonly flags: readonly FlagSummary[] | undefined }) {
  return (
    <section aria-labelledby="flags-heading" className="mt-14">
      <h2 className="flex items-center gap-2 font-display text-2xl" id="flags-heading">
        <FlagIcon className="size-5 text-brand" /> Flags for review
      </h2>
      <p className="mt-2 mb-6 max-w-2xl text-muted-foreground">
        Each row is a flag that was written to a claim on one of your policies, with who asked for it and who approved
        it. Reload the page after an approval to see it here.
      </p>
      {flags === undefined ? (
        <div className="card-float px-6 py-8 text-center text-muted-foreground text-sm" role="status">
          Flags can&apos;t be listed on this deployment yet: its read access doesn&apos;t include them.
        </div>
      ) : flags.length === 0 ? (
        <div className="card-float px-6 py-8 text-center text-muted-foreground text-sm">
          No claim on your policies has been flagged yet. Ask the assistant to flag one, and have a supervisor approve it.
        </div>
      ) : (
        <div className="card-float overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted text-left text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                {["Claim", "Policy", "Reason", "Requested by", "Approved by", "Written"].map((heading) => (
                  <th className="whitespace-nowrap px-4 py-3 font-medium" key={heading} scope="col">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {flags.map((flag) => (
                <tr className="align-top transition-colors hover:bg-brand-soft/40" key={`${flag.claimId}:${flag.at}:${flag.requestedBy}:${flag.approvedBy}`}>
                  <td className="px-4 py-3 font-medium font-mono">{flag.claimId}</td>
                  <td className="px-4 py-3 font-mono">#{flag.policyId}</td>
                  <td className="min-w-48 px-4 py-3">{flag.reason}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Person id={flag.requestedBy} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Person id={flag.approvedBy} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{flag.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PolicyTableSkeleton() {
  return (
    <div aria-hidden="true" className="card-float overflow-hidden">
      <div className="h-11 border-b bg-muted" />
      {[0, 1, 2, 3].map((row) => (
        <div className="flex items-center gap-6 border-b px-4 py-3.5 last:border-b-0" key={row}>
          <span className="h-4 w-14 animate-pulse rounded bg-muted" />
          <span className="h-4 w-20 animate-pulse rounded bg-muted" />
          <span className="ml-auto h-8 w-32 animate-pulse rounded-[5px] bg-muted" />
        </div>
      ))}
    </div>
  );
}

/**
 * The signed-in user's policies and flags, cached privately: in the browser's memory for this
 * session only, never in a server cache, so the data still lives only in the customer's database
 * between visits. Because it reads the session cookie through a private cache, the route's App
 * Shell includes it, and the ordinary prefetch of the nav link loads it before the click.
 * Kept 30 seconds (the shortest a prefetch allows); the chat refreshes it as soon as it sees a
 * flag written, and signing in or out clears it. An unavailable read isn't kept at all.
 */
async function myPolicies(): Promise<PolicyList | undefined> {
  "use cache: private";
  const user = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) {
    cacheLife("seconds");
    return undefined;
  }
  const list = await policiesFor(user.id, { withFlags: true });
  if (list.ok) cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  else cacheLife("seconds");
  return list;
}

async function PolicyTable() {
  const list = await myPolicies();
  if (!list) redirect("/login");

  return (
    <>
      {list.ok ? (
        <>
          <div className="card-float overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted text-left text-muted-foreground text-xs uppercase tracking-wide">
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
                    <tr className="transition-colors hover:bg-brand-soft/40" key={policy.policyId}>
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
              <code>{list.database}</code>, read with a database user Vault issued for this read and revoked as
              soon as the page was sent. Which policies you see comes from <code>policy_access</code> on the server. Policies
              outside your scope aren&apos;t listed or counted.
            </span>
          </p>
          <Flags flags={list.flags} />
        </>
      ) : (
        <div className="card-float px-6 py-10 text-center" role="status">
          <p className="font-medium">Policy records can&apos;t be reached right now.</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Nothing is shown rather than anything stale. The database may be waking up: try again in a few seconds.
          </p>
        </div>
      )}
    </>
  );
}
