import Link from "next/link";
import { TaskStatusBadge } from "@/components/TaskStatusBadge";
import { getIdentitySourceLabel } from "@/lib/arcNative";
import type { EscrowTask } from "@/lib/contracts/microWorkEscrow";
import {
  getEntityTypeLabel,
  getParticipantBadgeClass,
  getUserTypeFromLegacy,
  getUserTypeLabel
} from "@/lib/participants";
import {
  getTaskDisplayDescription,
  getTaskDisplayTitle,
  parseTaskMetadata
} from "@/lib/taskMetadata";
import { getExplorerAddressUrl, shortenAddress } from "@/lib/web3";

type TaskCardProps = {
  task: EscrowTask | PlaceholderTask;
};

type PlaceholderTask = {
  id: string;
  title: string;
  description: string;
  category: string;
  budgetUsdc: string;
  status: string;
};

function isOnChainTask(task: EscrowTask | PlaceholderTask): task is EscrowTask {
  return typeof task.id === "bigint";
}

export function TaskCard({ task }: TaskCardProps) {
  const onChainTask = isOnChainTask(task);
  const metadata = onChainTask ? parseTaskMetadata(task.metadataURI) : null;
  const title = onChainTask
    ? getTaskDisplayTitle(task.metadataURI, `Job #${task.id.toString()}`)
    : task.title;
  const category = onChainTask ? metadata?.category || "Custom Job" : task.category;
  const description = onChainTask ? getTaskDisplayDescription(task.metadataURI) : task.description;
  const amount = onChainTask ? task.amountUsdc : task.budgetUsdc;
  const status = onChainTask ? task.statusLabel : task.status;
  const href = onChainTask ? `/tasks/${task.id.toString()}` : `/tasks/${task.id}`;

  return (
    <article className="rounded-lg border border-arc-border bg-arc-panel/80 p-5 transition hover:border-arc-blue hover:bg-arc-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-normal text-arc-blue">{category}</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
          {onChainTask ? (
            <p className="mt-1 text-xs text-slate-500">
              Job #{task.id.toString()} · Arc Compatible
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {onChainTask ? (
            <span className="rounded-full border border-arc-blue/40 bg-arc-blue/10 px-3 py-1 text-xs font-semibold text-arc-blue">
              Protected Settlement
            </span>
          ) : null}
          {onChainTask ? (
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getParticipantBadgeClass(
                metadata?.participantType
              )}`}
            >
              {getUserTypeLabel(metadata?.userType ?? getUserTypeFromLegacy(metadata?.participantType))}
            </span>
          ) : null}
          <TaskStatusBadge status={status} />
        </div>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-400">{description}</p>
      {onChainTask ? (
        <div className="mt-4 grid gap-1 text-xs text-slate-500">
          <p>License: {metadata?.license || "Not specified"}</p>
          <p>Type: {metadata?.resourceType || "Custom Service"}</p>
          <p>Identity Source: {getIdentitySourceLabel(metadata?.identitySource)}</p>
          <p>
            User / entity:{" "}
            {getUserTypeLabel(metadata?.userType ?? getUserTypeFromLegacy(metadata?.participantType))} /{" "}
            {getEntityTypeLabel(metadata?.entityType)}
          </p>
          <p>
            Buyer: {metadata?.participantName ? `${metadata.participantName} - ` : ""}
            <a
              href={getExplorerAddressUrl(task.client)}
              target="_blank"
              rel="noreferrer"
              className="text-slate-300 hover:text-arc-blue"
            >
              {shortenAddress(task.client)}
            </a>
          </p>
          <p>
            Provider:{" "}
            {task.freelancer === "0x0000000000000000000000000000000000000000" ? (
              "Not assigned"
            ) : (
              <a
                href={getExplorerAddressUrl(task.freelancer)}
                target="_blank"
                rel="noreferrer"
                className="text-slate-300 hover:text-arc-blue"
              >
                {shortenAddress(task.freelancer)}
              </a>
            )}
          </p>
        </div>
      ) : null}
      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-white">{amount}</span> USDC
        </p>
        <Link href={href} className="text-sm font-medium text-arc-blue hover:text-white">
          View Job
        </Link>
      </div>
    </article>
  );
}
