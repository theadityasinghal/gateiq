import { notFound, redirect } from "next/navigation";
import { requireOnboardedUser } from "@/server/session";
import { loadCasePage } from "@/server/cases/page-data";
import { ROLE_INFO, invitableRoles } from "@/lib/roles";
import { PeopleCard } from "../people-card";

type Props = { params: Promise<{ code: string }> };

/** Who is on the case, and the form to invite someone else. */
export default async function CasePeoplePage({ params }: Props) {
  const { code } = await params;
  const user = await requireOnboardedUser();
  const data = await loadCasePage(code, user.id, user.role);
  if (!data) notFound();
  const { c, members, owner } = data;
  if (c.caseCode !== code) redirect(`/cases/${c.caseCode}/people`);
  return (
    <PeopleCard
      caseCode={c.caseCode}
      viewerId={user.id}
      isOwner={c.access === "owner"}
      owner={owner ?? { name: "Unknown", username: null }}
      members={members}
      canInvite={invitableRoles(user.role).length > 0}
      invitable={invitableRoles(user.role).map((r) => ROLE_INFO[r].label)}
    />
  );
}
